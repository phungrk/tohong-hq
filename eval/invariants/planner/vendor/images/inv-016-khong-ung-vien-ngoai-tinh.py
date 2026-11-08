#!/usr/bin/env python3
"""Nguồn: T-108 / spec T-106 v4.1 (products/T-106-enrich-venue.md, Hành vi 2 cổng G2), qua Spec Gate 2026-11-08 (spec-critic); defect adversary adv-06
(Fleur de Lys Q1 khớp khách sạn ở Quy Nhơn, mang ảnh vào pool). Bản nháp: eval/T-108/inv-proposed-khong-ung-vien-ngoai-tinh.py.
Đã vào bể sau khi tohong#72 merge (ADR-028).
INV-016 · Không ứng viên Google ngoài tỉnh/thành của vendor.
Mọi bản ghi enrichment_log[google_maps] CÓ place_id và có formatted_address (cấp trên cùng của bản ghi log, như T-106 từ nay ghi), ở mọi tools/scraper/output/HCMC/*/vendors.json,
phải có tỉnh/thành (đoạn cuối của formatted_address, sau khi bỏ 'Việt Nam' và mã bưu chính) thuộc tỉnh/thành của vendor (city HCMC -> Hồ Chí Minh; hàm chuẩn _common.in_province).
Mọi dòng audit status ok/enriched của venue có formatted_address cũng phải thoả. Bản ghi photography cũ (không formatted_address ở cấp log) KHÔNG bị tính.
Giới hạn đã biết (ghi trong spec): từ 7/2025 Bình Dương và Bà Rịa-Vũng Tàu thuộc TP.HCM nên Google ghi 'Hồ Chí Minh' cho chúng; bất biến này không bắt chúng (cổng G3 bắt).
Phụ thuộc eval/T-106/_common.py. Thiếu repo tohong: PASS 'chưa áp dụng'. Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, importlib.util, json, os, sys
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
    print("FAIL thiếu eval/T-106/_common.py (định nghĩa chuẩn in_province)"); sys.exit(1)
spec = importlib.util.spec_from_file_location("t106common", cp)
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
bad, n = [], 0
for d in sorted(glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*"))):
    vp = os.path.join(d, "vendors.json")
    if os.path.isfile(vp):
        raw = json.load(open(vp, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
        for v in vs:
            for e in v.get("enrichment_log") or []:
                if e.get("source") == "google_maps" and e.get("place_id") and e.get("formatted_address"):
                    n += 1
                    if not c.in_province(e["formatted_address"], v.get("city") or "HCMC"):
                        bad.append("%s/%s: %r" % (os.path.basename(d), v.get("id"), e["formatted_address"][:60]))
    ap = os.path.join(d, "enrichment-audit.json")
    if os.path.isfile(ap):
        for a in json.load(open(ap, encoding="utf-8")):
            if a.get("status") in ("ok", "enriched") and a.get("formatted_address"):
                n += 1
                if not c.in_province(a["formatted_address"]):
                    bad.append("audit %s: %r" % (a.get("vendor_id"), a["formatted_address"][:60]))
if bad:
    print("FAIL %d ứng viên Google ngoài tỉnh/thành của vendor được nhận, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d bản ghi/dòng audit nhận khớp đều cùng tỉnh/thành với vendor" % n); sys.exit(0)
