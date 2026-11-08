#!/usr/bin/env python3
"""Tiêu chí 2: Graphify chỉ nằm trong scratchpad. Quét trạng thái THẬT của máy: không dấu vết trong tohong-hq, ~/.claude (trừ projects/),
tohong-front gốc (cây làm việc, .git/hooks, config), công cụ toàn cục. Bảng kê cài đặt mọi đường dẫn nằm dưới root scratchpad."""
import os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
m = manifest()
root = os.path.realpath(m.get("scratch_root", ""))
if not root or not root.startswith("/tmp/claude-"): fail("manifest.scratch_root phải là thư mục scratchpad của phiên (/tmp/claude-…)")
for p in m.get("paths_written", []):
    if not os.path.realpath(p).startswith(root + os.sep): fail(f"đường dẫn Graphify ghi nằm ngoài scratchpad: {p}")
if not m.get("paths_written"): fail("manifest.paths_written rỗng: chưa liệt kê những gì đã ghi")
home = os.path.expanduser("~")
pat = re.compile(r"graphify", re.I)
def scan(base, skip=()):
    hits = []
    if not os.path.exists(base): return hits
    for d, ds, fs in os.walk(base):
        ds[:] = [x for x in ds if os.path.join(d, x) not in skip and x not in ("node_modules", "__pycache__")]
        for f in fs:
            p = os.path.join(d, f)
            if pat.search(f): hits.append(p); continue
            try:
                if os.path.getsize(p) < 2_000_000 and pat.search(open(p, errors="ignore").read()): hits.append(p)
            except OSError: pass
    return hits
# tohong-hq: chỉ cho phép chính T-102 (spec, eval, báo cáo, hồ sơ, bàn giao, sổ cái, board, mẫu) nhắc tên; cấm các vùng cấu hình
for sub in (".claude", "scripts", "templates", "CLAUDE.md", "handbook", "routines", ".github"):
    h = scan(os.path.join(HQ, sub))
    if h: fail(f"có dấu vết Graphify trong tohong-hq/{sub}: {h[:3]}")
h = scan(os.path.join(home, ".claude"), skip=(os.path.join(home, ".claude", "projects"),))
if h: fail(f"có dấu vết Graphify trong ~/.claude: {h[:3]}")
for f in (".claude.json", ".bashrc", ".profile", ".zshrc"):
    p = os.path.join(home, f)
    if os.path.isfile(p) and pat.search(open(p, errors="ignore").read()): fail(f"có Graphify trong ~/{f}")
if scan(os.path.join(FRONT, ".git", "hooks")) : fail("có Graphify trong tohong-front/.git/hooks (worktree dùng chung hooks)")
cfg = os.path.join(FRONT, ".git", "config")
if pat.search(open(cfg, errors="ignore").read()): fail("có Graphify trong tohong-front/.git/config")
st = subprocess.run(["git", "-C", FRONT, "status", "--porcelain"], capture_output=True, text=True).stdout
if pat.search(st) or os.path.exists(os.path.join(FRONT, "graphify-out")) or os.path.exists(os.path.join(FRONT, ".graphifyignore")):
    fail("tohong-front gốc có file Graphify")
if scan(os.path.join(home, ".local", "share", "uv", "tools")) or scan(os.path.join(home, ".local", "pipx")):
    fail("Graphify còn trong công cụ toàn cục (uv tool / pipx)")
w = shutil.which("graphify")
if w and not os.path.realpath(w).startswith(root + os.sep): fail(f"lệnh graphify nằm ngoài scratchpad: {w}")
ok("không dấu vết ngoài scratchpad")
