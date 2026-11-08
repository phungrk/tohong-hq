#!/usr/bin/env python3
"""T-106 eval đối kháng 01 (adversary, Code Gate T-108): ứng viên được luật nhận nhưng Google báo nhà hàng ĐÓNG CỬA.
Nguồn mong đợi: decisions/2026-11-08-adr-044-nha-hang-dong-cua-tren-google.md (ADR-044, Chief of Staff phân xử 2026-11-08: spec T-106
không nói về đóng cửa; ADR-044 thắng bản v1 của eval này, vốn đòi status ok/enriched cho cả hai ca).
Input: chạy enrich.py như workflow (--state HCMC --category venue) trên output tạm, 2 vendor venue cùng địa chỉ marry.vn kiểu "12 Lê Lợi, Quận 1";
Text Search trả 1 place cùng tên (confidence 1,0), formattedAddress cùng số nhà + đường, businessStatus:
  - "Nha hang Hoa Sen" -> CLOSED_PERMANENTLY; "Nha hang Hoa Mai" -> CLOSED_TEMPORARILY.
Mong đợi (ADR-044):
  1. CLOSED_PERMANENTLY: gỡ khỏi vendors.json (nên không vào pool), có trong removed_vendors.json cùng thư mục; audit status=closed_permanently
     kèm place_id + formatted_address; không có dòng trong review-needed.csv.
  2. CLOSED_TEMPORARILY: nhận khớp bình thường: còn trong vendors.json, enrichment_log google_maps có place_id, flag temporarily_closed=true;
     audit status ok/enriched có place_id + formatted_address.
HTTP giả, KHÔNG gọi Google. Cần TOHONG_REPO (mặc định ../tohong)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
import _adv_harness as h

perm = h.vendor("adv01p", "Nha hang Hoa Sen", "12 Lê Lợi, Quận 1")
temp = h.vendor("adv01t", "Nha hang Hoa Mai", "34 Lê Lợi, Quận 1")
places = {
    "Nha hang Hoa Sen": [h.place("pid_adv01p", "Nha hang Hoa Sen", "12 Lê Lợi, Phường Bến Thành, Hồ Chí Minh", "CLOSED_PERMANENTLY")],
    "Nha hang Hoa Mai": [h.place("pid_adv01t", "Nha hang Hoa Mai", "34 Lê Lợi, Phường Bến Thành, Hồ Chí Minh", "CLOSED_TEMPORARILY")],
}
for v, ps in ((perm, places["Nha hang Hoa Sen"]), (temp, places["Nha hang Hoa Mai"])):
    if not c.accept_match(1.0, c.address_match(v["contact"]["address"], ps[0]["formattedAddress"])):
        c.fail("fixture hỏng: luật lẽ ra phải nhận %s" % v["id"])

root = h.make_root({"venue": [perm, temp]})
rc, out, _ = h.run_enrich(root, places)
bad = []
ids = h.all_ids(root)
au = h.audit(root)
rv = h.review_ids(root)

# 1. CLOSED_PERMANENTLY
if "adv01p" in ids:
    bad.append("CLOSED_PERMANENTLY: vendor còn trong vendors.json (%s)" % ids["adv01p"])
if ("venue", "adv01p") not in h.removed(root):
    bad.append("CLOSED_PERMANENTLY: không có trong venue/removed_vendors.json")
a = au.get("adv01p") or {}
if a.get("status") != "closed_permanently" or a.get("place_id") != "pid_adv01p" or not a.get("formatted_address"):
    bad.append("CLOSED_PERMANENTLY audit: status=%r place_id=%r formatted_address=%r"
               % (a.get("status"), a.get("place_id"), a.get("formatted_address")))
if "adv01p" in rv:
    bad.append("CLOSED_PERMANENTLY: có dòng trong review-needed.csv (flags=%r)" % rv["adv01p"].get("flags"))

# 2. CLOSED_TEMPORARILY
recs = h.vendors_in(root, "venue")
t = next((v for v in recs if v["id"] == "adv01t"), None)
if t is None:
    bad.append("CLOSED_TEMPORARILY: vendor bị gỡ khỏi vendors.json")
else:
    if not any(e.get("source") == "google_maps" and e.get("place_id") == "pid_adv01t" for e in t.get("enrichment_log") or []):
        bad.append("CLOSED_TEMPORARILY: enrichment_log không có place_id")
    if t.get("temporarily_closed") is not True:
        bad.append("CLOSED_TEMPORARILY: thiếu flag temporarily_closed=true")
    if t.get("verification_status") == "deprecated":
        bad.append("CLOSED_TEMPORARILY: vendor bị đặt deprecated")
a = au.get("adv01t") or {}
if a.get("status") not in ("ok", "enriched") or a.get("place_id") != "pid_adv01t" or not a.get("formatted_address"):
    bad.append("CLOSED_TEMPORARILY audit: status=%r place_id=%r formatted_address=%r"
               % (a.get("status"), a.get("place_id"), a.get("formatted_address")))
if "adv01t" in rv:
    bad.append("CLOSED_TEMPORARILY: có dòng trong review-needed.csv")

if bad:
    c.fail("lệch ADR-044 (rc=%r): " % rc + "; ".join(bad))
c.ok("ADR-044: CLOSED_PERMANENTLY gỡ + removed_vendors.json + audit closed_permanently có place_id/formatted_address, không review; "
     "CLOSED_TEMPORARILY nhận khớp + temporarily_closed")
