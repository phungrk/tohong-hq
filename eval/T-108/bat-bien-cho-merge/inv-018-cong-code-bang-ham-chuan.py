#!/usr/bin/env python3
"""Nguồn: T-108 / spec T-106 v4.1 (products/T-106-enrich-venue.md, Hành vi 2-3: sáu cổng G1-G6, hàm chuẩn eval/T-106/_common.py); rút từ eval đối kháng
eval/T-108/adv-07-code-bang-ham-chuan-tich-cheo.py (adversary, Code Gate v7, 2026-11-08), Chief of Staff đồng ý 2026-11-08.
CHỜ MERGE (ADR-028): đọc code tools/scraper/enrichment/ của PR tohong#72 (chưa merge); chuyển vào eval/invariants/planner/vendor/images/ khi #72 merge.
INV-018 · Hàm cổng của code bằng hàm chuẩn trên mọi tổ hợp dữ liệu thật.
tools/scraper/enrichment/address_match.py (code) phải cho ĐÚNG kết quả của eval/T-106/_common.py (chuẩn) cho: province_key, in_province (mọi địa chỉ Google),
address_match, street_conflict (mọi địa chỉ gốc trong eval/T-106/venue_address_snapshot.json x mọi formatted_address Google đã lưu trong audit và enrichment_log
mọi category HCMC, cộng một bộ ca biên viết tay), reject_reason (thêm 4 mức confidence 0,39/0,5/0,7/0,96 và tập địa chỉ nhà hàng đã gỡ vì CLOSED_PERMANENTLY),
shared_place_id_groups (200 nhóm giả lập, hạt giống cố định). Bảng address_pairs.json đã khoá hàm chuẩn (INV-015); bất biến này khoá CODE bám hàm chuẩn khi dữ liệu lớn lên.
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Repo chưa có tools/scraper/enrichment/settle.py (chưa có sáu cổng): PASS 'chưa áp dụng'. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, importlib.util, json, os, random, sys


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "eval", "T-106", "_common.py")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


HQ = _hq()
cp = os.path.join(HQ, "eval", "T-106", "_common.py")
if not os.path.isfile(cp):
    print("FAIL thiếu eval/T-106/_common.py (hàm chuẩn của sáu cổng)"); sys.exit(1)
_s = importlib.util.spec_from_file_location("t106common", cp)
C = importlib.util.module_from_spec(_s); _s.loader.exec_module(C)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t or not os.path.isfile(os.path.join(t, "tools", "scraper", "enrichment", "settle.py")):
    print("PASS chưa áp dụng (không thấy repo tohong có tools/scraper/enrichment/settle.py)"); sys.exit(0)
amp = os.path.join(t, "tools", "scraper", "enrichment", "address_match.py")
if not os.path.isfile(amp):
    print("FAIL có settle.py nhưng thiếu enrichment/address_match.py (hàm cổng của code)"); sys.exit(1)
_s = importlib.util.spec_from_file_location("eng_address_match", amp)
E = importlib.util.module_from_spec(_s); _s.loader.exec_module(E)
for fn in ("province_key", "in_province", "address_match", "street_conflict", "reject_reason", "shared_place_id_groups"):
    if not callable(getattr(E, fn, None)):
        print("FAIL code thiếu hàm %s trong enrichment/address_match.py" % fn); sys.exit(1)

srcs = sorted(set(C.load_address_snapshot().values()))
hcm = os.path.join(t, "tools", "scraper", "output", "HCMC")


def _rows(pattern):
    for f in glob.glob(os.path.join(hcm, "*", pattern)):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except ValueError:
            continue
        yield from (d.get("vendors", []) if isinstance(d, dict) else d)


gaddrs, closed = set(), []
for a in _rows("enrichment-audit.json"):
    if a.get("formatted_address"):
        gaddrs.add(a["formatted_address"])
        if a.get("status") == "closed_permanently":
            closed.append(a["formatted_address"])
for v in _rows("vendors.json"):
    for e in v.get("enrichment_log") or []:
        if e.get("formatted_address"):
            gaddrs.add(e["formatted_address"])
for r in _rows("removed_vendors.json"):
    if "CLOSED_PERMANENTLY" in (r.get("reason") or ""):
        ct = (r.get("vendor") or {}).get("contact") or {}
        closed += [x for x in (ct.get("address_source"), ct.get("address")) if x]
gaddrs |= {"", "12 Lê Lợi", "1 Nguyễn Huệ, Thành phố Hồ Chí Minh, Việt Nam", "5 Lê Duẩn, TP.HCM 700000", "7 Pasteur, Ho Chi Minh City, Vietnam",
           "9 Trần Phú, Tỉnh Bình Dương", "3 QL13, Hiệp Bình, Hồ Chí Minh", "10 Quốc lộ 1K, Linh Xuân, Hồ Chí Minh, VN",
           "412 - 418 Trần Hưng Đạo B, Chợ Lớn, Hồ Chí Minh", "Tầng 5, Cổng D6/10 Mai Chí Thọ, P, An Khánh, Hồ Chí Minh 700000"}
gaddrs = sorted(gaddrs)
bad, n = [], 0
for g in gaddrs:
    for fn in ("in_province", "province_key"):
        a, b = getattr(C, fn)(g), getattr(E, fn)(g)
        if a != b:
            bad.append("%s(%r): chuẩn %r, code %r" % (fn, g[:50], a, b))
for s in srcs:
    for g in gaddrs:
        n += 1
        for fn in ("address_match", "street_conflict"):
            a, b = getattr(C, fn)(s, g), getattr(E, fn)(s, g)
            if a != b:
                bad.append("%s(%r, %r): chuẩn %r, code %r" % (fn, s[:40], g[:40], a, b))
        for conf in (0.39, 0.5, 0.7, 0.96):
            a, b = C.reject_reason(s, g, conf, "HCMC", closed), E.reject_reason(s, g, conf, "HCMC", closed)
            if a != b:
                bad.append("reject_reason(%r, %r, %s): chuẩn %r, code %r" % (s[:40], g[:40], conf, a, b))
rnd = random.Random(108)
pids = ["P%d" % i for i in range(40)]
for k in range(200):
    items = [("v%d" % i, rnd.choice(pids), rnd.choice(srcs + srcs[:5])) for i in range(30)]
    a, b = C.shared_place_id_groups(items), E.shared_place_id_groups(items)
    if a != b:
        bad.append("shared_place_id_groups lệch ở nhóm giả lập #%d: chuẩn %d vendor, code %d vendor" % (k, len(a), len(b))); break
if bad:
    print("FAIL %d lệch giữa code và hàm chuẩn (%d cặp x 4 confidence):\n  %s" % (len(bad), n, "\n  ".join(bad[:20]))); sys.exit(1)
print("PASS code khớp hàm chuẩn: %d cặp (địa chỉ gốc x địa chỉ Google) x 4 mức confidence, %d địa chỉ tỉnh, 200 nhóm G6 giả lập" % (n, len(gaddrs)))
