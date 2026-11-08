#!/usr/bin/env python3
"""Tiêu chí 3: gỡ sạch, đo bằng trạng thái máy hiện tại: teardown_done, thư mục thí nghiệm không còn, tohong-front không còn worktree trỏ vào scratchpad,
lệnh/tiến trình graphify không còn, và KHÔNG còn mục nào mang tên graphify ở ~/.cache, ~/.config, ~/.local, ~/.npm, ~/.agents, ~/.claude, tohong-front/.git
(trừ những mục đã có sẵn trong ảnh chụp đầu fs-before.txt)."""
import os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
m = manifest()
if m.get("teardown_done") is not True: fail("manifest.teardown_done chưa là true: thí nghiệm chưa gỡ")
exp = m.get("experiment_dir")
if not exp: fail("manifest.experiment_dir trống")
if os.path.exists(exp): fail(f"thư mục thí nghiệm còn: {exp}")
wt = subprocess.run(["git", "-C", FRONT, "worktree", "list", "--porcelain"], capture_output=True, text=True).stdout
extra = [l.split(" ", 1)[1] for l in wt.splitlines() if l.startswith("worktree ")][1:]   # bỏ mục đầu = cây chính
if any(x == exp or x.startswith(exp + os.sep) or x.startswith("/tmp/claude-") for x in extra): fail("tohong-front còn worktree ở scratchpad (cần git worktree remove / prune)")
if os.path.isdir(os.path.join(FRONT, ".git", "worktrees")) and any(os.scandir(os.path.join(FRONT, ".git", "worktrees"))):
    fail("tohong-front/.git/worktrees còn mục (git worktree prune chưa chạy)")
if shutil.which("graphify"): fail("lệnh graphify còn trên PATH")
def is_graphify_proc(args):   # chỉ tiến trình CHẠY graphify (argv[0] hoặc script/module đầu của python), không phải tiến trình có chữ graphify trong đối số
    t = args.split()
    if not t: return False
    if os.path.basename(t[0]) == "graphify": return True
    if os.path.basename(t[0]).startswith("python"):
        rest = [x for x in t[1:] if x != "-m" and not x.startswith("-")]
        return bool(rest) and os.path.basename(rest[0]).split(".")[0] in ("graphify", "graphifyy")
    return False
ps = [l for l in subprocess.run(["ps", "-eo", "pid=,args="], capture_output=True, text=True).stdout.splitlines() if is_graphify_proc(l.strip().split(None, 1)[1] if len(l.strip().split(None, 1)) > 1 else "")]
if ps: fail("còn tiến trình graphify: " + ps[0].strip()[:120])
before = read_snapshot("fs-before.txt")
def same_as_before(p):   # có sẵn từ trước VÀ chưa bị đổi: mới được miễn (file có sẵn mà nay chứa graphify là dấu vết)
    try: st = os.lstat(p)
    except OSError: return False
    return before.get(p) == (st.st_size, st.st_mtime_ns)
left = [h for h in live_traces() if not under(h[1], exp) and not same_as_before(h[1])]
if left: fail(f"còn dấu vết mang tên/nội dung graphify do thí nghiệm để lại: {left[:3]}")
ok("đã gỡ sạch")
