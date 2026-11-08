#!/usr/bin/env python3
"""T-106 tiêu chí 5: vendor khớp sai vào review-needed.csv, không vào pool; mọi place_id venue qua luật nhận khớp.
Eval chỉ tin dữ liệu KHÔNG do code đang kiểm sinh ra: địa chỉ vendor gốc lấy từ eval/T-106/venue_address_snapshot.json (marry.vn, tohong@46b6bc4), địa chỉ Google từ
formatted_address (đầu vào của luật, không có nguồn độc lập), address_match TÍNH LẠI bằng _common.address_match. Cờ address_match/status code ghi chỉ được so, không được tin.
Luật nhận khớp: confidence >= 0.6, hoặc confidence >= 0.4 VÀ address_match == true.
LUẬT STATUS: mọi dòng audit có ứng viên Google (matched_name hoặc confidence > 0) mà luật từ chối PHẢI có status = "low_confidence" VÀ một dòng review-needed.csv (flags chứa
low_confidence_place, có google_matched_name, google_confidence), không place_id, không ảnh google trong pool. Dòng được luật nhận phải có place_id (trừ vendor đã vào removed_vendors.json).
Dòng "no_match" không được có matched_name/confidence. Mọi status khác ngoài {low_confidence, ok, enriched, no_match} chỉ được dùng khi không có ứng viên.
Đỏ khi: (0) hàm lệch address_pairs.json; (a) chưa có audit; (b) vendor pool venue chưa được thử; (c) contact.address_source thiếu hoặc KHÁC snapshot gốc (vendor có audit hoặc place_id);
(d) status lệch luật (kể cả no_match/skip/rejected mà có ứng viên bị từ chối); (e) thiếu dòng/cột review; (f) có place_id/ảnh google dù bị từ chối; (g) cờ address_match lệch tính lại;
(h) place_id venue không qua luật. Cần: TOHONG_REPO, TOHONG_BACK_REPO. Không gọi Google."""
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
    """Địa chỉ gốc do code khai (contact.address_source); chỉ để so với snapshot, không dùng để tính nếu khác snapshot."""
    for rec in recs.get(i, []):
        s = (rec.get("contact") or {}).get("address_source")
        if s:
            return s
    return None


snap = c.load_address_snapshot()


def tinh_lai(i, fa, where):
    """Trả address_match tính từ ĐỊA CHỈ GỐC TRONG SNAPSHOT; đỏ nếu code khai address_source khác snapshot."""
    src = source_address(i)
    if i not in snap:
        c.fail("%s (%s) không có trong venue_address_snapshot.json: vendor venue mới? cần chụp lại snapshot có lý do" % (i, where))
    if not src:
        c.fail("%s (%s): thiếu contact.address_source trong vendors.json" % (i, where))
    if src.strip() != snap[i].strip():
        c.fail("%s (%s): contact.address_source %r khác địa chỉ marry.vn gốc %r (snapshot @46b6bc4): đã bị ghi đè hoặc ghi sai thứ tự" % (i, where, src[:50], snap[i][:50]))
    if not fa:
        c.fail("%s (%s): thiếu formatted_address Google" % (i, where))
    return c.address_match(snap[i], fa)


low = 0
for i, a in last.items():
    if i not in recs:
        continue
    st, cand = a.get("status"), c.has_candidate(a)
    if not cand:
        if st == "low_confidence":
            c.fail("%s: status low_confidence nhưng không có matched_name/confidence" % i)
        continue
    if st == "no_match":
        c.fail("%s: status no_match nhưng có ứng viên Google (matched_name=%r, confidence=%s): no_match chỉ dành cho Google không trả gì" % (i, a.get("matched_name"), a.get("confidence")))
    am = tinh_lai(i, a.get("formatted_address"), "audit")
    if a.get("address_match") is not None and a.get("address_match") is not am:
        c.fail("%s: audit ghi address_match=%s nhưng tính lại từ địa chỉ gốc và %r = %s" % (i, a.get("address_match"), (a.get("formatted_address") or "")[:40], am))
    accepted = c.accept_match(a.get("confidence"), am)
    if not accepted:
        low += 1
        if st != "low_confidence":
            c.fail("%s: luật từ chối (confidence %.2f, address_match tính lại = %s) nhưng audit ghi status=%r thay vì low_confidence" % (i, a.get("confidence") or 0, am, st))
        r = rows.get(i)
        if not r or "low_confidence_place" not in (r.get("flags") or "").split("|"):
            c.fail("%s bị từ chối (khớp '%s', %.2f) nhưng review-needed.csv không có dòng với flags chứa low_confidence_place" % (i, a.get("matched_name"), a.get("confidence") or 0))
        if not (r.get("google_matched_name") or "").strip() or not (r.get("google_confidence") or "").strip():
            c.fail("%s: dòng review-needed.csv thiếu google_matched_name hoặc google_confidence (admin không có gì để so)" % i)
        for rec in recs.get(i, []):
            if c.google_log(rec) or rec.get("google_photos"):
                c.fail("%s bị từ chối nhưng vendors.json đã có place_id/google_photos" % i)
        if i in pool and c.google_photos_of(pool[i]):
            c.fail("%s bị từ chối nhưng pool có ảnh source=google" % i)
    else:
        if st not in ("ok", "enriched"):
            c.fail("%s: luật chấp nhận (confidence %.2f, address_match tính lại = %s) nhưng audit status=%r" % (i, a.get("confidence") or 0, am, st))
        if i not in gone and not c.record_google_log(recs.get(i)):
            c.fail("%s: luật chấp nhận nhưng vendors.json không có place_id" % i)
n = 0
for v in venues:
    e = c.record_google_log(recs.get(v["id"]))
    if not e or v["id"] in gone:
        continue
    n += 1
    am = tinh_lai(v["id"], e.get("formatted_address"), "enrichment_log")
    if "address_match" in e and e["address_match"] is not am:
        c.fail("%s: enrichment_log ghi address_match=%s nhưng tính lại = %s" % (v["id"], e["address_match"], am))
    if not c.accept_match(e.get("confidence"), am):
        c.fail("%s có place_id nhưng không qua luật nhận khớp (confidence %.2f, address_match tính lại = %s)" % (v["id"], e.get("confidence") or 0, am))
c.ok("%d vendor bị luật từ chối đều status low_confidence + có dòng review, không vào pool; %d place_id venue qua luật nhận khớp (địa chỉ gốc đối chiếu snapshot marry.vn)" % (low, n))
