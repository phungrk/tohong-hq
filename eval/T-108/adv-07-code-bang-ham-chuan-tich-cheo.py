#!/usr/bin/env python3
"""T-108 adv-07 (adversary, Code Gate v7, 2026-11-08). Không gọi Google, chỉ đọc dữ liệu thật.
Ý: hàm cổng của Engineering (tools/scraper/enrichment/address_match.py) phải cho ĐÚNG kết quả của hàm chuẩn eval/T-106/_common.py
(spec T-106 v4.1 Hành vi 2-3) không chỉ trên 79 cặp thật mà trên mọi tổ hợp dữ liệu thật: mọi địa chỉ gốc trong snapshot (99) x mọi
formatted_address Google đã lưu (audit #72 + enrichment_log mọi category) x bốn mức confidence (0,39 / 0,5 / 0,7 / 0,96) x tập địa chỉ
nhà hàng đóng cửa thật (G4). So: address_match, in_province, province_key, street_conflict, reject_reason; và shared_place_id_groups trên
nhóm giả lập (mỗi place_id cho cặp địa chỉ gốc ngẫu nhiên có định).
Mong đợi: 0 lệch. In PASS hoặc FAIL <lý do>; thoát 0/1. Cần TOHONG_REPO."""
import glob, importlib.util, json, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as C  # noqa: E402

t = C.tohong()
spec = importlib.util.spec_from_file_location("eng_am", os.path.join(t, "tools", "scraper", "enrichment", "address_match.py"))
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)
snap = C.load_address_snapshot()
srcs = sorted(set(snap.values()))
gaddrs = set()
hcm = os.path.join(t, "tools", "scraper", "output", "HCMC")
for f in glob.glob(os.path.join(hcm, "*", "enrichment-audit.json")):
    for a in json.load(open(f, encoding="utf-8")):
        if a.get("formatted_address"):
            gaddrs.add(a["formatted_address"])
for recs in C.load_records(t).values():
    for r in recs:
        for e in r.get("enrichment_log") or []:
            if e.get("formatted_address"):
                gaddrs.add(e["formatted_address"])
gaddrs |= {"", "12 Lê Lợi", "1 Nguyễn Huệ, Thành phố Hồ Chí Minh, Việt Nam", "5 Lê Duẩn, TP.HCM 700000", "7 Pasteur, Ho Chi Minh City, Vietnam",
           "9 Trần Phú, Tỉnh Bình Dương", "3 QL13, Hiệp Bình, Hồ Chí Minh", "10 Quốc lộ 1K, Linh Xuân, Hồ Chí Minh, VN"}
gaddrs = sorted(gaddrs)
closed = []
for f in glob.glob(os.path.join(hcm, "*", "removed_vendors.json")):
    for r in json.load(open(f, encoding="utf-8")):
        ct = (r.get("vendor") or {}).get("contact") or {}
        closed += [x for x in (ct.get("address_source"), ct.get("address")) if x]
for f in glob.glob(os.path.join(hcm, "*", "enrichment-audit.json")):
    for a in json.load(open(f, encoding="utf-8")):
        if a.get("status") == "closed_permanently" and a.get("formatted_address"):
            closed.append(a["formatted_address"])
bad, n = [], 0
for g in gaddrs:
    for fn in ("in_province", "province_key"):
        if getattr(C, fn)(g) != getattr(E, fn)(g):
            bad.append("%s(%r): chuẩn %r, code %r" % (fn, g[:50], getattr(C, fn)(g), getattr(E, fn)(g)))
for s in srcs:
    for g in gaddrs:
        n += 1
        if C.address_match(s, g) != E.address_match(s, g):
            bad.append("address_match(%r, %r)" % (s[:40], g[:40]))
        if C.street_conflict(s, g) != E.street_conflict(s, g):
            bad.append("street_conflict(%r, %r)" % (s[:40], g[:40]))
        for conf in (0.39, 0.5, 0.7, 0.96):
            a, b = C.reject_reason(s, g, conf, "HCMC", closed), E.reject_reason(s, g, conf, "HCMC", closed)
            if a != b:
                bad.append("reject_reason(%r, %r, %s): chuẩn %r, code %r" % (s[:40], g[:40], conf, a, b))
rnd = random.Random(108)
pids = ["P%d" % i for i in range(40)]
for _ in range(200):
    items = [("v%d" % i, rnd.choice(pids), rnd.choice(srcs + srcs[:5])) for i in range(30)]
    if C.shared_place_id_groups(items) != E.shared_place_id_groups(items):
        bad.append("shared_place_id_groups lệch trên nhóm giả lập"); break
if bad:
    C.fail("%d lệch giữa code và hàm chuẩn (%d cặp x 4 confidence):\n  " % (len(bad), n) + "\n  ".join(bad[:20]))
C.ok("code khớp hàm chuẩn: %d cặp (địa chỉ gốc x địa chỉ Google) x 4 mức confidence, %d địa chỉ tỉnh, 200 nhóm G6 giả lập" % (n, len(gaddrs)))
