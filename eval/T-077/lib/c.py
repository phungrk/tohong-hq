"""Công cụ chung của eval T-077 (chỉ thư viện chuẩn + eval/T-053/lib/h.py). Không pkill; chỉ kill tiến trình mang dấu của lần chạy (h.marked).
--evalroot DIR : thư mục eval/ dùng để chạy hai phép đo (mặc định eval/ của sổ cái). Cho phép đo "bản tham chiếu" mà không đụng sổ cái:
  cp -r eval/ <tạm> rồi thay <tạm>/_lib/vite_dev.cjs bằng bản đã sửa; mọi check chạy y hệt trên đó.
--front DIR    : front gốc (mặc định h.FRONT)."""
import os, sys, shutil, subprocess, threading, signal, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "T-053", "lib"))
import h

def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

EVALROOT = os.path.abspath(arg("--evalroot", os.path.join(h.HQ, "eval")))
FRONT = os.path.abspath(arg("--front", h.FRONT))
C10 = os.path.join(EVALROOT, "T-051", "check_10_front_vendor_da_luu.cjs")
STT = os.path.join(EVALROOT, "invariants", "planner", "front", "vendor-images", "lib", "small_tile_tooltip.cjs")
IGNORE = {"node-compile-cache"}  # node tự ghi vào TMPDIR, không phải cache vite


def private_tmp():
    """TMPDIR riêng cho một lần chạy: mọi thứ helper tạo trong thư mục tạm hệ thống đều rơi vào đây, nên đếm được và dọn được."""
    base = os.environ.get("EVAL_TMPDIR") or None
    d = h.scratch() if base else __import__("tempfile").mkdtemp(prefix="t077-")
    return d


def env_tmp(tmpdir):
    e = h.env(); e["TMPDIR"] = tmpdir; return e


def left(tmpdir):
    try: return sorted(n for n in os.listdir(tmpdir) if n not in IGNORE)
    except OSError: return []


def run_stt(front, tmpdir, timeout=300):
    """small_tile_tooltip (bất biến vendor-images) trên front. Trả (dòng cuối, mã thoát, toàn bộ output)."""
    p = subprocess.Popen(["node", STT, "--repo", front], env=env_tmp(tmpdir), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try: out, _ = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
        out, _ = p.communicate(); out += "\nFAIL quá hạn"
    lines = [l for l in out.strip().splitlines() if l.strip()]
    return (lines[-1] if lines else "FAIL không có output"), p.returncode, out


def run_c10(front, tmpdir, timeout=300):
    p = subprocess.Popen(["node", C10, front], env=env_tmp(tmpdir), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try: out, _ = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
        out, _ = p.communicate(); out += "\nFAIL quá hạn"
    lines = [l for l in out.strip().splitlines() if l.strip()]
    return (lines[-1] if lines else "FAIL không có output"), p.returncode, out


def cache_state(front):
    """Cây {đường dẫn tương đối: (kích thước, mtime_ns)} của cache vite CHUNG (node_modules/.vite của front gốc, theo realpath)."""
    root = os.path.realpath(os.path.join(front, "node_modules", ".vite"))
    s = {}
    for dp, dn, fn in os.walk(root):
        for f in fn:
            p = os.path.join(dp, f)
            try: st = os.stat(p); s[os.path.relpath(p, root)] = (st.st_size, st.st_mtime_ns)
            except OSError: pass
        for d in dn: s[os.path.relpath(os.path.join(dp, d), root) + "/"] = None
    return s


def burn(n):
    return [subprocess.Popen([sys.executable, "-c", "while True: pass"]) for _ in range(n)]


def front_copy(tmp, name="front-x", mutate=lambda d: None):
    dst = os.path.join(tmp, name); h.front_copy(dst, mutate); return dst


def vite_caches(tmpdir):
    """Tên các mục cấp 1 trong TMPDIR chứa một cache vite (có deps/_metadata.json trong <= 3 cấp). Phân biệt với hồ sơ chromium, bản sao front..."""
    out = []
    try: names = os.listdir(tmpdir)
    except OSError: return out
    for n in names:
        p = os.path.join(tmpdir, n)
        if not os.path.isdir(p) or os.path.islink(p): continue
        base = p.count(os.sep)
        for dp, dn, fn in os.walk(p):
            if dp.count(os.sep) - base > 3: dn[:] = []; continue
            if os.path.basename(dp) == "deps" and "_metadata.json" in fn: out.append(n); break
    return sorted(out)
