"""Công cụ chung của eval T-053 (chỉ dùng thư viện chuẩn). Không dùng pkill -f; chỉ kill đúng pid/nhóm do eval tạo."""
import uuid, os, signal, subprocess, sys, time, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
FRONT = os.environ.get("FRONT", "/home/user/tohong-front")
C9 = os.path.join(HQ, "eval/T-051/check_9_front_anh_mac_dinh.cjs")
C10 = os.path.join(HQ, "eval/T-051/check_10_front_vendor_da_luu.cjs")
# Dấu riêng của MỖI lần chạy eval (D1.2): mọi tiến trình con (node, helper, vite, chromium) thừa hưởng biến môi trường này
# bất kể cwd hay dòng lệnh. Chỉ tiến trình mang dấu này mới được đếm là "do eval tạo" và mới bị kill. Không kill thứ gì khác.
RUN = "T053_RUN=" + uuid.uuid4().hex
_MARK = RUN.encode()


def env():
    e = dict(os.environ)
    e["T053_RUN"] = RUN.split("=", 1)[1]
    if not e.get("NODE_PATH"):
        e["NODE_PATH"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    return e


def clean_env():
    e = dict(os.environ); e.pop("T053_RUN", None); return e


def marked(exclude=()):
    """{pid: dòng lệnh} của mọi tiến trình đang sống mang dấu của lần chạy này (đọc /proc/<pid>/environ)."""
    out = {}
    for d in os.listdir("/proc"):
        if not d.isdigit() or int(d) == os.getpid() or int(d) in exclude:
            continue
        try:
            if _MARK in open(f"/proc/{d}/environ", "rb").read().split(b"\0"):
                out[int(d)] = open(f"/proc/{d}/cmdline", "rb").read().replace(b"\0", b" ").decode("utf-8", "replace").strip()[:120] or "?"
        except OSError:
            pass
    return out


def snapshot(front):
    """Các mục '__*' ở gốc, public/ và src/ của front + dòng 'git status' chứa '__' (file thử, file nonce)."""
    s = set()
    for sub in ("", "public", "src"):
        d = os.path.join(front, sub)
        if os.path.isdir(d):
            s |= {os.path.join(sub, f) for f in os.listdir(d) if f.startswith("__")}
    if os.path.isdir(os.path.join(front, ".git")):
        r = subprocess.run(["git", "-C", front, "status", "--porcelain", "-uall"], capture_output=True, text=True)
        s |= {"git:" + l[3:] for l in r.stdout.splitlines() if "__" in l}
    return s


LAST_OUT = ""


def run_check(script, front, timeout=300):
    """Chạy một check, trả (dòng PASS/FAIL cuối, mã thoát). Nhóm tiến trình riêng của check bị kill khi quá hạn."""
    p = subprocess.Popen(["node", script, front], env=env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        out, _ = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
        out, _ = p.communicate(); out += "\nFAIL quá hạn"
    global LAST_OUT; LAST_OUT = out
    lines = [l for l in out.strip().splitlines() if l.strip()]
    return (lines[-1] if lines else "FAIL không có output"), p.returncode


class Decoy:
    def __enter__(self):
        self.p = subprocess.Popen(["node", os.path.join(HERE, "decoy.cjs")], env=clean_env(), stdout=subprocess.PIPE, text=True, start_new_session=True)
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
    """Chỉ nhận pid lấy từ marked(); không bao giờ kill tiến trình không mang dấu."""
    pids = set(pids) & set(marked())
    for pid in pids:
        try: os.kill(pid, signal.SIGKILL)
        except OSError: pass


def rm_probe_files(front):
    """Dọn an toàn trong finally, SAU khi đã đo (check_2 đo trước khi gọi hàm này). Chỉ xoá file thử/nonce của eval."""
    for f in os.listdir(front):
        if f.startswith(("__t051", "__nonce", "__vimg", "__inv004")):
            try: os.unlink(os.path.join(front, f))
            except OSError: pass


def scratch():
    return tempfile.mkdtemp(prefix="t053-", dir=os.environ.get("EVAL_TMPDIR") or None)


def front_copy(dst, mutate):
    """Bản sao front (node_modules để symlink, không sao chép) với một chỗ bị phá có chủ đích, để chứng minh check vẫn bắt lỗi."""
    shutil.copytree(FRONT, dst, ignore=shutil.ignore_patterns("node_modules", ".git", "dist"), symlinks=True)
    os.symlink(os.path.join(FRONT, "node_modules"), os.path.join(dst, "node_modules"))
    mutate(dst)
