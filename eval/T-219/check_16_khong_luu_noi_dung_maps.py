#!/usr/bin/env python3
"""T-219 tiêu chí 16 (offline): không lưu nội dung Maps ngoài trường cần đo. Google giả cố ý trả THỪA mọi phản hồi (vị trí 10.123456/106.654321, điện thoại +84 909 000 111,
website sentinel-site.example, review REVIEWTEXT-SENTINEL).
 - không file nào CLI tạo (kể cả log = stdout qua tee, private/, public/) chứa các chuỗi đó, ở stdout cũng không;
 - public/ chỉ gồm p0-report.json, p0-report.md; private/ chỉ gồm queries.json, duplicates.csv, candidates.csv, samples.csv, enrich.jsonl, compare.json;
 - public/ và log KHÔNG chứa tên, địa chỉ hay place_id của place/vendor nào (chỉ số tổng hợp);
 - header candidates.csv/duplicates.csv đúng danh sách cột cho phép (place_id, name, address, business_status, types, rating, user_rating_count … không thêm trường Maps khác)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
files, removed, fx, meta = k.world()
r = k.Root(files, removed)
before = r.all_files()
rc, out, calls = r.run(k.std_args(), fx, run_id="41")
new = [f for f in r.all_files() if f not in before]
text = {f: open(os.path.join(r.path, f), "rb").read().decode("utf-8", "replace") for f in new}
for f, t in list(text.items()) + [("stdout", out)]:
    for s in k.SENTINELS:
        if s in t:
            bad.append("%s chứa nội dung Maps không cần đo (%s)" % (f, s))
pub = sorted(os.path.basename(f) for f in new if "/public/" in f.replace(os.sep, "/"))
prv = sorted(os.path.basename(f) for f in new if "/private/" in f.replace(os.sep, "/"))
if pub != ["p0-report.json", "p0-report.md"]:
    bad.append("public/ phải chỉ gồm p0-report.json, p0-report.md; thấy %r" % pub)
if prv != sorted(["queries.json", "duplicates.csv", "candidates.csv", "samples.csv", "enrich.jsonl", "compare.json"]):
    bad.append("private/ phải gồm đúng 6 file của spec; thấy %r" % prv)
ID = re.compile(r"(?<![A-Za-z0-9])P\d{3}(?![A-Za-z0-9])|PE1|PV1|PR1|PD2|PR2")
for f, t in text.items():
    fn = f.replace(os.sep, "/")
    if "/public/" in fn or fn.startswith("run-logs/"):
        for pat in ("Xe hoa Mẫu", "Garage sửa xe", "Studio Ảnh", "Địa điểm Mẫu", "Đường Mẫu", "Xe Cưới Hoàng Gia", "Nhà hàng Gold", "Đường Tiệc", "Thuê xe hoa An Phát", "Đã Gỡ", "Minh Tâm"):
            if pat in t:
                bad.append("%s chứa tên/địa chỉ vendor (%r): chỉ số tổng hợp thôi" % (fn, pat))
        if ID.search(t):
            bad.append("%s chứa place_id/vendor id" % fn)
HEAD = {"candidates.csv": ["place_id", "name", "address", "business_status", "types", "ai_is_wedding_vendor", "ai_category", "ai_reason", "details_status", "rating", "user_rating_count", "qualified"],
        "duplicates.csv": ["place_id", "name", "address", "reason"]}
for fn, want in HEAD.items():
    p = os.path.join(r.path, "p0-out/t/private", fn)
    got = open(p, encoding="utf-8-sig").readline().strip().split(",") if os.path.exists(p) else None
    if got != want:
        bad.append("%s header %r, kỳ vọng %r" % (fn, got, want))
k.done(bad, "không lưu vị trí/điện thoại/website/review của Maps; public/ chỉ số tổng hợp; private/ chỉ 6 file và cột cho phép")
