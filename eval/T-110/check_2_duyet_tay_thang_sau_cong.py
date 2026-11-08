#!/usr/bin/env python3
"""T-110 tiêu chí 2: duyệt tay THẮNG luật tự động, và lệnh áp lại offline không ghi đè duyệt tay. OFFLINE (Google giả).
Spec: products/T-110-duyet-tay-venue.md, "Thứ tự ưu tiên".
Dựng thư mục scraper tạm. Bước 0 (đối chứng, không có file duyệt tay): chứng minh mỗi vendor A..E bị MỘT cổng riêng từ chối (low_score, address_conflict,
address_unconfirmed, same_address_as_closed, low_score) và Z bị G4 vì X là nhà hàng đóng cửa Google; F nhận khớp một mình; R nhận khớp đúng.
Bước 1 (có file duyệt tay, mọi mục có snapshot `resolved`): chạy ĐÚNG lệnh enrich venue. Mong đợi:
  A..E accept_place: có place_id Google đúng, bản ghi log có manual_override=true, contact.address = địa chỉ Google, address_source nguyên vẹn, audit enriched +
      manual_override="accept_place", không bị G1/G3/G4/G5 hạ.
  E (G6): được giữ; F (tự động, chung place_id PE, địa chỉ gốc khác) bị hạ shared_place_id: duyệt tay không bao giờ bị G6 hạ, nhưng vẫn là thành viên nhóm.
  Confidence KHÔNG bị ghi đè: log và audit giữ số đo tên thật của pipeline (bằng số đo tên thật tính độc lập; B, D có tên Google khác tên vendor (D vẫn >= 0,95 để G4 đi trước G5) để lỗi ghi đè 1,0 bị bắt) kèm name_similarity bằng nó.
  Z2 (cùng địa chỉ gốc với W, W bị gỡ vì lý do khác CLOSED_PERMANENTLY do Google báo, kiểu T-111 no_match): được nhận, vì tập G4 chỉ nhận CLOSED_PERMANENTLY do Google báo.
  X remove: gỡ khỏi vendors.json, vào removed_vendors.json (manual=true); địa chỉ của X KHÔNG vào tập G4 (kể cả khi lý do của Capu chứa chữ CLOSED_PERMANENTLY)
      nên Z (cùng địa chỉ X) được nhận; địa chỉ nhà hàng đóng cửa thật (Y) vẫn vào G4 (D bị bỏ qua vì duyệt tay, không vì G4 hỏng).
  R, R2 reject_match (đã khớp tự động từ trước, KHÔNG bị Text Search lại): không place_id, không ảnh Google, audit low_confidence + reject_reason=manual_reject, có dòng review-needed.csv; R2 (đã khớp từ trước) bị hạ.
Bước 2: chạy lại offline (không khoá, mọi HTTP bị chặn): 0 lượt gọi, A..E còn nguyên, F/R/R2 còn bị hạ. File duyệt tay không đổi byte.
Bước 3: đảo thứ tự vendor trong file: kết quả mỗi vendor như nhau.
Bước 4 (bất biến thắng duyệt tay): accept_place bị từ chối bằng dòng `OVERRIDE_ERROR <vendor_id> <mã>` (mã: out_of_province, place_conflict cho CẢ HAI mục chung
place_id khác địa chỉ gốc, place_closed_permanently, place_temporarily_closed), vendor giữ nguyên trạng thái tự động, các mục khác vẫn áp, mã thoát 2.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

PL, RULES = t.scen_places(), t.scen_search_rules()
bad = []


def setup(x_in_vendors, entries=None, reverse=False):
    r = t.Root({"venue": t.scen_vendors(x_in_vendors, reverse), "honeymoon": []})
    rem = t.scen_removed(not x_in_vendors)
    r.write("venue/removed_vendors.json", rem)
    r.write("venue/enrichment-audit.json", t.scen_audit_rows())
    if entries is not None:
        r.set_overrides(entries)
    return r


# ---- Bước 0: đối chứng (không file duyệt tay) -------------------------------------------------------------------------------------------------------
ctl = setup(False)
t.os.environ.pop("GOOGLE_MAPS_API_KEY", None)
rc, out, calls = ctl.run(t.ENRICH, t.fixture(PL, RULES))
au = ctl.audit()
for vid, (n, a, p, code) in t.SCEN.items():
    if (au.get(vid) or {}).get("reject_reason") != code or t.has_pid(ctl.vendor(vid)):
        t.fail("fixture hỏng (đối chứng): %s mong bị %s, thấy %r" % (vid, code, (au.get(vid) or {}).get("reject_reason")))
if (au.get("t110_Z") or {}).get("reject_reason") != "same_address_as_closed":
    t.fail("fixture hỏng (đối chứng): Z mong bị G4 vì X đóng cửa Google, thấy %r" % (au.get("t110_Z") or {}).get("reject_reason"))
if not (t.has_pid(ctl.vendor("t110_F")) and t.has_pid(ctl.vendor("t110_R"))):
    t.fail("fixture hỏng (đối chứng): F và R phải nhận khớp tự động khi đứng một mình")

# ---- Bước 1: có duyệt tay ---------------------------------------------------------------------------------------------------------------------------
ENT = [t.accept_with_snapshot(i, p[0], PL[p[0]]) for i, (n, a, p, _) in t.SCEN.items()]
ENT += [t.entry("t110_X", "remove", reason="Capu: không có trên Google Maps, KHÔNG phải CLOSED_PERMANENTLY, loại khỏi danh sách"),
        t.entry("t110_R", "reject_match", place_id="PR", reason="Capu: Google nhận nhầm nơi"),
        t.entry("t110_R2", "reject_match", place_id="PR2", reason="Capu: Google nhận nhầm nơi")]
r = setup(True, ENT)
before_ov = open(r.p(t.OVERRIDES), "rb").read()
rc, out, calls = r.run(t.ENRICH, t.fixture(PL, RULES))
if "OVERRIDE_FILE_INVALID" in out or "OVERRIDE_ERROR" in out:
    bad.append("file duyệt tay hợp lệ mà enrich báo lỗi: " + [l for l in out.splitlines() if l.startswith("OVERRIDE_")][0][:120])


def state(rr):
    s = {}
    au_, rv = rr.audit(), rr.review()
    for v in rr.vendors():
        a = au_.get(v["id"]) or {}
        s[v["id"]] = (t.pid_of(v), a.get("status"), a.get("reject_reason"), bool(v.get("google_photos")), v["id"] in rv)
    s["removed"] = sorted((x.get("vendor") or {}).get("id") for x in rr.removed())
    return s


S1 = state(r)
for vid, (n, a, (pid, pn, pa), code) in t.SCEN.items():
    v = r.vendor(vid)
    g = t.glog(v) if v else None
    a_ = r.audit().get(vid) or {}
    if not g or g["place_id"] != pid:
        bad.append("%s: duyệt tay %s không thắng cổng %s (place_id=%r)" % (vid, pid, code, g and g["place_id"])); continue
    if g.get("manual_override") is not True:
        bad.append("%s: bản ghi log thiếu manual_override=true" % vid)
    real = t.name_sim(n, pn)
    if not isinstance(g.get("confidence"), (int, float)) or abs(g["confidence"] - real) > 0.0006 or g.get("name_similarity") != g.get("confidence"):
        bad.append("%s: confidence/name_similarity phải bằng số đo tên thật của pipeline (%s) và bằng nhau; thấy %r/%r" % (vid, real, g.get("confidence"), g.get("name_similarity")))
    if v["contact"].get("address") != pa or v["contact"].get("address_source") != a:
        bad.append("%s: contact.address=%r (mong địa chỉ Google), address_source=%r (mong nguyên vẹn)" % (vid, v["contact"].get("address"), v["contact"].get("address_source")))
    if a_.get("status") != "enriched" or a_.get("manual_override") != "accept_place" or a_.get("reject_reason"):
        bad.append("%s: audit mong enriched + manual_override=accept_place, không reject_reason; thấy %r" % (vid, {k: a_.get(k) for k in ("status", "manual_override", "reject_reason")}))
f = r.vendor("t110_F")
fa = r.audit().get("t110_F") or {}
if t.has_pid(f) or fa.get("reject_reason") != "shared_place_id" or fa.get("status") != "low_confidence":
    bad.append("F (tự động, chung place_id với E được duyệt tay) mong bị G6 hạ shared_place_id; thấy pid=%r audit=%r" % (t.pid_of(f), fa.get("reject_reason")))
if r.vendor("t110_X") is not None:
    bad.append("X remove: vẫn còn trong vendors.json")
xr = [x for x in r.removed() if (x.get("vendor") or {}).get("id") == "t110_X"]
if len(xr) != 1 or xr[0].get("manual") is not True or not str(xr[0].get("reason", "")).startswith("manual_override"):
    bad.append("X remove: removed_vendors.json mong đúng 1 bản ghi manual=true, reason bắt đầu 'manual_override'; thấy %r" % [(x.get("manual"), x.get("reason")) for x in xr])
elif xr[0]["vendor"] != next(v for v in t.scen_vendors(True) if v["id"] == "t110_X"):
    bad.append("X remove: bản ghi lưu khác bản ghi trước khi gỡ (không khôi phục nguyên vẹn được)")
if not any((x.get("vendor") or {}).get("id") == "t110_closedY" for x in r.removed()):
    bad.append("bản ghi nhà hàng đóng cửa Y bị mất khỏi removed_vendors.json")
z = r.vendor("t110_Z")
if not t.has_pid(z):
    bad.append("Z (cùng địa chỉ X bị Capu loại) bị từ chối %r: địa chỉ vendor bị Capu loại không được vào tập G4" % (r.audit().get("t110_Z") or {}).get("reject_reason"))
if not t.has_pid(r.vendor("t110_Z2")):
    bad.append("Z2 bị từ chối %r: tập G4 chỉ nhận CLOSED_PERMANENTLY do Google báo (không nhận bản ghi bị gỡ vì lý do khác)" % (r.audit().get("t110_Z2") or {}).get("reject_reason"))
if any(x["kind"] == "search" and ("Romeo" in x["q"] or "Sierra" in x["q"]) for x in calls):
    bad.append("vendor reject_match bị Text Search lại")
for vid in ("t110_R", "t110_R2"):
    v, a_ = r.vendor(vid), r.audit().get(vid) or {}
    if t.has_pid(v) or v.get("google_photos") or a_.get("status") != "low_confidence" or a_.get("reject_reason") != "manual_reject":
        bad.append("%s reject_match: mong không place_id/ảnh, low_confidence + manual_reject; thấy pid=%r status=%r code=%r" % (vid, t.pid_of(v), a_.get("status"), a_.get("reject_reason")))
    elif v["contact"].get("address") != v["contact"].get("address_source"):
        bad.append("%s reject_match: contact.address chưa về địa chỉ gốc" % vid)
    if vid not in r.review():
        bad.append("%s reject_match: thiếu dòng review-needed.csv" % vid)
if open(r.p(t.OVERRIDES), "rb").read() != before_ov:
    bad.append("enrich đã sửa file duyệt tay (chỉ Capu và bước resolve được ghi)")

# ---- Bước 2: áp lại offline -------------------------------------------------------------------------------------------------------------------------
rc2, out2, calls2 = r.run(t.ENRICH, t.fixture(PL, RULES, deny=True), key=False)
if calls2:
    bad.append("chạy lại offline vẫn gọi Google %d lượt" % len(calls2))
S2 = state(r)
if S2 != S1:
    d = [k for k in S1 if S1.get(k) != S2.get(k)]
    bad.append("chạy lại offline đổi kết quả: %s" % d[:3])

# ---- Bước 3: đảo thứ tự vendor ----------------------------------------------------------------------------------------------------------------------
r3 = setup(True, ENT, reverse=True)
r3.run(t.ENRICH, t.fixture(PL, RULES))
S3 = state(r3)
if {k: v for k, v in S3.items() if k != "removed"} != {k: v for k, v in S1.items() if k != "removed"} or S3["removed"] != S1["removed"]:
    bad.append("đảo thứ tự vendor đổi kết quả: %s" % [k for k in S1 if S1.get(k) != S3.get(k)][:3])

# ---- Bước 4: bất biến thắng duyệt tay ---------------------------------------------------------------------------------------------------------------
pl4 = {"PQ": t.place("Nhà hàng Quebec", "1 Lê Lợi, Bến Thành, Hồ Chí Minh"),
       "PO": t.place("Nhà hàng Oscar", "12 Nguyễn Huệ, Quy Nhơn, Bình Định"),
       "PK": t.place("Nhà hàng Kilo", "5 Pasteur, Bến Nghé, Hồ Chí Minh", status="CLOSED_PERMANENTLY"),
       "PT": t.place("Nhà hàng Tango", "6 Pasteur, Bến Nghé, Hồ Chí Minh", status="CLOSED_TEMPORARILY"),
       "PG": t.place("Nhà hàng Golf", "9 Pasteur, Bến Nghé, Hồ Chí Minh")}
vs4 = [t.vendor("t110_P1", "Nhà hàng P1", "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_P2", "Nhà hàng P2", "5 Pasteur, Quận 1, Thành phố Hồ Chí Minh"),
       t.vendor("t110_O", "Nhà hàng Oscar", "12 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_K", "Nhà hàng Kilo", "5 Pasteur, Quận 1, Thành phố Hồ Chí Minh"),
       t.vendor("t110_T", "Nhà hàng Tango", "6 Pasteur, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_G", "Nhà hàng Golf", "9 Pasteur, Quận 1, Thành phố Hồ Chí Minh")]
r4 = t.Root({"venue": vs4, "honeymoon": []})
r4.write("venue/enrichment-audit.json", [{"vendor_id": v["id"], "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None} for v in vs4])
r4.set_overrides([t.accept_with_snapshot("t110_P1", "PQ", pl4["PQ"]), t.accept_with_snapshot("t110_P2", "PQ", pl4["PQ"]),
                  t.accept_with_snapshot("t110_O", "PO", pl4["PO"]), t.accept_with_snapshot("t110_K", "PK", pl4["PK"]),
                  t.accept_with_snapshot("t110_T", "PT", pl4["PT"]), t.accept_with_snapshot("t110_G", "PG", pl4["PG"])])
rc4, out4, calls4 = r4.run(t.ENRICH, t.fixture(pl4, []))
errs = {}
for l in out4.splitlines():
    if l.startswith("OVERRIDE_ERROR "):
        parts = l.split()
        errs[parts[1]] = parts[2].rstrip(":") if len(parts) > 2 else ""
for vid, code in {"t110_P1": "place_conflict", "t110_P2": "place_conflict", "t110_O": "out_of_province", "t110_K": "place_closed_permanently", "t110_T": "place_temporarily_closed"}.items():
    if errs.get(vid) != code:
        bad.append("%s: mong dòng 'OVERRIDE_ERROR %s %s', thấy %r" % (vid, vid, code, errs.get(vid)))
    if t.has_pid(r4.vendor(vid)):
        bad.append("%s: accept_place lỗi mà vẫn ghi place_id (không được đoán/ép)" % vid)
if not t.has_pid(r4.vendor("t110_G")):
    bad.append("mục hợp lệ khác (t110_G) không được áp khi các mục kia lỗi")
if rc4 != 2:
    bad.append("có OVERRIDE_ERROR mà mã thoát %r (mong 2)" % rc4)
if r4.vendor("t110_K") is None:
    bad.append("accept_place vào nơi CLOSED_PERMANENTLY làm vendor bị gỡ (chỉ Capu dùng remove mới gỡ)")
t.done(bad, "duyệt tay thắng G1/G3/G4/G5 và G6 (ghim), remove không vào tập G4, reject_match hạ được, áp lại offline và đảo thứ tự không đổi, bất biến (tỉnh, chung place_id, đóng cửa) thắng duyệt tay")
