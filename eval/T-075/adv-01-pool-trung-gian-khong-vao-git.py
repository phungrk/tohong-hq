#!/usr/bin/env python3
"""T-075 tầng 3 (adversary). Spec products/T-073-tag-minimalist-tinh-te.md, mục Hành vi, đoạn "Thứ tự bên trong lệnh":
  `build_pool.py --out output/pool-vendors.json` (trung gian, KHÔNG commit). Brief T-075 nhắc lại: "không commit file trung gian
  tools/scraper/output/pool-vendors.json".
Kiểm: trong repo tohong (TOHONG_REPO, mặc định ../tohong) file tools/scraper/output/pool-vendors.json KHÔNG được git theo dõi
  (git ls-files rỗng). Lý do bất biến: file này chứa giá theo dữ liệu scrape (36 vendor lệch giá so với pool, ADR-025); nếu nằm trong git,
  `node tools/generate-vendor-pool.js` mặc định đọc nó và sinh lại pool toàn phần với giá lệch.
Chạy: python3 -I eval/T-075/adv-01-pool-trung-gian-khong-vao-git.py. In PASS hoặc FAIL <lý do>."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
t = None
for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")):
    if c and os.path.isdir(os.path.join(c, "tools", "scraper")): t = os.path.abspath(c); break
if not t: print("FAIL không tìm thấy repo tohong (đặt TOHONG_REPO)"); sys.exit(1)
REL = "tools/scraper/output/pool-vendors.json"
r = subprocess.run(["git", "-C", t, "ls-files", "--error-unmatch", REL], capture_output=True, text=True)
if r.returncode == 0:
    print("FAIL %s đang được git theo dõi trong %s (file trung gian, spec T-073: không commit)" % (REL, t)); sys.exit(1)
print("PASS")
