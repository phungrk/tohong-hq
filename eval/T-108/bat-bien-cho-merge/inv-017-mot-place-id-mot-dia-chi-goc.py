#!/usr/bin/env python3
"""Nguồn: T-108 / spec T-106 v4.1 (products/T-106-enrich-venue.md, Hành vi 2 cổng G6), qua Spec Gate 2026-11-08 (spec-critic); defect adversary adv-06
(Grand Palace và Luxury Palace cùng place_id ở 63 Mạc Đĩnh Chi; TDG CENTER chung place_id với GALA). Bản nháp: eval/T-108/inv-proposed-mot-place-id-mot-dia-chi-goc.py.
CHỜ MERGE: đỏ trên dữ liệu tohong#72 chưa áp lại luật v4; chuyển vào eval/invariants/planner/vendor/images/ khi PR tohong (áp lại) merge.
INV-017 · Một place_id không cho hai địa chỉ gốc khác nhau (chỉ venue).
Trong tools/scraper/output/HCMC/venue/vendors.json, các vendor có enrichment_log[google_maps] place_id GIỐNG NHAU phải có contact.address_source cùng một địa chỉ:
address_match(nguồn A, nguồn B) = true, hoặc chuỗi gốc sau chuẩn hoá A1 bằng nhau (cùng một vendor ghi hai lần / hai tên cùng chỗ). Vi phạm = hai vendor mang ảnh của cùng một nơi
dù marry.vn ghi hai địa chỉ khác nhau: nhiều nhất một trong hai đúng. Chỉ tính venue (photography đã có 2 cụm trùng place_id không có địa chỉ gốc: việc riêng, ngoài phạm vi).
Cùng id ở nhiều category file là MỘT vendor. Phụ thuộc eval/T-106/_common.py. Thiếu repo tohong hoặc thư mục venue: PASS 'chưa áp dụng'. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import importlib.util, json, os, sys
def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "eval", "T-106", "_common.py")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
HQ = _hq()
cp = os.path.join(HQ, "eval", "T-106", "_common.py")
if not os.path.isfile(cp):
    print("FAIL thiếu eval/T-106/_common.py (định nghĩa chuẩn address_match)"); sys.exit(1)
spec = importlib.util.spec_from_file_location("t106common", cp)
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
vp = t and os.path.join(t, "tools", "scraper", "output", "HCMC", "venue", "vendors.json")
if not vp or not os.path.isfile(vp):
    print("PASS chưa áp dụng (không thấy dữ liệu venue)"); sys.exit(0)
raw = json.load(open(vp, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
by = {}
for v in vs:
    src = (v.get("contact") or {}).get("address_source")
    for e in v.get("enrichment_log") or []:
        if e.get("source") == "google_maps" and e.get("place_id") and src:
            by.setdefault(e["place_id"], {})[v["id"]] = src
bad = []
for pid, d in by.items():
    ids = sorted(d)
    for k, x in enumerate(ids):
        for y in ids[k + 1:]:
            if not c.address_match(d[x], d[y]) and c._fold(d[x]) != c._fold(d[y]):
                bad.append("%s và %s cùng place_id ...%s: %r / %r" % (x, y, pid[-6:], d[x][:40], d[y][:40]))
if bad:
    print("FAIL %d cặp vendor venue khác địa chỉ gốc cùng một place_id, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d place_id venue, không place_id nào cho hai địa chỉ gốc khác nhau" % len(by)); sys.exit(0)
