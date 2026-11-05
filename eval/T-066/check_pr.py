#!/usr/bin/env python3
"""Eval tiêu chí 8 của T-066: ảnh 390px TRƯỚC và SAU cho cả 6 bề mặt đã commit vào repo front và nhúng trong mô tả PR.
Chạy: cd /home/user/tohong-hq && python3 eval/T-066/check_pr.py <tohong-front> [--pr N]
Không có --pr: tự tìm PR theo TÊN NHÁNH t-066-anh-minh-hoa qua REST `gh api` (GraphQL bị chặn ở phiên cloud, ADR-020), không phụ thuộc nhánh đang checkout.
Ảnh: docs/screenshots/T-066/<bề-mặt>-390-<truoc|sau>.png, bề-mặt in: s1-danh-sach, s2-chi-tiet, s3-chon-so-sanh, s4-bang-so-sanh, s5-vendor-da-luu, s6-ngan-sach-chi-tiet.
Thêm docs/screenshots/T-066/contact-sheet.png (10 minh hoạ kèm tên hạng mục, do `run.sh --only 1 --shots <thư-mục> --tag sau` sinh ra) để người duyệt nhận ra hạng mục.
Điều kiện: đủ 13 file (12 ảnh + contact sheet), được git theo dõi, đã commit, là PNG rộng 390/780/1170 px, và mô tả PR nhúng cả 12 (markdown ![](…tên-file) hoặc <img …tên-file>).
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import json, struct, subprocess, sys, re, os

BRANCH = "t-066-anh-minh-hoa"
R = "phungrk/tohong-front"
SURF = ["s1-danh-sach", "s2-chi-tiet", "s3-chon-so-sanh", "s4-bang-so-sanh", "s5-vendor-da-luu", "s6-ngan-sach-chi-tiet"]

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

code, out, _ = run(["git", "ls-files", "docs/screenshots/T-066"], repo)
if code != 0:
    fail("không chạy được git ls-files")
tracked = {os.path.basename(f): f for f in out.split() if f.lower().endswith(".png")}
need = [f"{s}-390-{k}.png" for s in SURF for k in ("truoc", "sau")] + ["contact-sheet.png"]
missing = [n for n in need if n not in tracked]
if missing:
    fail("thiếu ảnh được git theo dõi trong docs/screenshots/T-066/: " + ", ".join(missing[:4]) + (" …" if len(missing) > 4 else ""))
for n in need:
    with open(os.path.join(repo, tracked[n]), "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        fail(f"{n} không phải PNG")
    w = struct.unpack(">I", head[16:20])[0]
    if n != "contact-sheet.png" and w not in (390, 780, 1170):
        fail(f"{n} rộng {w}px, cần 390/780/1170")
code, out, err = run(["git", "diff", "--quiet", "HEAD", "--"] + [tracked[n] for n in need], repo)
if code != 0:
    fail("ảnh có thay đổi chưa commit")

cmd = ["gh", "api", f"repos/{R}/pulls/{pr}"] if pr else ["gh", "api", f"repos/{R}/pulls?head=phungrk:{BRANCH}&state=all"]
code, out, err = run(cmd, repo)
if code != 0:
    fail("chưa có PR (hoặc gh lỗi): " + (err.strip().splitlines() or ["?"])[-1])
data = json.loads(out)
if isinstance(data, list):
    if not data:
        fail(f"chưa có PR cho nhánh {BRANCH}")
    data = data[0]
body = data.get("body") or ""
notin = [n for n in need if not (re.search(r"!\[[^\]]*\]\([^)]*" + re.escape(n) + r"[^)]*\)", body) or re.search(r"<img[^>]+" + re.escape(n), body))]
if notin:
    fail("mô tả PR chưa nhúng: " + ", ".join(notin[:4]) + (" …" if len(notin) > 4 else ""))
print("PASS")
