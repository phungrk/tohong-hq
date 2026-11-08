#!/usr/bin/env python3
"""T-110 tiêu chí 9: bất biến vùng planner/vendor/images INV-012..019 vẫn xanh. OFFLINE.
Spec: products/T-110-duyet-tay-venue.md, "Ràng buộc" và "Thứ tự ưu tiên" (bất biến thắng duyệt tay).
A. Trên dữ liệu thật (tohong, tohong-back cạnh tohong-hq): chạy từng eval/invariants/planner/vendor/images/inv-012..019 (python3 -I, không tham số): tất cả PASS.
B. Trên trạng thái fixture SAU KHI duyệt tay (dựng một repo `tohong` tạm có tools/scraper là bản sao code thật + output fixture): chạy enrich + refresh_photos với các mục
   accept_place mà luật tự động từ chối (độ tin 0,455 và address_match=false kiểu Thiskyhall; no_match kiểu Én; cùng A..E của check_2, reject_match, remove, tạm đóng cửa),
   rồi chạy INV-015, 016, 017, 018, 019 với TOHONG_REPO trỏ vào repo tạm: tất cả PASS. Vậy bản ghi duyệt tay không được làm hỏng INV-015 (nhận khớp có cổng),
   INV-016 (không ngoài tỉnh), INV-017 (một place_id một địa chỉ gốc), và code vẫn bám hàm chuẩn (INV-018/019). Spec KHÔNG sửa bất biến.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []


def run_inv(path, extra_env=None):
    env = dict(os.environ)
    env.update(extra_env or {})
    p = subprocess.run([sys.executable, "-I", path], cwd=t.HQ, env=env, capture_output=True, text=True, timeout=600)
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip().splitlines()[-1:] or [""]


allinv = t.inv_scripts(12, 13, 14, 15, 16, 17, 18, 19)
if len(allinv) != 8:
    t.fail("không đủ 8 bất biến INV-012..019 trong eval/invariants/planner/vendor/images/ (thấy %d); INV-016..019 phải đã được chuyển vào bể" % len(allinv))
for p in allinv:
    rc, last = run_inv(p)
    if rc != 0:
        bad.append("dữ liệu thật: %s: %s" % (os.path.basename(p), last[0][:140]))

PL, RULES = t.scen_places(), t.scen_search_rules()
PL["PTH"] = t.place("Trung tâm hội nghị Thiskyhall Sala", "Tầng 5, Cổng D6/10 Mai Chí Thọ, P, An Khánh, Hồ Chí Minh 700000", lat=10.795, lng=106.74)
PL["PEN"] = t.place("Én Banquet & Event Space", "308C Điện Biên Phủ, Phường 4, Hồ Chí Minh", lat=10.78, lng=106.68)
RULES += [("Thiskyhall", ["PTH"])]
vs = t.scen_vendors(True)
vs.append(t.vendor("t110_th", "Thiskyhall", "Lầu 5, Số 10 Mai Chí Thọ, Khu đô thị Sala, An Khánh, TPHCM, Quận 2, Thành phố Hồ Chí Minh"))
vs.append(t.vendor("t110_en", "Én Banquet & Event Space", "Lầu 7 tòa nhà Robot Tower, 308C Điện Biên Phủ, Phường 4, Quận 3, Thành phố Hồ Chí Minh"))
vs.append(t.vendor("t110_pg", "Nhà Hàng Pergola Test", "28A Trần Cao Vân, P.12, Quận Phú Nhuận, Thành phố Hồ Chí Minh"))
r = t.Root({"venue": vs, "honeymoon": []}, parent="repo")
r.write("venue/removed_vendors.json", [t.closed_record(t.CLOSED_Y)])
r.write("venue/enrichment-audit.json", [t.scen_r2_audit(),
        {"vendor_id": "t110_en", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None}])
ENT = [t.accept_with_snapshot(i, p[0], PL[p[0]]) for i, (n, a, p, _) in t.SCEN.items()]
ENT += [t.accept_with_snapshot("t110_th", "PTH", PL["PTH"]), t.accept_with_snapshot("t110_en", "PEN", PL["PEN"]), t.entry("t110_X", "remove"),
        t.entry("t110_R", "reject_match", place_id="PR"), t.entry("t110_R2", "reject_match", place_id="PR2"), t.entry("t110_pg", "temporarily_closed")]
r.set_overrides(ENT)
FX = t.fixture(PL, RULES + [("Pergola Test", [])])
r.run(t.ENRICH, FX)
r.run(t.REFRESH[:-1] + ["100"], FX)
r.run(t.ENRICH, FX)
if not (t.has_pid(r.vendor("t110_th")) and t.has_pid(r.vendor("t110_en"))):
    bad.append("fixture: Thiskyhall/Én kiểu duyệt tay chưa có place_id (không thể kiểm bất biến trên trạng thái sau duyệt tay)")
for p in t.inv_scripts(15, 16, 17, 18, 19):
    rc, last = run_inv(p, {"TOHONG_REPO": r.base})
    if rc != 0:
        bad.append("sau duyệt tay (fixture): %s: %s" % (os.path.basename(p), last[0][:160]))
    elif "chưa áp dụng" in last[0]:
        bad.append("sau duyệt tay (fixture): %s báo 'chưa áp dụng' (không đo được trên repo tạm)" % os.path.basename(p))
t.done(bad, "INV-012..019 xanh trên dữ liệu thật; INV-015..019 xanh trên trạng thái fixture sau duyệt tay (độ tin 0,455, no_match, G1/G3/G4/G5 bị thắng, reject_match, remove)")
