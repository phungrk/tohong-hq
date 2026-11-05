#!/usr/bin/env python3
"""Nguồn: T-053 (spec products/T-053-sua-phep-do-vite.md v3, Hành vi 2: "git status của front không thêm mục nào"), qua Spec Gate 2026-11-05, spec-critic.
INV-011 · File tạm mà eval ghi vào repo front để vite phục vụ (file thử `__t0NN*`, file nonce `__nonce-*`, mọi tên bắt đầu `__t05`/`__nonce`)
không bao giờ được commit vào git của repo front (git ls-files). Chỉ đo phần đã commit: file chưa track có thể đang tồn tại hợp lệ khi
một eval front khác chạy song song, nên "không sót file sau khi chạy" được đo bằng eval hành vi của việc (T-053 check_2/check_6), không ở đây.
Repo front: TOHONG_FRONT_REPO, rồi cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq, rồi /home/user/tohong-front. Không thấy: PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import os, re, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))
def is_front(d): return d and os.path.isfile(os.path.join(d, "package.json")) and os.path.isdir(os.path.join(d, ".git")) and os.path.isdir(os.path.join(d, "src"))
repo = next((d for d in (os.environ.get("TOHONG_FRONT_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-front"), "/home/user/tohong-front")
             if is_front(d) and os.path.basename(os.path.abspath(d)) != "tohong-hq"), None)
if not repo: print("PASS chưa áp dụng (không thấy repo front)"); sys.exit(0)
NAME = re.compile(r"(^|/)__(t0\d\d|nonce)[^/]*$")
def git(*a): return subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True, timeout=60).stdout.splitlines()
bad = [f for f in git("ls-files") if NAME.search(f)]
msg = []
if bad: msg.append("đã commit: " + ", ".join(bad[:5]))
if msg: print("FAIL file tạm của eval nằm trong git repo front (" + os.path.abspath(repo) + "): " + "; ".join(msg)); sys.exit(1)
print("PASS repo front không chứa file tạm của eval (__t0NN*, __nonce-*)")
