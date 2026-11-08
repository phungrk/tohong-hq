#!/usr/bin/env python3
"""T-111 tiêu chí 2 (tương tác T-110 và luật "đã có audit thì không tìm lại"). OFFLINE (Google giả).
A. Duyệt tay thắng luật tự động (T-110, quyết định của Chief of Staff): vendor có mục trong manual_overrides.json KHÔNG bị luật tự động gỡ, kể cả khi Google không trả gì:
   - accept_place (đã có resolved): 0 Text Search, có place_id; temporarily_closed: Google không trả gì ở cả hai truy vấn -> vẫn ở vendors.json, không removed;
   - remove: 0 Text Search cho vendor đó.
B. Tập G4 chỉ nhận vendor CLOSED_PERMANENTLY do Google báo: vendor X bị T-111 gỡ vì no_match KHÔNG làm vendor Y (cùng địa chỉ gốc, ứng viên Google không so được địa chỉ, độ tin 1,0)
   bị từ chối same_address_as_closed; còn vendor Y2 cùng địa chỉ với vendor đóng cửa thật (CLOSED_PERMANENTLY) vẫn bị từ chối (đối chứng: G4 còn nguyên).
C. Luật audit: vendor có dòng audit enriched/low_confidence: 0 lượt. Dòng no_match cũ (từ T-106/T-108, không có `attempts`) = đã thử 1 lần: đúng 1 lượt (lượt 2): tên rút gọn nếu có
   ("Nomad Star <địa danh>"), không thì tên gốc không kèm địa danh ("Mai House"); không trúng thì remove. Không dòng no_match cũ nào bị remove mà chưa qua lượt 2.
D. Lỗi HTTP (500) không được tính là đã thử: vendor không bị remove, không có dòng audit enriched/low_confidence/no_match; lần chạy sau tìm lại và nhận khớp.
E. Mọi chi phí Google nằm trong trần (B5): mặc định KHÔNG gọi Geocoding (0 lượt kind=geocode/other dù vendor không khớp và chưa có toạ độ); với `--geocode` thì mỗi lượt Geocoding vào dòng GOOGLE_REQUEST kind=geocode và vào GOOGLE_USAGE (geocode=<n>) bằng số lượt thật.
Spec: products/T-111-enrich-toan-bo-vendor.md, "Tương tác". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
V = x.V
# ---- A ----
acc = V("a_acc", "Nhà hàng Acacia Lux", 11)
tmp = V("a_tmp", "Nhà hàng Tempus Bay", 12)
rem = V("a_rem", "Nhà hàng Remus Hall", 13)
PLA = {"PACC": t.place("Nhà hàng Acacia Lux", x.GADDR % 11, nphotos=3)}
r = t.Root({"venue": [acc, tmp, rem]})
r.set_overrides([t.accept_with_snapshot("a_acc", "PACC", PLA["PACC"]), t.entry("a_tmp", "temporarily_closed"), t.entry("a_rem", "remove")])
rc, out, calls = r.run(x.enrich_all("venue"), x.fx(PLA, []))
if x.count_for(calls, "acacia lux") or x.count_for(calls, "remus hall"):
    bad.append("A: vendor accept_place/remove không được Text Search (thấy %r)" % x.queries(calls))
if not t.has_pid(r.vendor("a_acc")):
    bad.append("A: vendor accept_place phải có place_id")
if not r.vendor("a_tmp") or any(e["vendor"]["id"] == "a_tmp" for e in r.removed()):
    bad.append("A: vendor temporarily_closed bị luật tự động gỡ (no_match) dù có mục duyệt tay")
if x.count_for(calls, "tempus bay") != 2:
    bad.append("A: vendor temporarily_closed được thử lại mỗi lần enrich nhưng gồm lượt rút gọn; mong 2 lượt (lượt đầy đủ + lượt rút gọn), thấy %d" % x.count_for(calls, "tempus bay"))
# ---- B ----
X = V("g_x", "Nhà hàng Xenon Dead", 21)
Y = V("g_y", "Nhà hàng Yarrow Lux", 21)
Y["contact"]["address"] = Y["contact"]["address_source"] = X["contact"]["address"]
C2 = V("g_c", "Nhà hàng Cobalt Old", 22)
Y2 = V("g_y2", "Nhà hàng Yonder Lux", 22)
Y2["contact"]["address"] = Y2["contact"]["address_source"] = C2["contact"]["address"]
PLB = {"PY": t.place("Nhà hàng Yarrow Lux", "Khu đô thị Sala, Hồ Chí Minh"), "PY2": t.place("Nhà hàng Yonder Lux", "Khu đô thị Sala, Hồ Chí Minh"),
       "PC": t.place("Nhà hàng Cobalt Old", x.GADDR % 22, status="CLOSED_PERMANENTLY")}
r = t.Root({"venue": [X, C2], "wedding_attire": [Y, Y2]})
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"]), x.fx(PLB, [("yarrow lux", ["PY"]), ("yonder lux", ["PY2"]), ("cobalt old", ["PC"])]))
if not x.gone_everywhere(r, "g_x"):
    bad.append("B: g_x (no_match hai lần) phải bị gỡ")
ay, ay2 = r.audit("wedding_attire").get("g_y") or {}, r.audit("wedding_attire").get("g_y2") or {}
if ay.get("reject_reason") == "same_address_as_closed" or not t.has_pid(r.vendor("g_y", "wedding_attire")):
    bad.append("B: g_y bị G4 vì vendor T-111 gỡ do no_match (tập G4 chỉ nhận CLOSED_PERMANENTLY do Google báo): %r" % ay.get("reject_reason"))
if ay2.get("reject_reason") != "same_address_as_closed":
    bad.append("B đối chứng: g_y2 cùng địa chỉ với nhà hàng đóng cửa thật phải bị same_address_as_closed, thấy %r" % ay2.get("reject_reason"))
# ---- C ----
en = V("c_enr", "Nhà hàng Enrich Done", 31)
lo = V("c_low", "Nhà hàng Low Done", 32)
nm = V("c_nm", "Nhà hàng Tiệc Cưới Nomad Star", 33)
ns = V("c_ns", "Mai House", 34)
r = t.Root({"venue": [en, lo, nm, ns]})
r.write("venue/enrichment-audit.json", [
    {"vendor_id": "c_enr", "status": "enriched", "place_id": "PXX", "matched_name": "x", "confidence": 1.0},
    {"vendor_id": "c_low", "status": "low_confidence", "matched_name": "y", "confidence": 0.3, "reject_reason": "low_score", "candidate_place_id": "PYY"},
    {"vendor_id": "c_nm", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None},
    {"vendor_id": "c_ns", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None}])
rc, out, calls = r.run(x.enrich_all("venue"), x.fx({}, []))
qs = [x.fold(q) for q in x.queries(calls)]
if any(k in q for q in qs for k in ("enrich done", "low done")):
    bad.append("C: vendor có audit enriched/low_confidence bị tìm lại: %r" % qs)
if len(qs) != 2 or not any(q.startswith("nomad star") and "tiec cuoi" not in q for q in qs) or "mai house" not in qs:
    bad.append("C: dòng no_match cũ phải được thử đúng 1 lượt: 'Nomad Star <địa danh>' (tên rút gọn) và 'Mai House' (tên gốc, không địa danh); thấy %r" % qs)
if not x.gone_everywhere(r, "c_nm") or not x.gone_everywhere(r, "c_ns"):
    bad.append("C: no_match cũ + lượt rút gọn không trúng (hoặc không có tên rút gọn) phải bị remove")
if not r.vendor("c_enr") or not r.vendor("c_low"):
    bad.append("C: vendor audit enriched/low_confidence không được bị gỡ")
# ---- D ----
er = V("d_err", "Nhà hàng Errol Park", 41)
r = t.Root({"venue": [er]})
rc, out, calls = r.run(x.enrich_all("venue"), x.fx({}, [("errol park", [], None, 500)]))
a = r.audit().get("d_err") or {}
if not r.vendor("d_err") or any(e["vendor"]["id"] == "d_err" for e in r.removed()) or a.get("status") in ("enriched", "low_confidence", "no_match", "ok"):
    bad.append("D: lỗi HTTP 500 không được coi là đã thử/không có trên Maps (thấy audit %r, vendor còn=%s)" % (a.get("status"), bool(r.vendor("d_err"))))
PLD = {"PERR": t.place("Nhà hàng Errol Park", x.GADDR % 41)}
rc, out, calls = r.run(x.enrich_all("venue"), x.fx(PLD, [("errol park", ["PERR"])]))
if x.count_for(calls, "errol park") != 1 or not t.has_pid(r.vendor("d_err")):
    bad.append("D: lần chạy sau phải tìm lại vendor lỗi (1 lượt) và nhận khớp")
# M3: mọi lần gửi HTTP, kể cả lượt lỗi, được đếm
r = t.Root({"venue": [V("d_err2", "Nhà hàng Errol Two", 42)]})
rc, out, calls = r.run(x.enrich_all("venue"), x.fx({}, [("errol two", [], None, 500)]))
u = t.usage(out) or {}
if u.get("text_search") != t.n_kind(calls, "search") or x.n_requests(out, "search") != t.n_kind(calls, "search") or t.n_kind(calls, "search") < 1:
    bad.append("D/M3: mọi lần gửi (kể cả lượt bị 500 và retry nếu có) phải vào GOOGLE_REQUEST và GOOGLE_USAGE: fake thấy %d, USAGE %r, REQUEST %d" % (t.n_kind(calls, "search"), u, x.n_requests(out, "search")))
# ---- E ----
g = V("e_geo", "Nhà hàng Geo Nowhere", 51)
g["latitude"] = g["longitude"] = None
r = t.Root({"venue": [g]})
rc, out, calls = r.run(x.enrich_all("venue"), x.fx({}, []))
if t.n_kind(calls, "geocode", "other"):
    bad.append("E: mặc định không được gọi Geocoding/API khác (thấy %r)" % sorted({c["kind"] for c in calls}))
u = t.usage(out) or {}
if "geocode" in u and u["geocode"] != 0:
    bad.append("E: GOOGLE_USAGE geocode phải là 0 hoặc vắng khi không bật --geocode")
r = t.Root({"venue": [dict(g)]})
rc, out, calls = r.run(x.enrich_all("venue", extra=["--geocode"]), x.fx({}, []))
ng = t.n_kind(calls, "geocode")
u = t.usage(out) or {}
if ng < 1 or u.get("geocode") != ng or x.n_requests(out, "geocode") != ng:
    bad.append("E: bật --geocode: mong >= 1 lượt Geocoding và GOOGLE_USAGE geocode=%d, GOOGLE_REQUEST kind=geocode %d dòng; thấy USAGE %r, REQUEST %d" % (ng, ng, u, x.n_requests(out, "geocode")))
t.done(bad, "Geocoding mặc định tắt và, khi bật, được đếm; duyệt tay thắng luật gỡ no_match; tập G4 không nhận vendor T-111 gỡ (đối chứng G4 vẫn chạy); audit cũ không tìm lại, no_match cũ thử đúng 1 lượt rút gọn; lỗi HTTP không bị tính là đã thử")
