#!/usr/bin/env python3
"""Nguồn: T-106 (spec products/T-106-enrich-venue.md v3, Hành vi 2-3 + "Bất biến đề xuất" B; defect handoffs/T-106-D1.md, T-106-D2.md;
qua Spec Gate lần 3 2026-11-08, spec-critic; bản nháp eval/T-106/inv-proposed-nhan-khop-co-cong.py, siết thêm: ứng viên thiếu formatted_address là đỏ).
INV-015 · Nhận khớp Google Maps có cổng, và cổng được đo từ dữ liệu không do code sinh:
  (i)  Mọi enrichment_log[google_maps] có place_id thuộc venue, hoặc có formatted_address, hoặc vendor có contact.address_source ("bản ghi mới"):
       có address_source (với venue có trong snapshot thì BẰNG địa chỉ marry.vn gốc trong eval/T-106/venue_address_snapshot.json, tohong@46b6bc4),
       có formatted_address, và thỏa confidence >= 0,6 hoặc (confidence >= 0,4 và address_match(địa chỉ gốc, formatted_address)), address_match TÍNH LẠI
       bằng hàm chuẩn eval/T-106/_common.py; cờ address_match đã ghi (nếu có) phải bằng giá trị tính lại.
  (ii) Luật status, trên dòng audit mới nhất của mỗi vendor: no_match không được kèm ứng viên (matched_name hoặc confidence > 0); dòng có ứng viên ở
       bản ghi mới phải có formatted_address, address_source đúng như (i), và nếu luật từ chối thì status = low_confidence và vendor không có place_id.
  Trước khi đo, hàm chuẩn phải khớp eval/T-106/address_pairs.json (khoá ngữ nghĩa: sửa _common.py mà lệch bảng là đỏ).
  Photography cũ (không formatted_address, không địa chỉ gốc vì đã bị ghi đè) không bị tính.
Thiếu eval/T-106/_common.py, snapshot hoặc bảng cặp: FAIL (bất biến dựa vào chúng). Thiếu repo tohong: PASS "chưa áp dụng".
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq, rồi ../tohong cạnh cwd. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, importlib.util, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))
T106 = os.path.join(HQ, "eval", "T-106")
for f in ("_common.py", "venue_address_snapshot.json", "address_pairs.json"):
    if not os.path.isfile(os.path.join(T106, f)):
        print("FAIL thiếu eval/T-106/%s (định nghĩa chuẩn của INV-015)" % f); sys.exit(1)
spec = importlib.util.spec_from_file_location("t106common", os.path.join(T106, "_common.py"))
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
for p in json.load(open(os.path.join(T106, "address_pairs.json"), encoding="utf-8"))["pairs"]:
    if c.address_match(p["vendor"], p["google"]) is not p["expected"]:
        print("FAIL hàm address_match lệch address_pairs.json: %r vs %r (mong %s)" % (p["vendor"][:50], p["google"][:50], p["expected"])); sys.exit(1)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"), os.path.join(os.getcwd(), "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t: print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
snap = c.load_address_snapshot()
bad = []; n = 0


def origin(i, src, is_venue):
    """Địa chỉ gốc để tính, hoặc (None, lý do)."""
    if not (src or "").strip():
        return None, "thiếu contact.address_source"
    if is_venue and i in snap:
        if src.strip() != snap[i].strip():
            return None, "address_source khác địa chỉ marry.vn gốc (snapshot)"
        return snap[i], None
    return src, None


for d in sorted(glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*"))):
    vp = os.path.join(d, "vendors.json")
    if not os.path.isfile(vp): continue
    raw = json.load(open(vp, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
    by = {v.get("id"): v for v in vs}
    is_venue = os.path.basename(d) == "venue"
    for v in vs:
        i, src = v.get("id"), (v.get("contact") or {}).get("address_source")
        for e in v.get("enrichment_log") or []:
            if e.get("source") != "google_maps" or not e.get("place_id"): continue
            if not (is_venue or e.get("formatted_address") or src): continue
            n += 1
            o, why = origin(i, src, is_venue)
            if why: bad.append((i, "enrichment_log", why)); continue
            if not e.get("formatted_address"): bad.append((i, "enrichment_log", "thiếu formatted_address")); continue
            am = c.address_match(o, e["formatted_address"])
            if not c.accept_match(e.get("confidence"), am) or (e.get("address_match") is not None and e.get("address_match") is not am):
                bad.append((i, "enrichment_log", "không qua cổng: confidence=%s, address_match tính lại=%s, cờ ghi=%s" % (e.get("confidence"), am, e.get("address_match"))))
    ap = os.path.join(d, "enrichment-audit.json")
    if not os.path.isfile(ap): continue
    last = {}
    for a in json.load(open(ap, encoding="utf-8")): last[a.get("vendor_id")] = a
    for i, a in last.items():
        if i not in by or not c.has_candidate(a): continue
        if a.get("status") == "no_match":
            bad.append((i, "audit", "no_match nhưng có ứng viên")); continue
        src = (by[i].get("contact") or {}).get("address_source")
        if not (is_venue or a.get("formatted_address") or src): continue
        o, why = origin(i, src, is_venue)
        if why: bad.append((i, "audit", why)); continue
        if not a.get("formatted_address"): bad.append((i, "audit", "ứng viên Google thiếu formatted_address (không tính lại được cổng)")); continue
        haspid = any(e.get("source") == "google_maps" and e.get("place_id") for e in by[i].get("enrichment_log") or [])
        if not c.accept_match(a.get("confidence"), c.address_match(o, a["formatted_address"])) and (a.get("status") != "low_confidence" or haspid):
            bad.append((i, "audit", "bị luật từ chối nhưng status=%r, có place_id=%s" % (a.get("status"), haspid)))
if bad: print("FAIL %d vi phạm cổng nhận khớp, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS nhận khớp có cổng (%d bản ghi place_id mới tính lại được address_match từ địa chỉ gốc)" % n); sys.exit(0)
