"""Công cụ chung của eval T-053 (chỉ dùng thư viện chuẩn). Không dùng pkill -f; chỉ kill đúng pid/nhóm do eval tạo."""
import os, signal, subprocess, sys, time, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
FRONT = os.environ.get("FRONT", "/home/user/tohong-front")
C9 = os.path.join(HQ, "eval/T-051/check_9_front_anh_mac_dinh.cjs")
C10 = os.path.join(HQ, "eval/T-051/check_10_front_vendor_da_luu.cjs")


def env():
    e = dict(os.environ)
    if not e.get("NODE_PATH"):
        e["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    return e


def vite_pids(front):
    """pid của mọi tiến trình có 'vite' trong dòng lệnh và thư mục làm việc là front (kể cả npx/npm exec)."""
    front = os.path.realpath(front); out = {}
    for d in os.listdir("/proc"):
        if not d.isdigit():
            continue
        try:
            cmd = open(f"/proc/{d}/cmdline", "rb").read().replace(b"\0", b" ").decode("utf-8", "replace")
            if "vite" in cmd and os.path.realpath(f"/proc/{d}/cwd") == front:
                out[int(d)] = cmd.strip()[:120]
        except OSError:
            pass
    return out


def run_check(script, front, timeout=300):
    """Chạy một check, trả (dòng PASS/FAIL cuối, mã thoát). Nhóm tiến trình riêng của check bị kill khi quá hạn."""
    p = subprocess.Popen(["node", script, front], env=env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        out, _ = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
        out, _ = p.communicate(); out += "\nFAIL quá hạn"
    lines = [l for l in out.strip().splitlines() if l.strip()]
    return (lines[-1] if lines else "FAIL không có output"), p.returncode


class Decoy:
    def __enter__(self):
        self.p = subprocess.Popen(["node", os.path.join(HERE, "decoy.cjs")], stdout=subprocess.PIPE, text=True, start_new_session=True)
        line = self.p.stdout.readline()
        if not line.startswith("READY"):
            raise RuntimeError("decoy không lên: " + line)
        self.n = int(line.split()[1])
        return self

    def __exit__(self, *a):
        try: os.killpg(self.p.pid, signal.SIGKILL)
        except OSError: pass
        self.p.wait()


def kill_pids(pids):
    for pid in pids:
        try: os.kill(pid, signal.SIGKILL)
        except OSError: pass


def rm_probe_files(front):
    for f in os.listdir(front):
        if f.startswith("__t051") and f.endswith((".jsx", ".html")):
            try: os.unlink(os.path.join(front, f))
            except OSError: pass


def scratch():
    return tempfile.mkdtemp(prefix="t053-", dir=os.environ.get("EVAL_TMPDIR") or None)


def front_copy(dst, mutate):
    """Bản sao front (node_modules để symlink, không sao chép) với một chỗ bị phá có chủ đích, để chứng minh check vẫn bắt lỗi."""
    shutil.copytree(FRONT, dst, ignore=shutil.ignore_patterns("node_modules", ".git", "dist"), symlinks=True)
    os.symlink(os.path.join(FRONT, "node_modules"), os.path.join(dst, "node_modules"))
    mutate(dst)
