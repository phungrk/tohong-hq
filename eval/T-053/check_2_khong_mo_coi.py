#!/usr/bin/env python3
"""T-053 tiêu chí 2: sau mỗi lần chạy check 9 / check 10 không còn tiến trình vite (kể cả npx) do eval tạo, kể cả khi harness bị SIGTERM giữa chừng (quá hạn, Ctrl-C).
Nhận diện: tiến trình có 'vite' trong dòng lệnh và cwd = thư mục front, mới xuất hiện so với trước khi chạy. Không dùng pkill -f. Chạy: python3 check_2_khong_mo_coi.py [--front DIR]
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, signal, subprocess, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
front = sys.argv[sys.argv.index("--front") + 1] if "--front" in sys.argv else h.FRONT
base = set(h.vite_pids(front)); leaks = []

def settle(label):
    time.sleep(1.5)
    new = {p: c for p, c in h.vite_pids(front).items() if p not in base}
    if new: leaks.append(f"{label}: còn {len(new)} tiến trình ({next(iter(new.values()))[:70]})"); h.kill_pids(new); base.update(new)

try:
    for name, s in (("C9", h.C9), ("C10", h.C10)):
        h.run_check(s, front); settle(f"{name} chạy xong")
        p = subprocess.Popen(["node", s, front], env=h.env(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        t0 = time.time()
        while time.time() - t0 < 60 and not (set(h.vite_pids(front)) - base): time.sleep(0.3)
        started = bool(set(h.vite_pids(front)) - base)
        os.kill(p.pid, signal.SIGTERM)
        try: p.wait(15)
        except subprocess.TimeoutExpired: os.killpg(p.pid, signal.SIGKILL); leaks.append(f"{name}: harness không thoát sau SIGTERM 15s")
        if not started: leaks.append(f"{name}: không thấy vite lên trong 60s để thử SIGTERM")
        settle(f"{name} bị SIGTERM giữa chừng")
finally:
    h.kill_pids(set(h.vite_pids(front)) - set(base) ); h.rm_probe_files(front)
if leaks: print("FAIL " + " | ".join(leaks)); sys.exit(1)
print("PASS không còn vite do eval tạo sau chạy xong và sau SIGTERM (C9, C10)")
