"""Thư viện chung cho eval đối kháng T-098 (adversary). Chỉ thư viện chuẩn. Không kill theo tên; chỉ kill nhóm tiến trình do chính eval tạo.
run(front, tmpdir) dựng vite qua eval/_lib/vite_dev.cjs với TMPDIR=tmpdir, tải trang + module chính + mọi import deps đã tối ưu,
rồi stop(). Trả dict: ready/err, statuses (url -> mã HTTP), cache_seen (đường dẫn deps/_metadata.json trong TMPDIR lúc chạy),
left_tmp (mục còn lại dưới TMPDIR sau stop), left_front (file '__*' mới trong front sau stop), shared_changed (mục đổi trong node_modules/.vite theo realpath)."""
import json, os, re, shutil, signal, subprocess, tempfile, time
HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
HELPER = os.path.join(HQ, "eval", "_lib", "vite_dev.cjs")
FRONT = os.environ.get("TOHONG_FRONT_REPO") or os.path.abspath(os.path.join(HQ, "..", "tohong-front"))
IGNORE_TMP = {"node-compile-cache"}

DRIVER = r"""
const http = require('http');
const { startViteDev } = require(process.argv[2]);
const get = (u) => new Promise(r => { const q = http.get(u, { timeout: 30000 }, s => { let b = ''; s.setEncoding('utf8'); s.on('data', d => b += d); s.on('end', () => r({ st: s.statusCode, b })); }); q.on('error', () => r({ st: 0, b: '' })); q.on('timeout', () => { q.destroy(); r({ st: -1, b: '' }); }); });
(async () => {
  let v;
  try { v = await startViteDev({ repo: process.argv[3] }); }
  catch (e) { process.stdout.write(JSON.stringify({ err: String(e && e.message) }) + '\n'); await new Promise(r => process.stdin.once('data', r)); process.stdout.write('"STOPPED"\n'); process.exit(0); }
  const st = {};
  const html = await get(v.url + '/'); st['/'] = html.st;
  const srcs = [...html.b.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => s.startsWith('/'));
  for (const s of srcs) {
    const r = await get(v.url + s); st[s] = r.st;
    const deps = [...r.b.matchAll(/from\s+["']([^"']+)["']/g)].map(m => m[1]).filter(x => x.includes('.vite') || x.startsWith('/@fs/') || x.includes('/deps/'));
    for (const d of deps) { const u = d.startsWith('http') ? d : v.url + d; st[d] = (await get(u)).st; }
  }
  process.stdout.write(JSON.stringify({ ready: true, statuses: st }) + '\n');
  await new Promise(r => process.stdin.once('data', r));
  await v.stop();
  process.stdout.write('"STOPPED"\n');
  await new Promise(r => setTimeout(r, 300));
  process.exit(0);
})();
"""


def shared_state(front):
    root = os.path.realpath(os.path.join(front, "node_modules", ".vite"))
    s = {}
    for dp, dn, fn in os.walk(root):
        rel = os.path.relpath(dp, root)
        if rel == "vitest" or rel.startswith("vitest" + os.sep): dn[:] = []; continue
        for f in fn:
            try: st = os.stat(os.path.join(dp, f)); s[os.path.normpath(os.path.join(rel, f))] = (st.st_size, st.st_mtime_ns)
            except OSError: pass
    return s


def cache_in(tmpdir):
    for dp, dn, fn in os.walk(tmpdir):
        if os.path.basename(dp) == "deps" and "_metadata.json" in fn: return dp
    return None


def unders(front): return {n for n in os.listdir(front) if n.startswith("__")}


def front_copy(dst, mutate=None):
    shutil.copytree(FRONT, dst, ignore=shutil.ignore_patterns("node_modules", ".git", "dist"), symlinks=True)
    os.symlink(os.path.join(FRONT, "node_modules"), os.path.join(dst, "node_modules"))
    if mutate: mutate(dst)
    return dst


def run(front, tmpdir, work):
    drv = os.path.join(work, "driver.cjs"); open(drv, "w").write(DRIVER)
    env = dict(os.environ); env["TMPDIR"] = tmpdir
    before = shared_state(front); u0 = unders(front)
    p = subprocess.Popen(["node", drv, HELPER, front], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True)
    res = {}
    try:
        line = p.stdout.readline().strip()
        try: res = json.loads(line)
        except Exception: res = {"err": "driver: " + line[:200]}
        res["cache_seen"] = cache_in(tmpdir)
        res["during_tmp"] = sorted(n for n in os.listdir(tmpdir) if n not in IGNORE_TMP)
        res["during_front"] = sorted(unders(front) - u0)
        p.stdin.write("x\n"); p.stdin.flush(); p.stdout.readline()
        p.wait(timeout=30)
    finally:
        if p.poll() is None:
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
    time.sleep(1)
    res["left_tmp"] = sorted(n for n in os.listdir(tmpdir) if n not in IGNORE_TMP)
    res["left_front"] = sorted(unders(front) - u0)
    after = shared_state(front)
    res["shared_changed"] = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    return res


def bad_status(res):
    return {k: v for k, v in (res.get("statuses") or {}).items() if v != 200}
