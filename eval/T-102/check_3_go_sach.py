#!/usr/bin/env python3
"""Tiêu chí 3: gỡ sạch. Sau thí nghiệm: root scratchpad của thí nghiệm không còn, tohong-front không còn worktree trỏ vào đó,
lệnh graphify không còn, không còn tiến trình graphify, nhật ký truy vấn không còn file mới do thí nghiệm."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
m = manifest()
if m.get("teardown_done") is not True: fail("manifest.teardown_done chưa là true: thí nghiệm chưa gỡ")
exp = m.get("experiment_dir")
if not exp: fail("manifest.experiment_dir trống")
if os.path.exists(exp): fail(f"thư mục thí nghiệm còn: {exp}")
wt = subprocess.run(["git", "-C", FRONT, "worktree", "list", "--porcelain"], capture_output=True, text=True).stdout
if exp in wt or "/tmp/claude-" in wt: fail("tohong-front còn worktree ở scratchpad (cần git worktree remove / prune)")
import shutil
if shutil.which("graphify"): fail("lệnh graphify còn trên PATH")
ps = subprocess.run(["pgrep", "-fl", "graphify"], capture_output=True, text=True).stdout
if ps.strip(): fail("còn tiến trình graphify: " + ps.strip()[:120])
log = os.path.expanduser("~/.cache/graphify-queries.log")
if os.path.exists(log) and m.get("query_log_existed_before") is False: fail("nhật ký truy vấn ~/.cache/graphify-queries.log do thí nghiệm tạo ra, chưa xoá")
ok("đã gỡ sạch")
