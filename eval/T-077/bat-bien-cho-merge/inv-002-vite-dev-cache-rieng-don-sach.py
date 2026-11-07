#!/usr/bin/env python3
"""Nguồn: T-077 (spec products/T-077-cache-vite-rieng-moi-lan-chay.md v2, Hành vi 1, 2, 4), Spec Gate 2026-11-07 (spec-critic).
CHỜ MERGE (ADR-028): đỏ trên main tới khi helper T-077 merge; nằm ở eval/T-077/bat-bien-cho-merge/, Chief of Staff đưa vào eval/invariants/planner/ sau merge (cùng độ sâu, đường dẫn tương đối giữ nguyên).
Luật đỏ giả (spec T-077, ADR-035 mục 4): đỏ ở vế "cache chung bị đổi" khi có eval front khác đang chạy cùng lúc bằng helper cũ thì chạy lại riêng trước khi phân loại.
INV-002 (planner) · Helper vite dev của eval (eval/_lib/vite_dev.cjs, startViteDev) dựng máy chủ với cache vite RIÊNG của lần chạy, nằm trong thư mục tạm hệ thống
(os.tmpdir(), theo TMPDIR); không thêm/bớt/sửa file nào trong cache chung node_modules/.vite của repo front (theo realpath, kể cả node_modules là symlink);
cache đó là đúng một mục cấp 1 của TMPDIR; sau stop() không để lại gì trong TMPDIR, kể cả thư mục cha rỗng (trừ node-compile-cache do node tự ghi).
Đo (không cần chromium): một lần startViteDev trên front với TMPDIR riêng, gọi vài URL để vite tối ưu deps; trong lúc chạy PHẢI thấy một cache vite (deps/_metadata.json, sâu <= 4 cấp) trong TMPDIR;
sau stop() + node thoát: TMPDIR rỗng, cache chung không đổi (bỏ qua node_modules/.vite/vitest: vitest của front có quyền ghi ở đó).
Repo front: TOHONG_FRONT_REPO, FRONT, cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq; không thấy (hoặc chưa cài node_modules) -> "PASS chưa áp dụng".
Chạy: python3 eval/T-077/bat-bien-cho-merge/inv-002-vite-dev-cache-rieng-don-sach.py (sau merge: eval/invariants/planner/inv-002-...) (gate.py: python3 -I). ~10-40s. Mã thoát 0 = đạt."""
import json, os, shutil, signal, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
HELPER = os.path.abspath(os.path.join(HERE, "..", "..", "_lib", "vite_dev.cjs"))
IGNORE_TMP = {"node-compile-cache"}


def find_front():
    for c in (os.environ.get("TOHONG_FRONT_REPO"), os.environ.get("FRONT"), os.getcwd(), os.path.join(HQ, "..", "tohong-front")):
        if c and os.path.isfile(os.path.join(c, "package.json")) and os.path.isfile(os.path.join(c, "node_modules", "vite", "package.json")):
            return os.path.abspath(c)
    return None


def shared_state(front):
    root = os.path.realpath(os.path.join(front, "node_modules", ".vite"))
    s = {}
    for dp, dn, fn in os.walk(root):
        rel = os.path.relpath(dp, root)
        if rel == "vitest" or rel.startswith("vitest" + os.sep):
            dn[:] = []; continue
        for d in dn:
            if not (rel == "." and d == "vitest"): s[os.path.normpath(os.path.join(rel, d)) + "/"] = None
        for f in fn:
            p = os.path.join(dp, f)
            try: st = os.stat(p); s[os.path.normpath(os.path.join(rel, f))] = (st.st_size, st.st_mtime_ns)
            except OSError: pass
    return s


def has_vite_cache(tmpdir):
    base = tmpdir.rstrip(os.sep).count(os.sep)
    for dp, dn, fn in os.walk(tmpdir):
        if dp.count(os.sep) - base > 4: dn[:] = []; continue
        if os.path.basename(dp) == "deps" and "_metadata.json" in fn: return os.path.relpath(dp, tmpdir)
    return None


DRIVER = r"""
const http = require('http');
const { startViteDev } = require(process.argv[2]);
const get = (u) => new Promise(r => { const q = http.get(u, { timeout: 20000 }, s => { let b = ''; s.setEncoding('utf8'); s.on('data', d => b += d); s.on('end', () => r(b)); }); q.on('error', () => r('')); q.on('timeout', () => { q.destroy(); r(''); }); });
(async () => {
  const v = await startViteDev({ repo: process.argv[3] });
  const html = await get(v.url + '/');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => s.startsWith('/'));
  for (const s of srcs) await get(v.url + s);
  process.stdout.write('READY\n');
  await new Promise(r => process.stdin.once('data', r));
  await v.stop();
  process.stdout.write('STOPPED\n');
  process.exit(0);
})().catch(e => { process.stdout.write('ERR ' + (e && e.message) + '\n'); process.exit(3); });
"""


def main():
    front = find_front()
    if not front:
        print("PASS chưa áp dụng: không tìm thấy repo tohong-front có node_modules"); return 0
    work = tempfile.mkdtemp(prefix="inv002-")
    tmpdir = os.path.join(work, "t"); os.mkdir(tmpdir)
    drv = os.path.join(work, "driver.cjs"); open(drv, "w").write(DRIVER)
    env = dict(os.environ); env["TMPDIR"] = tmpdir
    errs = []; p = None
    try:
        before = shared_state(front)
        p = subprocess.Popen(["node", drv, HELPER, front], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             text=True, start_new_session=True)
        line = p.stdout.readline().strip()
        if line != "READY":
            rest = p.stdout.read() if p.poll() is not None else ""
            print("FAIL không dựng được vite qua helper (lỗi chạy eval): " + (line + " " + rest)[:200]); return 1
        seen = None; t0 = time.time()
        while time.time() - t0 < 60 and not seen:
            seen = has_vite_cache(tmpdir); time.sleep(0.3)
        if not seen:
            errs.append("trong lúc vite chạy không thấy cache vite riêng (deps/_metadata.json) nào trong TMPDIR")
        p.stdin.write("x\n"); p.stdin.flush()
        out = p.stdout.readline().strip()
        try: p.wait(timeout=30)
        except subprocess.TimeoutExpired: errs.append("helper không dừng trong 30s sau stop()")
        if out != "STOPPED": errs.append("stop() không xong: " + out[:80])
        time.sleep(1)
        left = sorted(n for n in os.listdir(tmpdir) if n not in IGNORE_TMP)
        if left: errs.append(f"sau stop() còn lại trong TMPDIR: {left[:3]}")
        after = shared_state(front)
        ch = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
        if ch: errs.append(f"cache chung node_modules/.vite bị đổi ({len(ch)} mục, vd {ch[:3]})")
    finally:
        if p and p.poll() is None:
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
        shutil.rmtree(work, ignore_errors=True)
    if errs: print("FAIL " + " | ".join(errs)); return 1
    print(f"PASS helper dùng cache riêng trong TMPDIR ({seen}), cache chung không đổi ({len(before)} mục), TMPDIR sạch sau stop()")
    return 0


if __name__ == "__main__":
    sys.exit(main())
