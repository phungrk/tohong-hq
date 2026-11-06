#!/usr/bin/env python3
"""T-071 adv-02 (adversary, tầng 3): tín hiệu tới harness khi trình duyệt (chromium) ĐANG chạy, không chỉ lúc vite vừa lên (check_2 T-053 chỉ thử lúc vite lên).
Spec T-053 Hành vi 2: bị SIGTERM/SIGINT/SIGHUP giữa chừng thì thoát mã khác 0 trong 15s, không còn tiến trình mang dấu (vite, chromium...), không còn file __*.
Mong đợi: với C9 (SIGTERM, SIGHUP) và C10 (SIGINT), gửi tín hiệu khi đã thấy tiến trình chrome mang dấu: harness thoát <15s mã != 0, sau 2s không còn tiến trình mang dấu, không file __* mới.
Chạy: python3 eval/T-071/adv-02-tin-hieu-luc-trinh-duyet.py. In PASS/FAIL; mã thoát 0/1."""
import os, sys, time, signal, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-053", "lib"))
import h
front = h.FRONT; snap0 = h.snapshot(front); errs = []
def chrome_up(p):
    return any("chrom" in c.lower() for pid, c in h.marked(exclude={p.pid}).items())
try:
    for name, s, sig in (("C9", h.C9, signal.SIGTERM), ("C10", h.C10, signal.SIGINT), ("C9", h.C9, signal.SIGHUP)):
        lab = f"{name} {sig.name} lúc trình duyệt chạy"
        p = subprocess.Popen(["node", s, front], env=h.env(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        t0 = time.time()
        while time.time() - t0 < 90 and not chrome_up(p) and p.poll() is None: time.sleep(0.2)
        if not chrome_up(p): errs.append(f"{lab}: không thấy chromium mang dấu lên"); 
        time.sleep(0.3)
        if p.poll() is not None: errs.append(f"{lab}: harness đã xong trước khi kịp gửi tín hiệu (không đo được)"); h.kill_pids(h.marked()); h.rm_probe_files(front); continue
        os.kill(p.pid, sig)
        try:
            rc = p.wait(15)
            if rc == 0: errs.append(f"{lab}: harness thoát mã 0")
        except subprocess.TimeoutExpired:
            errs.append(f"{lab}: harness không thoát sau 15s")
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
        time.sleep(2.0)
        left = h.marked(); files = h.snapshot(front) - snap0
        if left: errs.append(f"{lab}: còn {len(left)} tiến trình mang dấu ({next(iter(left.values()))[:70]})")
        if files: errs.append(f"{lab}: để lại {sorted(files)[:3]}")
        h.kill_pids(left); h.rm_probe_files(front)
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(front)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS tín hiệu lúc chromium đang chạy: harness thoát mã != 0 < 15s, không còn tiến trình/file do eval tạo")
