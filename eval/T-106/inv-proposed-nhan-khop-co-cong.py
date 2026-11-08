#!/usr/bin/env python3
"""Đề xuất bất biến (planner/vendor/images) từ T-106: nhận khớp Google Maps có cổng, address_match TÍNH LẠI (không tin cờ code ghi).
(i)  Bản ghi enrichment_log[source=google_maps] có place_id VÀ có cả `formatted_address` lẫn contact.address_source (tức từ T-106 trở đi) phải thỏa
     confidence >= 0.6, hoặc confidence >= 0.4 và address_match(address_source, formatted_address) == true, với address_match tính bằng hàm chuẩn
     (eval/T-106/_common.py; khi rút vào bể thì chuyển hàm sang helper cùng thư mục bất biến). Cờ `address_match` đã ghi, nếu có, phải bằng giá trị tính lại.
(ii) Vendor có dòng audit mới nhất status=low_confidence (output/HCMC/<category>/enrichment-audit.json) không có place_id trong enrichment_log cùng thư mục.
Phạm vi (i) giới hạn ở bản ghi có đủ hai địa chỉ để không đỏ oan 73 bản ghi photography cũ (không còn địa chỉ gốc, xem Rủi ro).
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq). Thiếu repo/dữ liệu: PASS 'chưa áp dụng'. Mã thoát 0 = đạt."""
import glob, importlib.util, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
spec = importlib.util.spec_from_file_location("t106common", os.path.join(HQ, "eval", "T-106", "_common.py"))
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t: print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
bad = []; n = 0
for d in glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*")):
    vp = os.path.join(d, "vendors.json")
    if not os.path.isfile(vp): continue
    raw = json.load(open(vp, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
    by = {v.get("id"): v for v in vs}
    for v in vs:
        src = (v.get("contact") or {}).get("address_source")
        for e in v.get("enrichment_log") or []:
            if e.get("source") == "google_maps" and e.get("place_id") and e.get("formatted_address") and src:
                n += 1; am = c.address_match(src, e["formatted_address"])
                if not c.accept_match(e.get("confidence"), am) or ("address_match" in e and e["address_match"] is not am):
                    bad.append((v.get("id"), e.get("confidence"), "tính lại address_match=%s, ghi=%s" % (am, e.get("address_match"))))
    ap = os.path.join(d, "enrichment-audit.json")
    if os.path.isfile(ap):
        last = {}
        for a in json.load(open(ap, encoding="utf-8")): last[a.get("vendor_id")] = a
        for i, a in last.items():
            if a.get("status") == "low_confidence" and i in by and any(e.get("source") == "google_maps" and e.get("place_id") for e in by[i].get("enrichment_log") or []):
                bad.append((i, "low_confidence nhưng có place_id", None))
if bad: print("FAIL %d vi phạm cổng nhận khớp, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS nhận khớp có cổng (%d bản ghi tính lại được address_match)" % n); sys.exit(0)
