#!/usr/bin/env python3
"""Eval đối kháng tầng 3 T-116 (adversary). Bỏ chữ "Ảnh minh hoạ" không được kéo theo mất ghi công ảnh Google
(Terms Google, spec 005 FR-002, INV-013 vendor/images). Đo trên diff của nhánh so với điểm rẽ khỏi origin/main:
không có dòng bị xoá (không được thêm lại y hệt) chứa Google / attribution / credit / PhotoCredit / "Ảnh:" trong src.
Repo front: tham số 1, rồi TOHONG_FRONT_REPO, rồi cwd nếu là tohong-front (gate.py --cwd), rồi /home/user/tohong-front. Không có origin/main: FAIL. Mã thoát 0 = đạt."""
import os, re, subprocess, sys

_cwd = os.getcwd()
repo = ((sys.argv[1] if len(sys.argv) > 1 else None) or os.environ.get("TOHONG_FRONT_REPO")
        or (_cwd if os.path.isfile(os.path.join(_cwd, "src", "vendorIllustrations.jsx")) else "/home/user/tohong-front"))
def git(*a):
    return subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True)
mb = git("merge-base", "HEAD", "origin/main")
if mb.returncode: print("FAIL không tìm được điểm rẽ với origin/main: %s" % mb.stderr.strip()); sys.exit(1)
d = git("diff", "--unified=0", mb.stdout.strip(), "HEAD", "--", "src")
if d.returncode: print("FAIL git diff: %s" % d.stderr.strip()); sys.exit(1)
pat = re.compile(r"google|attribution|credit|PhotoCredit|Ảnh:\s", re.I)
rem = [l[1:].strip() for l in d.stdout.splitlines() if l.startswith("-") and not l.startswith("---")]
add = {l[1:].strip() for l in d.stdout.splitlines() if l.startswith("+") and not l.startswith("+++")}
lost = [l for l in rem if pat.search(l) and l not in add]
if lost:
    print("FAIL nhánh xoá dòng liên quan ghi công ảnh Google:"); [print("  " + x[:160]) for x in lost[:10]]; sys.exit(1)
print("PASS nhánh không xoá dòng ghi công/Google nào trong src (%d dòng xoá đã xét)" % len(rem))
