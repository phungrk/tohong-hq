#!/usr/bin/env python3
"""T-106 tiêu chí 5: vendor khớp sai (low_confidence) vào review-needed.csv, không vào pool; mọi place_id venue qua luật nhận khớp.
address_match KHÔNG đọc từ cờ code tự ghi: eval TÍNH LẠI bằng _common.address_match(contact.address_source, formatted_address) (định nghĩa chuẩn ở Hành vi 3 của spec).
Dữ liệu (tohong/tools/scraper/output/HCMC/venue/): vendors.json (contact.address_source = địa chỉ marry.vn gốc; enrichment_log[google_maps].formatted_address), enrichment-audit.json
({vendor_id,status,confidence,matched_name,formatted_address,address_match}), review-needed.csv; pool tohong-back.
Luật nhận khớp: confidence >= 0.6, hoặc confidence >= 0.4 VÀ address_match (tính lại) == true. Không đạt <=> audit status = "low_confidence".
Đỏ khi: (0) hàm address_match lệch bảng eval/T-106/address_pairs.json; (a) chưa có audit; (b) vendor pool venue chưa được thử (không place_id, không dòng audit);
(c) low_confidence mà csv thiếu dòng/flags low_confidence_place/google_matched_name/google_confidence; (d) low_confidence mà có place_id/google_photos hoặc ảnh google trong pool;
(e) vendor có place_id nhưng thiếu address_source/formatted_address, hoặc không qua luật nhận khớp với address_match TÍNH LẠI; (f) cờ address_match đã ghi lệch giá trị tính lại;
(g) trạng thái audit lệch luật (status ok mà luật từ chối, hoặc low_confidence mà luật chấp nhận). Cần: TOHONG_REPO, TOHONG_BACK_REPO. Không gọi Google."""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
here = os.path.dirname(os.path.abspath(__file__))
for p in json.load(open(os.path.join(here, "address_pairs.json"), encoding="utf-8"))["pairs"]:
    if c.address_match(p["vendor"], p["google"]) is not p["expected"]:
        c.fail("hàm address_match lệch bảng address_pairs.json: %r vs %r (mong %s: %s)" % (p["vendor"][:50], p["google"][:50], p["expected"], p["why"]))
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
last = {}
for a in audit:
    last[a.get("vendor_id")] = a
untried = [v["id"] for v in venues if v["id"] not in gone and not c.record_google_log(recs.get(v["id"])) and v["id"] not in last]
if untried:
    c.fail("%d vendor venue chưa được thử enrich (không place_id, không có trong audit), vd %s" % (len(untried), untried[0]))
cp = os.path.join(vd, "review-needed.csv")
rows = {}
if os.path.isfile(cp):
    for r in csv.DictReader(open(cp, encoding="utf-8-sig", newline="")):
        rows[(r.get("id") or "").strip()] = r
pool = {v["id"]: v for v in venues}


def source_address(i):
    for rec in recs.get(i, []):
        s = (rec.get("contact") or {}).get("address_source")
        if s:
            return s
    return None


low = 0
for i, a in last.items():
    if i not in recs:
        continue
    src, fa = source_address(i), a.get("formatted_address")
    if not src or not fa:
        c.fail("%s: thiếu contact.address_source (vendors.json) hoặc formatted_address (audit): không tính lại được address_match" % i)
    am = c.address_match(src, fa)
    if a.get("address_match") is not None and a.get("address_match") is not am:
        c.fail("%s: audit ghi address_match=%s nhưng tính lại từ %r và %r = %s" % (i, a.get("address_match"), src[:40], fa[:40], am))
    accepted = c.accept_match(a.get("confidence"), am)
    if a.get("status") == "low_confidence":
        low += 1
        if accepted:
            c.fail("%s: audit low_confidence nhưng luật nhận khớp chấp nhận (confidence %.2f, address_match tính lại = %s)" % (i, a.get("confidence") or 0, am))
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
    elif a.get("status") in ("ok", "enriched") and not accepted:
        c.fail("%s: audit status=%s nhưng luật nhận khớp từ chối (confidence %.2f, address_match tính lại = %s)" % (i, a.get("status"), a.get("confidence") or 0, am))
n = 0
for v in venues:
    e = c.record_google_log(recs.get(v["id"]))
    if not e or v["id"] in gone:
        continue
    n += 1
    src, fa = source_address(v["id"]), e.get("formatted_address")
    if not src or not fa:
        c.fail("%s có place_id nhưng thiếu contact.address_source hoặc enrichment_log.formatted_address" % v["id"])
    am = c.address_match(src, fa)
    if "address_match" in e and e["address_match"] is not am:
        c.fail("%s: enrichment_log ghi address_match=%s nhưng tính lại = %s (%r vs %r)" % (v["id"], e["address_match"], am, src[:40], fa[:40]))
    if not c.accept_match(e.get("confidence"), am):
        c.fail("%s có place_id nhưng không qua luật nhận khớp (confidence %.2f, address_match tính lại = %s)" % (v["id"], e.get("confidence") or 0, am))
c.ok("%d low_confidence đều vào review-needed.csv, không vào pool; %d place_id venue qua luật nhận khớp với address_match tính lại" % (low, n))
