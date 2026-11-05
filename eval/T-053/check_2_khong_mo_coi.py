#!/usr/bin/env python3
"""T-053 tiêu chí 2: sau mỗi lần chạy check 9 / check 10 (xong, hoặc bị SIGTERM / SIGINT / SIGHUP giữa chừng) (a) không còn tiến trình nào do eval tạo, (b) không còn file thử/nonce `__*` trong repo front, git status front không thêm mục `__*`.
Nhận diện "do eval tạo" bằng DẤU RIÊNG mỗi lần chạy: biến môi trường T053_RUN=<uuid> đặt bởi h.env(), truyền xuống harness, helper, vite con (đọc /proc/<pid>/environ). Không nhận diện theo cwd hay dòng lệnh; không bao giờ kill tiến trình không mang dấu.
Đo TRƯỚC khi harness eval này dọn (không dọn hộ): chụp danh sách file/tiến trình ngay sau khi tiến trình harness thoát, rồi mới dọn. Vite "lên" = có tiến trình mang dấu mà dòng lệnh chứa 'vite' hoặc nằm nhóm tiến trình riêng
(nên helper nào làm mất dấu env sẽ bị "không thấy vite lên", FAIL). Chạy: python3 check_2_khong_mo_coi.py [--front DIR]. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, signal, subprocess, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
front = sys.argv[sys.argv.index("--front") + 1] if "--front" in sys.argv else h.FRONT
leaks = []; snap0 = h.snapshot(front)

def measure(label):
    time.sleep(1.5)
    new = h.marked(); files = h.snapshot(front) - snap0   # đo xong mới dọn
    if new: leaks.append(f"{label}: còn {len(new)} tiến trình do eval tạo ({next(iter(new.values()))[:70]})")
    if files: leaks.append(f"{label}: để lại {sorted(files)[:3]} trong repo front")
    h.kill_pids(new); h.rm_probe_files(front)

def vite_up(p):
    for pid, cmd in h.marked(exclude={p.pid}).items():
        try: pg = os.getpgid(pid)
        except OSError: continue
        if "vite" in cmd.lower() or pg != p.pid: return True
    return False

try:
    for name, s in (("C9", h.C9), ("C10", h.C10)):
        h.run_check(s, front); measure(f"{name} chạy xong")
    # mỗi tín hiệu ít nhất một lần; C9 nhận SIGTERM + SIGHUP, C10 nhận SIGINT + SIGTERM
    for name, s, sig in (("C9", h.C9, signal.SIGTERM), ("C10", h.C10, signal.SIGINT), ("C9", h.C9, signal.SIGHUP), ("C10", h.C10, signal.SIGTERM)):
        label = f"{name} bị {sig.name} giữa chừng"
        p = subprocess.Popen(["node", s, front], env=h.env(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        t0 = time.time()
        while time.time() - t0 < 60 and not vite_up(p) and p.poll() is None: time.sleep(0.3)
        started = vite_up(p)
        if p.poll() is None: os.kill(p.pid, sig)   # chỉ gửi cho tiến trình harness, không cho nhóm
        try: p.wait(15)
        except subprocess.TimeoutExpired:
            leaks.append(f"{label}: harness không thoát sau 15s")
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
        if not started: leaks.append(f"{label}: không thấy vite (mang dấu T053_RUN) lên trong 60s để thử tín hiệu")
        measure(label)
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(front)
if leaks: print("FAIL " + " | ".join(leaks)); sys.exit(1)
print("PASS không còn tiến trình/file do eval tạo sau chạy xong và sau SIGTERM, SIGINT, SIGHUP (C9, C10)")
