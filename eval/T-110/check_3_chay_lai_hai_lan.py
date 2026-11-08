#!/usr/bin/env python3
"""T-110 tiêu chí 3: chạy lại không đổi gì. OFFLINE (Google giả).
Spec: products/T-110-duyet-tay-venue.md, "Chạy lại và thứ tự".
Kịch bản: 5 mục accept_place có snapshot (A..E, bị các cổng từ chối nếu không duyệt tay), 1 mục accept_place chỉ có maps_link (L, cần bước resolve), 1 remove (X),
1 temporarily_closed (P, đã có dòng audit low_confidence như Pergola thật), reject_match R/R2, cùng F, Z.
Chuỗi lệnh của workflow: resolve_overrides -> enrich venue -> refresh_photos -> enrich venue (áp lại).
  Lượt 1 áp mọi thứ. Lượt 2 chạy lại ĐÚNG chuỗi đó: MỌI file trong output/ (kể cả manual_overrides.json, audit, removed_vendors.json, review-needed.csv) giữ nguyên
  byte (không đổi cả dấu thời gian), bước resolve và refresh gọi 0 lượt Google, enrich gọi Text Search đúng 1 lượt (chỉ P, vì tạm đóng cửa luôn được thử lại) và
  GOOGLE_USAGE của enrich là text_search=1 photo_details=0 photo_media=0.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []
PL, RULES = t.scen_places(), t.scen_search_rules()
PL["PL"] = t.place("Nhà hàng Lima Garden", "40 Pasteur, Bến Nghé, Hồ Chí Minh", lat=10.78, lng=106.70)
PL["PP"] = t.place("Pergola Garden Restaurant", "28A Trần Cao Vân, Phường, Phú Nhuận, Hồ Chí Minh", status="CLOSED_TEMPORARILY")
LINK = "https://share.google/lima1"
LINKS = {LINK: {"status": 200, "to": "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Lima+Garden/@10.7800,106.7000,17z/data=!3m1!4b1"}}
RULES = RULES + [("Lima Garden", ["PL"]), ("Pergola Test", ["PP"])]
FX = t.fixture(PL, RULES, LINKS)

vs = t.scen_vendors(True)
vs.append(t.vendor("t110_L", "Nhà hàng Lima", "40 Pasteur, Quận 1, Thành phố Hồ Chí Minh"))
vs.append(t.vendor("t110_P", "Nhà Hàng Pergola Test", "28A Trần Cao Vân, P.12, Quận Phú Nhuận, Thành phố Hồ Chí Minh"))
r = t.Root({"venue": vs, "honeymoon": []})
r.write("venue/removed_vendors.json", [t.closed_record(t.CLOSED_Y)])
r.write("venue/enrichment-audit.json", [t.scen_r2_audit(),
        {"vendor_id": "t110_L", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None},
        {"vendor_id": "t110_P", "status": "low_confidence", "matched_name": "Pergola Garden Restaurant", "confidence": 0.226, "place_id": None,
         "formatted_address": PL["PP"]["address"], "address_match": True, "reject_reason": "low_score", "candidate_place_id": ""}])
ENT = [t.accept_with_snapshot(i, p[0], PL[p[0]]) for i, (n, a, p, _) in t.SCEN.items()]
ENT += [t.entry("t110_L", "accept_place", maps_link=LINK, place_id=None), t.entry("t110_X", "remove"), t.entry("t110_P", "temporarily_closed"),
        t.entry("t110_R", "reject_match", place_id="PR"), t.entry("t110_R2", "reject_match", place_id="PR2")]
r.set_overrides(ENT)


def chain():
    res = {}
    res["resolve"] = r.run(t.RESOLVE, FX)
    res["enrich"] = r.run(t.ENRICH, FX)
    res["refresh"] = r.run(t.REFRESH[:-1] + ["100"], FX)
    res["enrich2"] = r.run(t.ENRICH, FX)
    return res


res1 = chain()
t1 = r.tree()
if "OVERRIDE_FILE_INVALID" in "".join(x[1] for x in res1.values()):
    t.fail("file duyệt tay hợp lệ bị từ chối ở lượt 1: " + [l for l in "".join(x[1] for x in res1.values()).splitlines() if "OVERRIDE_FILE_INVALID" in l][0][:120])
v1 = {x["id"]: (t.pid_of(x), bool(x.get("google_photos"))) for x in r.vendors()}
for vid in ("t110_A", "t110_B", "t110_C", "t110_D", "t110_E", "t110_L"):
    if not v1.get(vid, (None,))[0]:
        bad.append("lượt 1: %s chưa có place_id" % vid)
    elif not v1[vid][1]:
        bad.append("lượt 1: %s có place_id mà chưa có ảnh Google sau refresh_photos" % vid)
if r.vendor("t110_X") is not None:
    bad.append("lượt 1: X chưa bị gỡ")
if t.has_pid(r.vendor("t110_P")) or r.vendor("t110_P") is None:
    bad.append("lượt 1: P (tạm đóng cửa) phải còn trong danh sách và không có place_id")

res2 = chain()
t2 = r.tree()
diff = sorted(k for k in set(t1) | set(t2) if t1.get(k) != t2.get(k))
if diff:
    bad.append("lượt 2 đổi file: %s" % diff[:4])
for step in ("resolve", "refresh"):
    n = len(res2[step][2])
    if n:
        bad.append("lượt 2: bước %s gọi Google %d lượt (mong 0)" % (step, n))
ts = [x for step in ("enrich", "enrich2") for x in res2[step][2] if x["kind"] == "search"]
if len(ts) != 2:  # mỗi lệnh enrich của lượt 2 thử lại đúng P một lần
    bad.append("lượt 2: tổng Text Search của hai lệnh enrich = %d (mong 2, chỉ vendor tạm đóng cửa P, mỗi lệnh một lần)" % len(ts))
elif any("Pergola Test" not in x["q"] for x in ts):
    bad.append("lượt 2: Text Search không phải của P")
u = t.usage(res2["enrich"][1])
if u != {"text_search": 1, "photo_details": 0, "photo_media": 0}:
    bad.append("lượt 2: GOOGLE_USAGE của enrich = %r (mong text_search=1 photo_details=0 photo_media=0)" % u)

t.done(bad, "chuỗi resolve, enrich, refresh, enrich chạy lại: không file nào đổi byte, resolve/refresh gọi 0 lượt, enrich chỉ thử lại vendor tạm đóng cửa")
