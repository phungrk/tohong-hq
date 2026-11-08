#!/usr/bin/env python3
"""BẢN NHÁP ĐIỀU KHOẢN MIỄN cho INV-015 (điều kiện merge của T-110; Chief of Staff ghi ADR rồi thay file này vào eval/invariants/planner/vendor/images/inv-015-*.py).
Nguồn: products/T-110-duyet-tay-venue.md "Điều khoản miễn INV-015"; defect handoffs/T-110-D1.md (B2). Mọi vế khác của INV-015 GIỮ NGUYÊN.
Thêm đúng một điều khoản: vế accept_match(confidence, address_match) được MIỄN cho
  (i)  bản ghi enrichment_log[google_maps] có manual_override=true, và
  (ii) dòng audit có manual_override='accept_place',
CHỈ KHI tools/scraper/output/HCMC/manual_overrides.json có mục accept_place cùng vendor_id với resolved.place_id BẰNG place_id của bản ghi/dòng đó và `decision` của mục
trỏ tới file trong HQ có `decided_by: capu` và nhắc vendor_id. Bản ghi/dòng manual_override KHÔNG có mục tương ứng thì không được miễn và bị coi là bản ghi giả: ĐỎ.
Vẫn áp cho bản ghi được miễn: address_source = snapshot, có formatted_address, cờ address_match (nếu có) bằng giá trị tính lại.
"""
import glob, importlib.util, json, os, sys
def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "eval", "T-106", "_common.py")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
HQ = _hq()
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
import re as _re


def _exempt(vid, pid):
    """Có mục accept_place khớp vendor_id + resolved.place_id, decision của Capu."""
    fp = os.path.join(t, "tools", "scraper", "output", "HCMC", "manual_overrides.json")
    try:
        doc = json.load(open(fp, encoding="utf-8"))
    except (OSError, ValueError):
        return False
    for e in doc.get("overrides") or []:
        if e.get("vendor_id") == vid and e.get("action") == "accept_place" and (e.get("resolved") or {}).get("place_id") == pid and pid:
            d = os.path.join(HQ, str(e.get("decision") or "?"))
            if os.path.isfile(d):
                txt = open(d, encoding="utf-8").read()
                return bool(_re.search(r"^decided_by:\s*capu\s*$", txt, _re.M)) and vid in txt
    return False



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
            if e.get("manual_override") is True and not _exempt(i, e["place_id"]):
                bad.append((i, "enrichment_log", "manual_override=true nhưng không có mục accept_place tương ứng (bản ghi giả)")); continue
            miễn = e.get("manual_override") is True
            if (not miễn and not c.accept_match(e.get("confidence"), am)) or (e.get("address_match") is not None and e.get("address_match") is not am):
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
        if a.get("manual_override") == "accept_place":
            if not _exempt(i, a.get("place_id")):
                bad.append((i, "audit", "manual_override=accept_place nhưng không có mục tương ứng (dòng giả)"))
            continue
        if not c.accept_match(a.get("confidence"), c.address_match(o, a["formatted_address"])) and (a.get("status") != "low_confidence" or haspid):
            bad.append((i, "audit", "bị luật từ chối nhưng status=%r, có place_id=%s" % (a.get("status"), haspid)))
if bad: print("FAIL %d vi phạm cổng nhận khớp, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS nhận khớp có cổng (%d bản ghi place_id mới tính lại được address_match từ địa chỉ gốc)" % n); sys.exit(0)
