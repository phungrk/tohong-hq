#!/usr/bin/env python3
"""T-112 adv-04 (adversary, tầng 3). Spec T-110 Hành vi 8: Én (accept_place) phải có trong pool >= 1 ảnh, MỌI ảnh source=google (check_7). Chuỗi lệnh do spec
định (Hành vi 9): resolve -> `enrich.py --category venue` -> `refresh_photos.py --input output/HCMC/venue/vendors.json` -> regen pool (build_pool.py rồi generator).
Dữ liệu thật: Én `marry_d4380c0b3cf3` nằm ở CẢ `other/vendors.json` lẫn `venue/vendors.json`, cả hai bản 0 review. accept_place ghi place_id vào cả hai bản,
refresh chỉ lấy ảnh cho bản venue, build_pool.collapse_by_id giữ bản ĐẦU (other, theo thứ tự glob) khi số review bằng nhau -> pool-vendors.json của Én
không có google_photos -> pool tohong-back giữ ảnh marry -> check_7 đỏ cả sau lần chạy thật (đã tổng duyệt offline trên bản sao dữ liệu thật).
Input phá (OFFLINE, Google giả): vendor E2 ở `other` + `venue`, cùng 0 review, accept_place đã resolve; chạy đúng chuỗi trên. Mong: bản ghi E2 trong
output/pool-vendors.json có google_photos >= 1 ảnh (uri lh*.googleusercontent.com, có attributions). Đối chứng: vendor một category F2 cũng có.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-110"))
import _t110 as t

e2 = t.vendor("t112_E2", "Én Adv Banquet", "308C Điện Biên Phủ, Phường 4, Quận 3, Thành phố Hồ Chí Minh", cats=("venue",))
e2o = t.vendor("t112_E2", "Én Adv Banquet", "308C Điện Biên Phủ, Phường 4, Quận 3, Thành phố Hồ Chí Minh", cats=("other",))
f2 = t.vendor("t112_F2", "Thisky Adv", "10 Mai Chí Thọ, An Khánh, Quận 2, Thành phố Hồ Chí Minh")
r = t.Root({"other": [e2o], "venue": [e2, f2], "honeymoon": []})
NOAUD = lambda vid: {"vendor_id": vid, "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None}
r.write("venue/enrichment-audit.json", [NOAUD("t112_E2"), NOAUD("t112_F2")])
PL = {"PE2": t.place("Én Adv Banquet & Event Space", "308C Điện Biên Phủ, Phường 4, Quận 3, Hồ Chí Minh"),
      "PF2": t.place("Trung tâm hội nghị Thisky Adv Sala", "Tầng 5, 10 Mai Chí Thọ, An Khánh, Hồ Chí Minh", lat=10.79, lng=106.74)}
r.set_overrides([t.accept_with_snapshot("t112_E2", "PE2", PL["PE2"]), t.accept_with_snapshot("t112_F2", "PF2", PL["PF2"])])
FX = t.fixture(PL, [])
bad = []
rc, out, _ = r.run(t.ENRICH, FX)
if t.pid_of(r.vendor("t112_E2")) != "PE2" or t.pid_of(r.vendor("t112_F2")) != "PF2":
    t.fail("tiền đề hỏng: accept_place không áp (rc=%r): %s" % (rc, out[-200:]))
r.run(t.REFRESH, FX)
t.pool_ids(r)  # build_pool.py --out output/pool-vendors.json
d = json.load(open(os.path.join(r.path, "output", "pool-vendors.json"), encoding="utf-8"))
recs = {v.get("id"): v for v in d.get("vendors", [])}
LH = re.compile(r"^https://lh\d+\.googleusercontent\.com/")
for vid in ("t112_F2", "t112_E2"):
    gp = (recs.get(vid) or {}).get("google_photos") or []
    if not gp or not all(LH.match(p.get("uri", "")) and p.get("attributions") for p in gp):
        bad.append("%s: bản ghi trong pool-vendors.json không có ảnh Google có ghi công (google_photos=%d ảnh)%s"
                   % (vid, len(gp), " — vendor ở nhiều category, bản 'other' không ảnh thắng khi gộp" if vid == "t112_E2" else ""))
t.done(bad, "vendor accept_place ở nhiều category vẫn mang ảnh Google vào pool")
