#!/usr/bin/env python3
"""T-106 tiêu chí 5: vendor khớp sai (confidence thấp) vào review-needed.csv, không vào pool.
Dữ liệu (tohong/tools/scraper/output/HCMC/venue/): enrichment-audit.json (enrich.py ghi), review-needed.csv, vendors.json; pool tohong-back.
Luật nhận khớp (hợp đồng): bản ghi enrichment_log có place_id chỉ hợp lệ khi confidence >= 0.6, hoặc confidence >= 0.4 VÀ address_match == true
(address_match = địa chỉ Google và địa chỉ vendor cùng quận/huyện; enrich.py ghi trường này vào enrichment_log). Không đạt => audit status = "low_confidence".
Đỏ khi: (a) chưa có audit (enrich venue chưa chạy); (b) vendor nào của pool venue không có place_id mà cũng không có dòng trong audit (chưa được thử);
(c) audit low_confidence mà csv không có dòng id đó với flags chứa low_confidence_place, hoặc dòng thiếu google_matched_name / google_confidence;
(d) vendor low_confidence có place_id / google_photos trong vendors.json hoặc ảnh source=google trong pool;
(e) vendor venue có place_id trong vendors.json nhưng không qua luật nhận khớp. Cần: TOHONG_REPO, TOHONG_BACK_REPO. Không gọi Google."""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
t, b = c.tohong(), c.back()
vd = os.path.join(t, c.VENUE_DIR)
ap = os.path.join(vd, "enrichment-audit.json")
if not os.path.isfile(ap):
    c.fail("chưa có %s: enrich venue chưa chạy" % os.path.relpath(ap, t))
audit = json.load(open(ap, encoding="utf-8"))
if not isinstance(audit, list) or not audit:
    c.fail("enrichment-audit.json rỗng hoặc không phải danh sách")
venues = c.venue_pool(c.load_pool(b))
recs, gone = c.load_records(t), c.removed_ids(t)
audited = {a.get("vendor_id") for a in audit}
untried = [v["id"] for v in venues if v["id"] not in gone and not c.record_google_log(recs.get(v["id"])) and v["id"] not in audited]
if untried:
    c.fail("%d vendor venue chưa được thử enrich (không place_id, không có trong audit), vd %s" % (len(untried), untried[0]))
cp = os.path.join(vd, "review-needed.csv")
rows = {}
if os.path.isfile(cp):
    for r in csv.DictReader(open(cp, encoding="utf-8-sig", newline="")):
        rows[(r.get("id") or "").strip()] = r
pool = {v["id"]: v for v in venues}
low = [a for a in audit if a.get("status") == "low_confidence"]
for a in low:
    i = a.get("vendor_id")
    r = rows.get(i)
    if not r or "low_confidence_place" not in (r.get("flags") or "").split("|"):
        c.fail("%s là low_confidence (khớp '%s', %.2f) nhưng review-needed.csv không có dòng với flags chứa low_confidence_place" % (i, a.get("matched_name"), a.get("confidence") or 0))
    if not (r.get("google_matched_name") or "").strip() or not (r.get("google_confidence") or "").strip():
        c.fail("%s: dòng review-needed.csv thiếu google_matched_name hoặc google_confidence (admin không có gì để so)" % i)
    for rec in recs.get(i, []):
        if c.google_log(rec) or rec.get("google_photos"):
            c.fail("%s là low_confidence nhưng vendors.json đã có place_id/google_photos" % i)
    if i in pool and c.google_photos_of(pool[i]):
        c.fail("%s là low_confidence nhưng pool có ảnh source=google" % i)
bad = []
for v in venues:
    e = c.record_google_log(recs.get(v["id"]))
    if not e or v["id"] in gone:
        continue
    conf = e.get("confidence") or 0
    if not (conf >= 0.6 or (conf >= 0.4 and e.get("address_match") is True)):
        bad.append((v["id"], conf, e.get("address_match")))
if bad:
    c.fail("%d vendor venue có place_id nhưng không qua luật nhận khớp (confidence>=0.6 hoặc >=0.4 + address_match=true), vd %s" % (len(bad), bad[0]))
c.ok("%d low_confidence đều vào review-needed.csv, không vào pool; mọi place_id venue qua luật nhận khớp" % len(low))
