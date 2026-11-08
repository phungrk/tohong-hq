#!/usr/bin/env python3
"""T-110 tiêu chí 6: đổi link `share.google` thành place_id bằng bước resolve (chạy trong workflow GitHub), tối đa 1 lượt Places mỗi link, lỗi thì ghi rõ, KHÔNG đoán.
OFFLINE (Google giả, link giả). Spec: products/T-110-duyet-tay-venue.md, "Đổi link share.google thành place_id".
Lệnh: `python3 resolve_overrides.py --state HCMC` (cwd tools/scraper). Quy trình mong đợi cho mỗi mục accept_place chưa có `resolved`:
  maps_link -> mở link (HTTP thường, không phải Places API) -> URL Maps đích -> lấy tên địa điểm trong /maps/place/<tên>/ -> đúng 1 lượt Places (Text Search) ->
  ứng viên phải có tên (bỏ dấu, chữ thường, bỏ ký tự lạ) BẰNG tên trong URL, và nếu URL có @lat,lng thì cách ứng viên <= 300 m; còn lại là lỗi. URL có sẵn token ChIJ...
  (query_place_id hay placeid) -> đúng 1 lượt Place Details. Mục chỉ có place_id -> đúng 1 lượt Place Details.
  Thành công: file ghi `place_id` + khối `resolved` {place_id, name, formatted_address, business_status, resolved_at, resolved_from: link|place_id}; các trường khác của mục
  và mọi mục khác GIỮ NGUYÊN byte; in 'RESOLVED <vendor_id> <place_id>'.
  Lỗi: in 'RESOLVE_ERROR <vendor_id> <mã>' với mã link_unreachable | link_no_place_name | search_no_result | name_mismatch | location_mismatch | place_not_found;
  mục đó KHÔNG đổi (place_id vẫn rỗng, không resolved); các mục khác vẫn xử lý; mã thoát 1.
  Dòng cuối GOOGLE_USAGE text_search=<n> photo_details=<n> photo_media=0 đúng bằng số lượt thật (text_search = Text Search, photo_details = Place Details).
  Hai link thật của ADR-048: tổng lượt Places (search + details) <= 2. Chạy lại: 0 lượt (mọi request, kể cả mở link), file không đổi.
  `enrich.py` và `refresh_photos.py` KHÔNG BAO GIỜ mở share.google/goo.gl: mục chưa resolve ở enrich -> 'OVERRIDE_ERROR <vendor_id> unresolved', vendor giữ nguyên, 0 lượt share.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []
M = "https://www.google.com/maps/place/%s/@%s,%s,17z/data=!3m1!4b1"
L = {k: "https://share.google/" + k for k in ("ok1", "ok2", "dead", "noname", "nores", "wrongname", "far", "cid")}
LINKS = {
    L["ok1"]: {"status": 200, "to": M % ("Trung+t%C3%A2m+h%E1%BB%99i+ngh%E1%BB%8B+Thiskyhall+Sala", "10.7950", "106.7400")},
    L["ok2"]: {"status": 200, "to": M % ("%C3%89n+Banquet+%26+Event+Space", "10.7800", "106.6800")},
    L["dead"]: {"status": 404},
    L["noname"]: {"status": 200, "to": "https://www.google.com/maps?q=10.78,106.68"},
    L["nores"]: {"status": 200, "to": M % ("Nh%C3%A0+h%C3%A0ng+Kh%C3%B4ng+C%C3%B3", "10.7800", "106.6800")},
    L["wrongname"]: {"status": 200, "to": M % ("Nh%C3%A0+h%C3%A0ng+Sai+T%C3%AAn", "10.7800", "106.6800")},
    L["far"]: {"status": 200, "to": M % ("Nh%C3%A0+h%C3%A0ng+Xa", "10.7000", "106.6000")},
    L["cid"]: {"status": 200, "to": "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Cid/data=!4m2?query_place_id=ChIJ_cid_place"},
}
PL = {"ChIJ_thisky": t.place("Trung tâm hội nghị Thiskyhall Sala", "Tầng 5, Cổng D6/10 Mai Chí Thọ, An Khánh, Hồ Chí Minh", lat=10.7950, lng=106.7400),
      "ChIJ_en": t.place("Én Banquet & Event Space", "308C Điện Biên Phủ, Phường 4, Hồ Chí Minh", lat=10.7800, lng=106.6800),
      "ChIJ_sai": t.place("Một Nơi Khác Hẳn", "1 Lê Lợi, Hồ Chí Minh", lat=10.7800, lng=106.6800),
      "ChIJ_xa": t.place("Nhà hàng Xa", "1 Lê Lợi, Hồ Chí Minh", lat=10.9000, lng=106.9000),
      "ChIJ_cid_place": t.place("Nhà hàng Cid", "2 Lê Lợi, Hồ Chí Minh"),
      "ChIJ_byid": t.place("Nhà hàng Theo Id", "3 Lê Lợi, Hồ Chí Minh")}
SEARCH = [("Thiskyhall Sala", ["ChIJ_thisky"]), ("Banquet", ["ChIJ_en"]), ("Sai Tên", ["ChIJ_sai"]), ("Nhà hàng Xa", ["ChIJ_xa"])]
FX = t.fixture(PL, SEARCH, LINKS)
IDS = {"ok1": "t110_a1", "ok2": "t110_a2", "dead": "t110_e1", "noname": "t110_e2", "nores": "t110_e3", "wrongname": "t110_e4", "far": "t110_e5", "cid": "t110_a3"}
vs = [t.vendor(i, "Nhà hàng " + k, "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh") for k, i in IDS.items()] + [t.vendor("t110_a4", "Nhà hàng Theo Id", "3 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"),
      t.vendor("t110_e6", "Nhà hàng Mất Id", "4 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_rm", "Nhà hàng Bị Loại", "5 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")]
ENT = [t.entry(i, "accept_place", maps_link=L[k]) for k, i in IDS.items()]
ENT += [t.entry("t110_a4", "accept_place", place_id="ChIJ_byid"), t.entry("t110_e6", "accept_place", place_id="ChIJ_khong_co"), t.entry("t110_rm", "remove")]
r = t.Root({"venue": vs, "honeymoon": []})
r.write("venue/enrichment-audit.json", [{"vendor_id": v["id"], "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None} for v in vs])
r.set_overrides(ENT)
before = {e["vendor_id"]: copy.deepcopy(e) for e in ENT}

# ---- enrich/refresh không mở link, mục chưa resolve là lỗi rõ ràng -----------------------------------------------------------------------------------
rc, out, calls = r.run(t.ENRICH, FX)
if any(x["kind"] == "share" for x in calls):
    bad.append("enrich mở link share.google/goo.gl (chỉ bước resolve trong workflow được mở)")
if not any(l.startswith("OVERRIDE_ERROR t110_a1 unresolved") for l in out.splitlines()) or t.has_pid(r.vendor("t110_a1")):
    bad.append("enrich: mục accept_place chưa resolve phải ra 'OVERRIDE_ERROR t110_a1 unresolved' và không đoán place_id")
rc, out, calls = r.run(t.REFRESH, FX)
if any(x["kind"] == "share" for x in calls):
    bad.append("refresh_photos mở link share.google")

# ---- resolve ----------------------------------------------------------------------------------------------------------------------------------------
rc, out, calls = r.run(t.RESOLVE, FX)
doc = r.overrides()
by = {e["vendor_id"]: e for e in doc.get("overrides", [])}
good = {"t110_a1": "ChIJ_thisky", "t110_a2": "ChIJ_en", "t110_a3": "ChIJ_cid_place", "t110_a4": "ChIJ_byid"}
for vid, pid in good.items():
    e = by.get(vid) or {}
    rs = e.get("resolved") or {}
    if e.get("place_id") != pid or rs.get("place_id") != pid or not rs.get("name") or not rs.get("formatted_address") or rs.get("business_status") != "OPERATIONAL" or not rs.get("resolved_at"):
        bad.append("%s: mong place_id=%s và khối resolved đủ trường; thấy %r" % (vid, pid, {k: e.get(k) for k in ("place_id", "resolved")}))
    elif rs.get("resolved_from") != ("link" if vid != "t110_a4" else "place_id"):
        bad.append("%s: resolved_from=%r" % (vid, rs.get("resolved_from")))
    if not any(l.startswith("RESOLVED %s %s" % (vid, pid)) for l in out.splitlines()):
        bad.append("%s: thiếu dòng 'RESOLVED %s %s'" % (vid, vid, pid))
    keep = {k: v for k, v in before[vid].items() if k not in ("place_id", "resolved")}
    if {k: v for k, v in e.items() if k not in ("place_id", "resolved")} != keep:
        bad.append("%s: resolve sửa trường ngoài place_id/resolved" % vid)
for vid, code in {"t110_e1": "link_unreachable", "t110_e2": "link_no_place_name", "t110_e3": "search_no_result", "t110_e4": "name_mismatch", "t110_e5": "location_mismatch", "t110_e6": "place_not_found"}.items():
    e = by.get(vid) or {}
    if not any(l.startswith("RESOLVE_ERROR %s %s" % (vid, code)) for l in out.splitlines()):
        bad.append("%s: mong 'RESOLVE_ERROR %s %s'" % (vid, vid, code))
    if e != before[vid]:
        bad.append("%s: mục lỗi bị đổi (không đoán): %r" % (vid, {k: e.get(k) for k in ("place_id", "resolved")}))
if by.get("t110_rm") != before["t110_rm"]:
    bad.append("mục remove bị resolve đổi")
if rc != 1:
    bad.append("có RESOLVE_ERROR mà mã thoát %r (mong 1)" % rc)
u = t.usage(out)
n_search, n_det = t.n_kind(calls, "search"), t.n_kind(calls, "details")
if u != {"text_search": n_search, "photo_details": n_det, "photo_media": 0}:
    bad.append("GOOGLE_USAGE %r không bằng số lượt thật search=%d details=%d" % (u, n_search, n_det))
if t.n_kind(calls, "media"):
    bad.append("resolve gọi tải ảnh (media): ảnh do refresh_photos lấy")
# mỗi mục tối đa 1 lượt Places: 8 mục link/place_id -> tối đa 8 lượt
if n_search + n_det > len([e for e in ENT if e["action"] == "accept_place"]):
    bad.append("resolve dùng %d lượt Places cho %d mục (mong <= 1 mỗi mục)" % (n_search + n_det, len([e for e in ENT if e["action"] == "accept_place"])))

# ---- hai link thật của ADR-048: tổng <= 2 lượt Places; chạy lại 0 lượt ----------------------------------------------------------------------------
r2 = t.Root({"venue": vs[:2], "honeymoon": []})
r2.set_overrides([t.entry("t110_a1", "accept_place", maps_link=L["ok1"]), t.entry("t110_a2", "accept_place", maps_link=L["ok2"])])
rc, out, calls = r2.run(t.RESOLVE, FX)
if rc != 0 or t.n_kind(calls, "search", "details") > 2 or t.n_kind(calls, "search", "details") < 1:
    bad.append("2 link ADR-048: mong rc=0 và <= 2 lượt Places; thấy rc=%r, %d lượt" % (rc, t.n_kind(calls, "search", "details")))
snap = r2.tree()
rc, out, calls = r2.run(t.RESOLVE, FX)
if calls or r2.tree() != snap or rc != 0:
    bad.append("chạy lại resolve: mong 0 request (kể cả mở link) và file không đổi; thấy %d request" % len(calls))
t.done(bad, "resolve đổi link/place_id thành place_id với <= 1 lượt Places mỗi mục, chỉ ghi place_id+resolved, 6 kiểu lỗi ghi rõ và không đoán, enrich/refresh không mở link, chạy lại 0 request")
