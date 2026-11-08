#!/usr/bin/env python3
"""T-110 tiêu chí 8: việc chạy 4 quyết định ADR-048 tốn <= 9 request Google, trong hạn mức miễn phí, và dòng GOOGLE_USAGE khớp số lượt thật. OFFLINE (Google giả).
Spec: products/T-110-duyet-tay-venue.md, "Chi phí và hạn mức". Mô phỏng đúng chuỗi workflow `resolve-overrides`:
  resolve_overrides.py -> enrich.py --category venue -> refresh_photos.py --max-photos 2 --max-requests 6, trên dữ liệu giống thật: 2 mục accept_place chỉ có link
  (kiểu Én, Thiskyhall), 1 remove (kiểu Tự Do), 1 temporarily_closed (kiểu Pergola, đã có dòng audit), cùng 3 vendor đã khớp có ảnh vừa lấy và vài vendor đã có dòng audit.
Mong đợi: resolve <= 2 lượt Places (search+details); enrich đúng 1 lượt Text Search (thử lại vendor tạm đóng cửa, không vendor nào khác); refresh <= 2 Place Details và
  <= 4 media (vendor có ảnh tươi bị bỏ qua), không dừng vì trần 6; tổng <= 9; không lượt gọi nào ngoài share/search/details/media; không vendor nào được nhận khớp mà không ảnh.
  Mỗi CLI in GOOGLE_USAGE đúng bằng số lượt nó thật sự gọi (text_search = search, photo_details = details, photo_media = media).
Số liệu thật của lần chạy (log tools/scraper/run-logs/T-110/) được kiểm ở check_7. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import datetime, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []
now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
M = "https://www.google.com/maps/place/%s/@%s,%s,17z/data=!3m1"
LINKS = {"https://share.google/tYZdblcikIDPqVJX6": {"status": 200, "to": M % ("%C3%89n+Banquet+%26+Event+Space", "10.7800", "106.6800")},
         "https://share.google/noYBKfSkxUtMoFmJD": {"status": 200, "to": M % ("Trung+t%C3%A2m+h%E1%BB%99i+ngh%E1%BB%8B+Thiskyhall+Sala", "10.7950", "106.7400")}}
PL = {"PEN": t.place("Én Banquet & Event Space", "308C Điện Biên Phủ, Phường 4, Hồ Chí Minh", lat=10.78, lng=106.68, nphotos=5),
      "PTH": t.place("Trung tâm hội nghị Thiskyhall Sala", "Tầng 5, Cổng D6/10 Mai Chí Thọ, An Khánh, Hồ Chí Minh", lat=10.795, lng=106.74, nphotos=5),
      "PPG": t.place("Pergola Garden Restaurant", "28A Trần Cao Vân, Phường, Phú Nhuận, Hồ Chí Minh", status="CLOSED_TEMPORARILY")}
SEARCH = [("Banquet", ["PEN"]), ("Thiskyhall Sala", ["PTH"]), ("Pergola", ["PPG"])]
vs = [t.vendor("t110_en", "Én Banquet & Event Space", "Lầu 7 tòa nhà Robot Tower, 308C Điện Biên Phủ, Phường 4, Quận 3, Thành phố Hồ Chí Minh"),
      t.vendor("t110_th", "Thiskyhall", "Lầu 5, Số 10 Mai Chí Thọ, Khu đô thị Sala, An Khánh, TPHCM, Quận 2, Thành phố Hồ Chí Minh"),
      t.vendor("t110_td", "Nhà hàng Tự Do", "275A Phạm Ngũ Lão, Quận 1, Thành phố Hồ Chí Minh"),
      t.vendor("t110_pg", "Nhà Hàng Tiệc Cưới Ngoài Trời Pergola", "28A Trần Cao Vân, P.12, Quận Phú Nhuận, Thành phố Hồ Chí Minh")]
AU = [{"vendor_id": "t110_en", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None},
      {"vendor_id": "t110_th", "status": "low_confidence", "matched_name": "Trung tâm hội nghị Thiskyhall Sala", "confidence": 0.455, "place_id": None, "formatted_address": PL["PTH"]["address"],
       "address_match": False, "reject_reason": "low_score", "candidate_place_id": ""},
      {"vendor_id": "t110_td", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None},
      {"vendor_id": "t110_pg", "status": "low_confidence", "matched_name": "Pergola Garden Restaurant", "confidence": 0.226, "place_id": None, "formatted_address": PL["PPG"]["address"],
       "address_match": True, "reject_reason": "low_score", "candidate_place_id": ""}]
for k in range(3):  # 3 vendor đã khớp, ảnh vừa lấy (refresh phải bỏ qua)
    v = t.vendor("t110_ok%d" % k, "Nhà hàng Ổn %d" % k, "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh" % (k + 1))
    ga = "%d Lê Lợi, Bến Thành, Hồ Chí Minh" % (k + 1)
    v["contact"]["address"] = ga
    v["google_photos"] = [{"uri": "https://lh3.googleusercontent.com/ok%d" % k, "attributions": [{"name": "t"}], "fetched_at": now}]
    v["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": "Nhà hàng Ổn %d" % k, "confidence": 1.0, "place_id": "POK%d" % k,
                            "formatted_address": ga, "address_match": True, "changes": {"address": ga}}]
    vs.append(v)
    AU.append({"vendor_id": v["id"], "status": "enriched", "matched_name": v["name"], "confidence": 1.0, "place_id": "POK%d" % k, "formatted_address": ga, "address_match": True})
    PL["POK%d" % k] = t.place(v["name"], ga)
r = t.Root({"venue": vs, "honeymoon": []})
r.write("venue/enrichment-audit.json", AU)
r.set_overrides([t.entry("t110_en", "accept_place", maps_link="https://share.google/tYZdblcikIDPqVJX6", reason="Capu: có trên Google Maps"),
                 t.entry("t110_th", "accept_place", maps_link="https://share.google/noYBKfSkxUtMoFmJD", reason="Capu: có trên Google Maps"),
                 t.entry("t110_td", "remove", reason="Capu: không có trên Google Maps"),
                 t.entry("t110_pg", "temporarily_closed", reason="Capu: Google Maps ghi tạm thời đóng cửa")])
FX = t.fixture(PL, SEARCH, LINKS)
steps = {}
steps["resolve"] = r.run(t.RESOLVE, FX)
steps["enrich"] = r.run(t.ENRICH, FX)
steps["refresh"] = r.run(t.REFRESH, FX)
c = {k: v[2] for k, v in steps.items()}
if t.n_kind(c["resolve"], "search", "details") > 2 or t.n_kind(c["resolve"], "search", "details") < 1:
    bad.append("resolve dùng %d lượt Places (mong 1..2)" % t.n_kind(c["resolve"], "search", "details"))
if t.n_kind(c["enrich"], "search") != 1 or t.n_kind(c["enrich"], "details", "media", "share") or "Pergola" not in "".join(x["q"] for x in c["enrich"]):
    bad.append("enrich mong đúng 1 Text Search (thử lại Pergola) và không gì khác; thấy %r" % [(x["kind"], x["q"][:30]) for x in c["enrich"]])
if t.n_kind(c["refresh"], "details") > 2 or t.n_kind(c["refresh"], "media") > 4 or t.n_kind(c["refresh"], "search", "share"):
    bad.append("refresh mong <= 2 details, <= 4 media, không search/share; thấy details=%d media=%d" % (t.n_kind(c["refresh"], "details"), t.n_kind(c["refresh"], "media")))
tot = sum(len(v) - t.n_kind(v, "share", "maps") for v in c.values())
if tot > 9:
    bad.append("tổng %d request Places/Photos > 9" % tot)
if any(x["kind"] == "other" for v in c.values() for x in v):
    bad.append("có lượt gọi ngoài share/search/details/media")
exp = {"resolve": {"text_search": t.n_kind(c["resolve"], "search"), "photo_details": t.n_kind(c["resolve"], "details"), "photo_media": 0},
       "enrich": {"text_search": t.n_kind(c["enrich"], "search"), "photo_details": 0, "photo_media": t.n_kind(c["enrich"], "media")},
       "refresh": {"text_search": 0, "photo_details": t.n_kind(c["refresh"], "details"), "photo_media": t.n_kind(c["refresh"], "media")}}
for k, e in exp.items():
    u = t.usage(steps[k][1])
    if u != e:
        bad.append("%s: GOOGLE_USAGE %r không khớp lượt thật %r" % (k, u, e))
for vid in ("t110_en", "t110_th"):
    v = r.vendor(vid)
    if not t.has_pid(v) or not v.get("google_photos"):
        bad.append("%s: sau chuỗi lệnh phải có place_id và ảnh Google" % vid)
if steps["refresh"][0] != 0 or "stopped" in steps["refresh"][1].lower().replace("skipped", ""):
    bad.append("refresh dừng vì trần request hoặc lỗi (rc=%r)" % steps["refresh"][0])
t.done(bad, "chuỗi resolve, enrich, refresh cho 4 quyết định ADR-048 tốn %d request (<= 9: resolve <= 2, enrich 1, refresh details <= 2 + media <= 4); GOOGLE_USAGE khớp số thật" % tot)
