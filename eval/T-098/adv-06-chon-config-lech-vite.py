#!/usr/bin/env python3
"""T-098 adv-06 (adversary). Spec T-077 Hành vi 5 ("kết quả ... không đổi") + Ràng buộc "không sửa cấu hình vite của front":
helper phải dùng ĐÚNG file cấu hình mà vite tự chọn khi không có --config (vite 8 DEFAULT_CONFIG_FILES:
js, mjs, ts, cjs, mts, cts). Bản v2 luôn truyền --config file bọc, nên file nào helper không nhận ra thì cấu hình gốc bị BỎ QUA im lặng.
Input biên (repo tối giản, node_modules riêng symlink từng gói của front, không bao giờ chạm cache chung):
 (a) chỉ có vite.config.cts; (b) có cả vite.config.cjs và vite.config.mts (vite chọn .cjs);
 (c) có cả vite.config.js và vite.config.ts (vite chọn .js) — đối chứng, đã đúng.
Mỗi config thêm plugin trả /__adv06-mark = tên file. Mong đợi: qua helper trả cùng tên file như vite chạy trần; cache riêng dưới TMPDIR; TMPDIR + repo sạch sau stop().
Mã thoát 0 = đạt."""
import json, os, shutil, signal, socket, subprocess, sys, tempfile, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)

def cfg(name, ts=False, cjs=False):
    plug = ("{ name: 'adv06', configureServer(s) { s.middlewares.use((q, r, n) => q.url === '/__adv06-mark' ? r.end(%s) : n()); } }" % json.dumps(name))
    if cjs: return "module.exports = { plugins: [%s] };\n" % plug
    return "export default { plugins: [%s] };\n" % plug

def mini(d, cfgs):
    os.makedirs(d); open(os.path.join(d, "index.html"), "w").write("<!doctype html><html><body>adv06</body></html>\n")
    open(os.path.join(d, "package.json"), "w").write('{"name":"adv06","private":true,"type":"module"}\n')
    nm = os.path.join(d, "node_modules"); os.mkdir(nm)
    for n in os.listdir(os.path.join(a.FRONT, "node_modules")):
        if n != ".vite": os.symlink(os.path.join(a.FRONT, "node_modules", n), os.path.join(nm, n))
    for fn, body in cfgs.items(): open(os.path.join(d, fn), "w").write(body)
    return d

def fetch(url):
    try: return urllib.request.urlopen(url, timeout=5).read().decode()
    except Exception as e: return "ERR:" + type(e).__name__

def bare(repo, tmp):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    env = dict(os.environ); env["TMPDIR"] = tmp
    p = subprocess.Popen([os.path.join(repo, "node_modules", ".bin", "vite"), "--port", str(port), "--strictPort", "--host", "127.0.0.1"], cwd=repo, env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        t0 = time.time(); out = "ERR:timeout"
        while time.time() - t0 < 20:
            out = fetch(f"http://127.0.0.1:{port}/__adv06-mark")
            if not out.startswith("ERR"): break
            time.sleep(0.25)
        return out
    finally:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
        p.wait()

DRV = r"""
const http = require('http'); const { startViteDev } = require(process.argv[2]);
const get = (u) => new Promise(r => { http.get(u, s => { let b=''; s.on('data', d => b += d); s.on('end', () => r(b)); }).on('error', e => r('ERR:' + e.code)); });
(async () => { let v; try { v = await startViteDev({ repo: process.argv[3] }); } catch (e) { console.log(JSON.stringify({ err: e.message })); return; }
  const m = await get(v.url + '/__adv06-mark'); await v.stop(); console.log(JSON.stringify({ mark: m })); })();
"""

CASES = {
    "(a) chỉ vite.config.cts": {"vite.config.cts": cfg("vite.config.cts", ts=True)},
    "(b) .cjs + .mts": {"vite.config.cjs": cfg("vite.config.cjs", cjs=True), "vite.config.mts": cfg("vite.config.mts", ts=True)},
    "(c) .js + .ts (đối chứng)": {"vite.config.js": cfg("vite.config.js"), "vite.config.ts": cfg("vite.config.ts", ts=True)},
}
errs = []; w = tempfile.mkdtemp(prefix="t098a6-")
try:
    drv = os.path.join(w, "drv.cjs"); open(drv, "w").write(DRV)
    for i, (name, cfgs) in enumerate(CASES.items()):
        repo = mini(os.path.join(w, f"r{i}"), cfgs)
        tb = os.path.join(w, f"tb{i}"); os.mkdir(tb)
        want = bare(repo, tb)
        th = os.path.join(w, f"th{i}"); os.mkdir(th)
        before = set(os.listdir(repo))
        env = dict(os.environ); env["TMPDIR"] = th
        p = subprocess.run(["node", drv, a.HELPER, repo], env=env, capture_output=True, text=True, timeout=90)
        try: got = json.loads(p.stdout.strip().splitlines()[-1])
        except Exception: got = {"err": "driver: " + (p.stdout + p.stderr)[-200:]}
        time.sleep(0.5)
        e = []
        if want.startswith("ERR"): e.append(f"vite trần không dựng được ({want}) — eval không áp dụng")
        elif got.get("mark") != want: e.append(f"vite trần dùng {want!r}, qua helper được {got.get('mark') or got.get('err')!r}")
        lt = sorted(n for n in os.listdir(th) if n not in a.IGNORE_TMP)
        lf = sorted(set(os.listdir(repo)) - before)
        if lt: e.append(f"TMPDIR còn {lt[:3]}")
        if lf: e.append(f"repo còn {lf[:3]}")
        if e: errs.append(name + ": " + "; ".join(e))
finally: shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL helper chọn cấu hình lệch vite: " + " | ".join(errs)); sys.exit(1)
print("PASS helper dùng đúng file cấu hình vite tự chọn (.cts, .cjs+.mts, .js+.ts); TMPDIR và repo sạch")
