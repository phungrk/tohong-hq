#!/usr/bin/env python3
"""Nguồn: T-075 (adversary, Code Gate 2026-11-06; eval gốc eval/T-075/adv-01-pool-trung-gian-khong-vao-git.py). Spec products/T-073-tag-minimalist-tinh-te.md
  đoạn "Thứ tự bên trong lệnh": output/pool-vendors.json là file trung gian, không commit.
Bất biến (planner/vendor/pool): tools/scraper/output/pool-vendors.json của repo tohong KHÔNG được git theo dõi. Lý do cho cả vùng:
  (1) file mang giá theo dữ liệu scrape, lệch pool ở 36 vendor (ADR-025, insights/2026-11-06-lech-gia-scrape-vs-pool.md); nằm trong git thì
      `node tools/generate-vendor-pool.js` (mặc định --in chính file này) sinh lại pool toàn phần với giá lệch mà không ai thấy;
  (2) file có generated_at nên mỗi lần chạy tools/regen-pool-styles.sh làm bẩn cây git dù dữ liệu không đổi.
  Pool đã commit nằm ở tohong-back/lib/vendorPool.generated.js; nguồn sự thật là tools/scraper/output/HCMC/*/vendors.json.
  Muốn đổi (vd quyết định commit file trung gian) phải qua Chief of Staff và ghi decisions/.
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong). Thiếu repo: PASS 'chưa áp dụng' (như các bất biến pool khác)."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
t = None
for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")):
    if c and os.path.isdir(os.path.join(c, "tools", "scraper")): t = os.path.abspath(c); break
if not t: print("PASS chưa áp dụng (không tìm thấy repo tohong)"); sys.exit(0)
REL = "tools/scraper/output/pool-vendors.json"
if subprocess.run(["git", "-C", t, "ls-files", "--error-unmatch", REL], capture_output=True).returncode == 0:
    print("FAIL %s đang được git theo dõi trong %s (file trung gian; xem docstring)" % (REL, t)); sys.exit(1)
print("PASS")
