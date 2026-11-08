#!/usr/bin/env python3
"""T-106 tiêu chí 3: tổng request SKU Photos của tháng <= 1.000 và Text Search <= $5, đo bằng LOG của các lần chạy thật.
Log: mỗi lần chạy thật của enrich.py / refresh_photos.py lưu stdout vào $T106_LOG_DIR (mặc định $TOHONG_REPO/tools/scraper/run-logs/T-106/)
với tên bắt đầu YYYYMMDD (vd 20261108-enrich-venue.log). Dòng đọc được:
  GOOGLE_USAGE text_search=<n> photo_details=<n> photo_media=<n>     (enrich.py và refresh_photos.py PHẢI in đúng một dòng cuối lần chạy thật)
  RESULT ... requests=<n> (details=<a>, media=<b>)                  (dòng cũ của refresh_photos.py; dùng khi log không có GOOGLE_USAGE)
Log của lần --dry-run (có "DRY RUN") tính 0. Log không có dòng nào ở trên và không phải dry-run => đỏ (không đo được).
Tính: baseline (T106_PHOTOS_BASELINE, mặc định 606) + SUM(photo_details + photo_media) <= 1000 (đếm cả Place Details để chặn trên: 606 khớp 3 lần x 202 request gồm details);
      SUM(text_search) x $0,04 <= $5,00 ($0,04 = giá cao nhất Enterprise+Atmosphere; chặn trên, chưa trừ hạn mức miễn phí). Log chứa chuỗi giống khóa Google (AIza...) => đỏ.
Giới hạn: hóa đơn thật nằm ở Google Cloud console, agent không đọc được; đây là phép đo thay thế từ log. Capu đối chiếu console sau lần chạy (ghi trong bàn giao)."""
import glob, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
CAP_PHOTOS, CAP_USD, USD_PER_SEARCH = 1000, 5.0, 0.04
month = os.environ.get("T106_MONTH", "2026-11")
base = int(os.environ.get("T106_PHOTOS_BASELINE", "606"))
d = os.environ.get("T106_LOG_DIR") or os.path.join(c.tohong(), "tools", "scraper", "run-logs", "T-106")
logs = sorted(glob.glob(os.path.join(d, "*.log")))
if not logs:
    c.fail("chưa có log chạy thật trong %s (lưu stdout mỗi lần chạy enrich/refresh vào đó, tên bắt đầu YYYYMMDD)" % d)
prefix = month.replace("-", "")
photos = searches = used = 0
KEY = re.compile(r"AIza[0-9A-Za-z_\-]{35}")
for f in logs:
    name = os.path.basename(f)
    text = open(f, encoding="utf-8", errors="replace").read()
    if KEY.search(text):
        c.fail("%s chứa chuỗi giống khóa API Google (AIza...)" % name)
    if not name.startswith(prefix):
        continue
    u = re.findall(r"^GOOGLE_USAGE\s+(.*)$", text, re.M)
    if u:
        kv = dict(re.findall(r"(\w+)=(\d+)", u[-1]))
        searches += int(kv.get("text_search", 0)); photos += int(kv.get("photo_details", 0)) + int(kv.get("photo_media", 0)); used += 1
        continue
    r = re.findall(r"^RESULT .*?requests=(\d+) \(details=(\d+), media=(\d+)\)", text, re.M)
    if r:
        photos += int(r[-1][1]) + int(r[-1][2]); used += 1
        continue
    if "DRY RUN" in text:
        continue
    c.fail("%s không có dòng GOOGLE_USAGE hoặc RESULT và không phải dry-run: không đo được request" % name)
if used == 0:
    c.fail("không có log chạy thật nào của tháng %s trong %s" % (month, d))
total, usd = base + photos, round(searches * USD_PER_SEARCH, 2)
if total > CAP_PHOTOS:
    c.fail("request SKU Photos tháng %s = %d (baseline %d + T-106 %d) > %d" % (month, total, base, photos, CAP_PHOTOS))
if usd > CAP_USD:
    c.fail("Text Search %d lượt x $%.2f = $%.2f > $%.2f" % (searches, USD_PER_SEARCH, usd, CAP_USD))
c.ok("Photos %d <= %d (baseline %d + %d); Text Search %d lượt <= $%.2f (%d log chạy thật)" % (total, CAP_PHOTOS, base, photos, searches, usd, used))
