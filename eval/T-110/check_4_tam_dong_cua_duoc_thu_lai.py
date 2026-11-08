#!/usr/bin/env python3
"""T-110 tiêu chí 4: tạm đóng cửa (Google CLOSED_TEMPORARILY hoặc Capu đánh dấu) = không ảnh, không gỡ, luôn được thử lại, kể cả khi đã có dòng audit.
OFFLINE (Google giả). Spec: products/T-110-duyet-tay-venue.md, "Trạng thái tạm đóng cửa".
Vendor: P5 (Capu đánh dấu, Google báo CLOSED_TEMPORARILY rồi mở lại: ca mục còn trong file mà Google mở cửa và ứng viên qua sáu cổng -> NHẬN, hiện lên app, audit reopened=true, mục giữ làm lịch sử), P1 (Capu đánh dấu temporarily_closed, đã có dòng audit low_confidence như Pergola thật; Google trả CLOSED_TEMPORARILY, tên khác nên G1 từ chối), P2 (không duyệt tay;
Google trả CLOSED_TEMPORARILY, khớp đúng), P3 (như P2 nhưng G1 từ chối), P4 (Google trả CLOSED_PERMANENTLY, khớp đúng: ADR-044 vẫn gỡ), Q (đã có dòng audit no_match, không liên quan).
Mọi vendor tạm đóng cửa có audit closed_state='temporarily_closed' và KHÔNG có trong pool (build_pool.py --out); quay lại pool khi hết trạng thái.
Bước 1: enrich + refresh_photos. P1..P3 còn trong vendors.json, không place_id, không google_photos, không vào removed_vendors.json, refresh không gọi Place Details cho chúng;
  dòng audit của P1..P3 có retry=true; P1 manual_override="temporarily_closed"; P2 status="temporarily_closed" + candidate_place_id (không place_id);
  P3 status="low_confidence" + reject_reason="low_score". P4 vào removed_vendors.json, không retry.
Bước 2: enrich lần nữa: đúng 4 lượt Text Search, của P1, P2, P3, P5 (không phải Q, không phải P4). Ngoại lệ của luật 'đã có dòng audit thì không tìm lại'.
Bước 3: Google báo P2 mở lại: enrich thử lại P2 và nhận khớp (place_id, status enriched, không retry); lần enrich kế tiếp không tìm lại P2 nữa; refresh cho P2 ảnh Google.
Bước 4: Capu xoá dấu của P1 và Google báo mở lại: enrich thử lại P1 đúng một lần, dòng audit hết retry (G1 vẫn từ chối vì tên khác), lần kế không tìm lại P1.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []
ADDR1 = "28A Trần Cao Vân, P.12, Quận Phú Nhuận, Thành phố Hồ Chí Minh"
PL = {"PP1": t.place("Pergola Garden Restaurant", "28A Trần Cao Vân, Phường, Phú Nhuận, Hồ Chí Minh", status="CLOSED_TEMPORARILY"),
      "PP2": t.place("Nhà hàng Hai Test", "2 Lê Lợi, Bến Thành, Hồ Chí Minh", status="CLOSED_TEMPORARILY"),
      "PP3": t.place("Hội trường Zeta Ba", "30 Lê Lợi, Bến Thành, Hồ Chí Minh", status="CLOSED_TEMPORARILY"),
      "PP4": t.place("Nhà hàng Tư Test", "4 Lê Lợi, Bến Thành, Hồ Chí Minh", status="CLOSED_PERMANENTLY"),
      "PP5": t.place("Nhà hàng Năm Test", "5 Lê Lợi, Bến Thành, Hồ Chí Minh", status="CLOSED_TEMPORARILY")}
RULES = [("Pergola Test", ["PP1"]), ("Nhà hàng Hai Test", ["PP2"]), ("Nhà hàng Ba Test", ["PP3"]), ("Nhà hàng Tư Test", ["PP4"]), ("Nhà hàng Năm Test", ["PP5"])]
vs = [t.vendor("t110_P1", "Nhà Hàng Pergola Test", ADDR1), t.vendor("t110_P2", "Nhà hàng Hai Test", "2 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"),
      t.vendor("t110_P3", "Nhà hàng Ba Test", "3 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_P4", "Nhà hàng Tư Test", "4 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"),
      t.vendor("t110_P5", "Nhà hàng Năm Test", "5 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_Q", "Nhà hàng Quebec Cũ", "9 Pasteur, Quận 1, Thành phố Hồ Chí Minh")]
r = t.Root({"venue": vs, "honeymoon": []})
r.write("venue/enrichment-audit.json", [
    {"vendor_id": "t110_P1", "status": "low_confidence", "matched_name": "Pergola Garden Restaurant", "confidence": 0.226, "place_id": None, "formatted_address": PL["PP1"]["address"],
     "address_match": True, "reject_reason": "low_score", "candidate_place_id": ""},
    {"vendor_id": "t110_Q", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None}])
ENT = [t.entry("t110_P1", "temporarily_closed", reason="Capu: Google Maps ghi tạm thời đóng cửa"), t.entry("t110_P5", "temporarily_closed", reason="Capu: Google Maps ghi tạm thời đóng cửa")]
r.set_overrides(ENT)


def searches(calls):
    return sorted(x["q"] for x in calls if x["kind"] == "search")


def names_in(qs):
    return sorted({n for n in ("Pergola Test", "Hai Test", "Ba Test", "Tư Test", "Quebec", "Năm Test") for q in qs if n in q})


FX = t.fixture(PL, RULES)
rc, out, calls = r.run(t.ENRICH, FX)
rc, out, calls_r = r.run(t.REFRESH, FX)
au = r.audit()
for vid in ("t110_P1", "t110_P2", "t110_P3", "t110_P5"):
    v, a = r.vendor(vid), au.get(vid) or {}
    if v is None:
        bad.append("%s: biến mất khỏi vendors.json (tạm đóng cửa không được gỡ)" % vid); continue
    if t.has_pid(v) or v.get("google_photos"):
        bad.append("%s: tạm đóng cửa mà có place_id hoặc ảnh Google" % vid)
    if a.get("retry") is not True or a.get("closed_state") != "temporarily_closed":
        bad.append("%s: dòng audit mong retry=true + closed_state='temporarily_closed'; thấy %r" % (vid, {k: a.get(k) for k in ("status", "retry", "closed_state")}))
    if any((x.get("vendor") or {}).get("id") == vid for x in r.removed()):
        bad.append("%s: bị đưa vào removed_vendors.json" % vid)
if (au.get("t110_P1") or {}).get("manual_override") != "temporarily_closed":
    bad.append("P1: audit thiếu manual_override='temporarily_closed'")
a2 = au.get("t110_P2") or {}
if a2.get("status") != "temporarily_closed" or a2.get("candidate_place_id") != "PP2" or a2.get("place_id"):
    bad.append("P2: mong status=temporarily_closed + candidate_place_id=PP2 + không place_id; thấy %r" % {k: a2.get(k) for k in ("status", "candidate_place_id", "place_id")})
a3 = au.get("t110_P3") or {}
if a3.get("status") != "low_confidence" or a3.get("reject_reason") != "low_score":
    bad.append("P3: mong low_confidence + low_score (cổng thắng trạng thái); thấy %r" % {k: a3.get(k) for k in ("status", "reject_reason")})
if any(x["kind"] == "details" for x in calls_r):
    bad.append("refresh_photos gọi Place Details cho vendor không có place_id")
rm = [(x.get("vendor") or {}).get("id") for x in r.removed()]
if rm != ["t110_P4"] or (au.get("t110_P4") or {}).get("retry"):
    bad.append("P4 CLOSED_PERMANENTLY: mong đúng P4 bị gỡ và không retry; thấy removed=%r" % rm)

pool = t.pool_ids(r)
for vid in ("t110_P1", "t110_P2", "t110_P3", "t110_P5"):
    if vid in pool:
        bad.append("%s: tạm đóng cửa mà còn trong pool (ADR-049: không hiển thị trên app)" % vid)
if "t110_Q" not in pool:
    bad.append("vendor bình thường Q bị loại khỏi pool")
rc, out, calls = r.run(t.ENRICH, FX)
if names_in(searches(calls)) != ["Ba Test", "Hai Test", "Pergola Test", "Năm Test"] or len(searches(calls)) != 4:
    bad.append("bước 2: mong đúng 4 lượt Text Search của P1, P2, P3, P5 (không phải Q, P4); thấy %r" % names_in(searches(calls)))

PL["PP2"]["status"] = "OPERATIONAL"
PL["PP5"]["status"] = "OPERATIONAL"
FX = t.fixture(PL, RULES)
ov_bytes = open(r.p(t.OVERRIDES), "rb").read()
rc, out, calls = r.run(t.ENRICH, FX)
v5, a5 = r.vendor("t110_P5"), r.audit().get("t110_P5") or {}
if t.pid_of(v5) != "PP5" or a5.get("status") != "enriched" or a5.get("reopened") is not True or a5.get("retry") or a5.get("closed_state"):
    bad.append("bước 3: P5 (mục Capu còn trong file, Google báo mở cửa, qua sáu cổng) phải được nhận: place_id=PP5, enriched, reopened=true, hết retry/closed_state; thấy pid=%r %r" % (t.pid_of(v5), {k: a5.get(k) for k in ("status", "reopened", "retry", "closed_state")}))
if open(r.p(t.OVERRIDES), "rb").read() != ov_bytes:
    bad.append("bước 3: mục temporarily_closed của Capu bị code sửa/xoá (phải giữ làm lịch sử)")
v2, a2 = r.vendor("t110_P2"), r.audit().get("t110_P2") or {}
if t.pid_of(v2) != "PP2" or a2.get("status") != "enriched" or a2.get("retry"):
    bad.append("bước 3: P2 mở lại phải được nhận khớp (place_id=PP2, enriched, hết retry); thấy pid=%r status=%r retry=%r" % (t.pid_of(v2), a2.get("status"), a2.get("retry")))
rc, out, calls = r.run(t.ENRICH, FX)
if "Hai Test" in "".join(searches(calls)):
    bad.append("bước 3: P2 đã nhận khớp mà enrich vẫn tìm lại")
rc, out, calls_r = r.run(t.REFRESH, FX)
if not (r.vendor("t110_P2") or {}).get("google_photos"):
    bad.append("bước 3: P2 mở lại nhưng refresh_photos không lấy được ảnh Google")
pool = t.pool_ids(r)
if not {"t110_P2", "t110_P5"} <= pool:
    bad.append("bước 3: vendor mở lại và được nhận phải quay lại pool; thiếu %r" % sorted({"t110_P2", "t110_P5"} - pool))
if "t110_P1" in pool or "t110_P3" in pool:
    bad.append("bước 3: P1/P3 vẫn tạm đóng cửa mà ở trong pool")
rc, out, calls = r.run(t.ENRICH, FX)
if "Năm Test" in "".join(searches(calls)):
    bad.append("bước 3: P5 đã nhận khớp mà enrich vẫn tìm lại")

r.set_overrides([])
PL["PP1"]["status"] = "OPERATIONAL"
FX = t.fixture(PL, RULES)
rc, out, calls = r.run(t.ENRICH, FX)
if names_in(searches(calls)).count("Pergola Test") != 1:
    bad.append("bước 4: P1 hết dấu nhưng dòng audit còn retry: enrich phải thử lại đúng 1 lần; thấy %r" % names_in(searches(calls)))
a1 = r.audit().get("t110_P1") or {}
if a1.get("retry") or a1.get("reject_reason") != "low_score":
    bad.append("bước 4: P1 mong hết retry và vẫn low_score (tên khác); thấy retry=%r reject=%r" % (a1.get("retry"), a1.get("reject_reason")))
rc, out, calls = r.run(t.ENRICH, FX)
if "Pergola Test" in "".join(searches(calls)):
    bad.append("bước 4: P1 hết lý do retry mà enrich vẫn tìm lại")
if "t110_P1" not in t.pool_ids(r):
    bad.append("bước 4: P1 hết trạng thái tạm đóng cửa (ảnh minh hoạ, không place_id) phải quay lại pool")
t.done(bad, "tạm đóng cửa (Capu hoặc Google): không ảnh, không gỡ, không ở trong pool (quay lại khi hết trạng thái), mục của Capu không chặn nhận khi Google mở cửa, được thử lại dù có dòng audit, hết thử lại khi hết lý do; CLOSED_PERMANENTLY vẫn gỡ")
