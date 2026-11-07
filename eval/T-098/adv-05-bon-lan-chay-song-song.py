#!/usr/bin/env python3
"""T-098 adv-05 (adversary). Spec T-077 Hành vi 2, 3, 4: hai (ở đây bốn) lần chạy cùng lúc có mục cache khác tên, đều cấp 1 của TMPDIR;
stop() của lần này không xoá cache/file của lần khác; sau cả bốn stop() TMPDIR sạch, cache chung không đổi, front không dư '__*'.
Input biên: 4 lần startViteDev đồng thời trên CÙNG front gốc và CÙNG TMPDIR, dừng lệch nhau (lần 1 dừng trước khi lần 2-4 tải trang).
Mã thoát 0 = đạt."""
import json, os, shutil, signal, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)
w = tempfile.mkdtemp(prefix="t098a5-"); t = os.path.join(w, "t"); os.mkdir(t)
drv = os.path.join(w, "driver.cjs"); open(drv, "w").write(a.DRIVER)
env = dict(os.environ); env["TMPDIR"] = t
errs = []; ps = []
before = a.shared_state(a.FRONT); u0 = a.unders(a.FRONT)
try:
    ps = [subprocess.Popen(["node", drv, a.HELPER, a.FRONT], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True) for _ in range(4)]
    res = [json.loads(p.stdout.readline() or '{"err":"không có output"}') for p in ps]
    during = sorted(n for n in os.listdir(t) if n not in a.IGNORE_TMP)
    if len([n for n in during if os.path.isdir(os.path.join(t, n))]) < 4: errs.append(f"lúc chạy chỉ có {during} (cần 4 mục cấp 1 khác tên)")
    for i, r in enumerate(res):
        if not r.get("ready"): errs.append(f"lần {i+1} không dựng được: {str(r.get('err'))[:100]}")
        elif a.bad_status(r): errs.append(f"lần {i+1} HTTP khác 200: {a.bad_status(r)}")
    ps[0].stdin.write("x\n"); ps[0].stdin.flush(); ps[0].stdout.readline(); ps[0].wait(timeout=30)
    still = sorted(n for n in os.listdir(t) if n not in a.IGNORE_TMP)
    if len(still) != 3: errs.append(f"sau stop() lần 1 còn {len(still)} mục (cần 3)")
    for p in ps[1:]:
        p.stdin.write("x\n"); p.stdin.flush(); p.stdout.readline(); p.wait(timeout=30)
    time.sleep(1)
    left = sorted(n for n in os.listdir(t) if n not in a.IGNORE_TMP)
    if left: errs.append(f"sau 4 stop() TMPDIR còn {left[:3]}")
    if a.unders(a.FRONT) - u0: errs.append(f"front dư {sorted(a.unders(a.FRONT) - u0)[:3]}")
    after = a.shared_state(a.FRONT); ch = [k for k in set(before) | set(after) if before.get(k) != after.get(k)]
    if ch: errs.append(f"cache chung đổi {len(ch)} mục")
finally:
    for p in ps:
        if p.poll() is None:
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
    shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS 4 lần chạy song song cùng TMPDIR: 4 cache cấp 1 khác tên, dừng lệch không xoá của nhau, sạch sau cùng, cache chung không đổi")
