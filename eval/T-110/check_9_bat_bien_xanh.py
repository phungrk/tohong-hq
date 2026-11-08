#!/usr/bin/env python3
"""T-110 tiêu chí 9: bất biến vùng planner/vendor/images INV-012..019 vẫn xanh. OFFLINE.
Spec: products/T-110-duyet-tay-venue.md, "Ràng buộc" và "Thứ tự ưu tiên" (bất biến thắng duyệt tay).
A. Trên dữ liệu thật (tohong, tohong-back cạnh tohong-hq): chạy từng eval/invariants/planner/vendor/images/inv-012..019 (python3 -I, không tham số): tất cả PASS.
B. Trên trạng thái fixture SAU KHI duyệt tay (dựng một repo `tohong` tạm có tools/scraper là bản sao code thật + output fixture): chạy enrich + refresh_photos với các mục
   accept_place mà luật tự động từ chối (độ tin 0,455 và address_match=false kiểu Thiskyhall; no_match kiểu Én; cùng A..E của check_2, reject_match, remove, tạm đóng cửa),
   rồi chạy INV-016..019 và bản nháp INV-015 có điều khoản miễn với TOHONG_REPO trỏ vào repo tạm: tất cả PASS. Bản ghi duyệt tay giữ confidence thật (Thiskyhall < 0,6, address_match=false). Đối chứng (INV-015 phải ĐỎ): xoá mục accept_place; mục lệch place_id; bản ghi tự động bị gắn manual_override=true. Vậy bản ghi duyệt tay không làm hỏng INV-015 nếu và chỉ nếu có mục tương ứng,
   INV-016 (không ngoài tỉnh), INV-017 (một place_id một địa chỉ gốc), và code vẫn bám hàm chuẩn (INV-018/019). Spec KHÔNG tự sửa bất biến: điều khoản miễn là bản nháp, Chief of Staff ghi ADR và thay vào bể (điều kiện merge). Phần A dùng INV-015 hiện có trong bể: đỏ trên dữ liệu thật sau khi áp Thiskyhall cho tới khi điều khoản được thay.
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
        bad.append("dữ liệu thật: %s: %s%s" % (os.path.basename(p), last[0][:140], " (INV-015 chưa có điều khoản miễn? Điều kiện merge: xem spec 'Điều khoản miễn INV-015')" if "015" in os.path.basename(p) else ""))

TH, EN = "marry_f8b40ba4ddef", "marry_d4380c0b3cf3"  # id thật: decision ADR-048 nhắc đúng hai id này (điều kiện của điều khoản miễn)
PL, RULES = t.scen_places(), t.scen_search_rules()
PL["PTH"] = t.place("Trung tâm hội nghị Thiskyhall Sala", "Tầng 5, Cổng D6/10 Mai Chí Thọ, P, An Khánh, Hồ Chí Minh 700000", lat=10.795, lng=106.74)
PL["PEN"] = t.place("Én Banquet & Event Space", "308C Điện Biên Phủ, Phường 4, Hồ Chí Minh", lat=10.78, lng=106.68)
vs = t.scen_vendors(True)
vs.append(t.vendor(TH, "Thiskyhall", "Lầu 5, Số 10 Mai Chí Thọ, Khu đô thị Sala, An Khánh, TPHCM, Quận 2, Thành phố Hồ Chí Minh"))
vs.append(t.vendor(EN, "Én Banquet & Event Space", "Lầu 7 tòa nhà Robot Tower, 308C Điện Biên Phủ, Phường 4, Quận 3, Thành phố Hồ Chí Minh"))
vs.append(t.vendor("t110_pg", "Nhà Hàng Tiệc Cưới Ngoài Trời Pergola", "28A Trần Cao Vân, P.12, Quận Phú Nhuận, Thành phố Hồ Chí Minh"))
r = t.Root({"venue": vs, "honeymoon": []}, parent="repo")
r.write("venue/removed_vendors.json", t.scen_removed(False))
r.write("venue/enrichment-audit.json", t.scen_audit_rows() + [
        {"vendor_id": EN, "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None}])
ENT = [t.accept_with_snapshot(TH, "PTH", PL["PTH"]), t.accept_with_snapshot(EN, "PEN", PL["PEN"]), t.entry("t110_X", "remove"),
       t.entry("t110_R", "reject_match", place_id="PR"), t.entry("t110_R2", "reject_match", place_id="PR2"), t.entry("t110_pg", "temporarily_closed")]
r.set_overrides(ENT)
FX = t.fixture(PL, RULES + [("Ngoài Trời Pergola", [])])
r.run(t.ENRICH, FX)
r.run(t.REFRESH[:-1] + ["100"], FX)
r.run(t.ENRICH, FX)
g = t.glog(r.vendor(TH) or {})
if not (g and t.has_pid(r.vendor(EN))):
    bad.append("fixture: Thiskyhall/Én kiểu duyệt tay chưa có place_id (không thể kiểm bất biến trên trạng thái sau duyệt tay)")
elif not (isinstance(g.get("confidence"), (int, float)) and g["confidence"] < 0.6 and g.get("address_match") is False):
    bad.append("fixture: Thiskyhall phải giữ số đo thật (< 0,6, address_match=false) để thử điều khoản miễn; thấy %r/%r" % (g.get("confidence"), g.get("address_match")))
DRAFT = os.path.join(t.HERE, "inv-015-dieu-khoan-mien-ban-nhap.py")
env = {"TOHONG_REPO": r.base}
for p in t.inv_scripts(16, 17, 18, 19) + [DRAFT]:
    rc, last = run_inv(p, env)
    if rc != 0:
        bad.append("sau duyệt tay (fixture): %s: %s" % (os.path.basename(p), last[0][:160]))
    elif "chưa áp dụng" in last[0]:
        bad.append("sau duyệt tay (fixture): %s báo 'chưa áp dụng'" % os.path.basename(p))
# đối chứng: INV-015 (bản có điều khoản miễn) PHẢI đỏ khi bản ghi manual_override không có mục tương ứng
import copy as _copy
good = _copy.deepcopy(ENT)
r.set_overrides([e for e in good if e["vendor_id"] != TH])
rc, last = run_inv(DRAFT, env)
if rc == 0:
    bad.append("đối chứng: xoá mục accept_place của Thiskyhall mà INV-015 (có điều khoản miễn) vẫn xanh: bản ghi manual_override giả qua được")
mis = _copy.deepcopy(good)
for e in mis:
    if e["vendor_id"] == TH:
        e["place_id"] = "PLECH"; e["resolved"]["place_id"] = "PLECH"
r.set_overrides(mis)
rc, last = run_inv(DRAFT, env)
if rc == 0:
    bad.append("đối chứng: mục accept_place lệch place_id mà INV-015 vẫn xanh")
r.set_overrides(good)
fake = r.vendors("venue")
for v in fake:
    if v["id"] == "t110_F" and v.get("enrichment_log"):
        v["enrichment_log"][-1]["manual_override"] = True
        v["enrichment_log"][-1]["confidence"] = 0.1
r.write("venue/vendors.json", {"vendors": fake})
rc, last = run_inv(DRAFT, env)
if rc == 0:
    bad.append("đối chứng: bản ghi tự động bị gắn manual_override=true (không có mục) mà INV-015 vẫn xanh")
t.done(bad, "INV-012..019 xanh trên dữ liệu thật; INV-016..019 và INV-015 (bản có điều khoản miễn, eval/T-110/inv-015-dieu-khoan-mien-ban-nhap.py) xanh trên trạng thái fixture sau duyệt tay, và INV-015 đỏ với bản ghi manual_override không có mục tương ứng (độ tin 0,455, no_match, G1/G3/G4/G5 bị thắng, reject_match, remove)")
