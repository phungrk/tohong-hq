#!/usr/bin/env python3
"""Eval tiêu chí 7 của T-048: có ảnh chụp 390px màn chi tiết hạng mục, đã commit vào repo front và nhúng trong mô tả PR.
Chạy: python3 eval/T-048/check_pr.py <tohong-front> [--pr N]   (không có --pr: PR của nhánh hiện tại, qua `gh pr view`)
Ảnh: docs/screenshots/T-048/*390*.png, được git theo dõi ở HEAD, rộng 390/780/1170 px. PR body phải có ảnh markdown trỏ tới đúng tên file đó.
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import json, struct, subprocess, sys, re, os

def fail(msg):
    print("FAIL " + msg); sys.exit(1)

def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr

args = sys.argv[1:]
if not args or not os.path.isfile(os.path.join(args[0], "package.json")):
    fail("cần đường dẫn tohong-front làm tham số đầu tiên")
repo = args[0]
pr = args[args.index("--pr") + 1] if "--pr" in args else None

code, out, _ = run(["git", "ls-files", "docs/screenshots/T-048"], repo)
if code != 0:
    fail("không chạy được git ls-files")
shots = [f for f in out.split() if f.lower().endswith(".png") and "390" in os.path.basename(f)]
if not shots:
    fail("chưa có docs/screenshots/T-048/*390*.png được git theo dõi trong tohong-front")
good = []
for f in shots:
    with open(os.path.join(repo, f), "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        continue
    w = struct.unpack(">I", head[16:20])[0]
    if w in (390, 780, 1170):
        good.append(f)
if not good:
    fail("ảnh *390*.png không phải PNG rộng 390/780/1170 px: " + ", ".join(shots))

code, out, err = run(["git", "diff", "--quiet", "HEAD", "--"] + good, repo)
if code != 0:
    fail("ảnh có thay đổi chưa commit")

cmd = ["gh", "pr", "view"] + ([pr] if pr else []) + ["--json", "body"]
code, out, err = run(cmd, repo)
if code != 0:
    fail("chưa có PR (hoặc gh lỗi): " + (err.strip().splitlines() or ["?"])[-1])
body = json.loads(out).get("body") or ""
names = [os.path.basename(f) for f in good]
if not any(re.search(r"!\[[^\]]*\]\([^)]*" + re.escape(n) + r"[^)]*\)", body) or re.search(r"<img[^>]+" + re.escape(n), body) for n in names):
    fail("mô tả PR không nhúng ảnh nào trong: " + ", ".join(names))
print("PASS")
