#!/usr/bin/env python3
"""Đề xuất bất biến (planner/vendor/images) từ T-106: nhận khớp Google Maps có cổng; address_match TÍNH LẠI từ địa chỉ gốc ngoài code (snapshot marry.vn @46b6bc4), không tin cờ/trường code ghi.
(i)  Vendor venue có bản ghi enrichment_log[google_maps].place_id (hoặc dòng audit có ứng viên) phải: có contact.address_source BẰNG địa chỉ gốc trong
     eval/T-106/venue_address_snapshot.json (khi rút vào bể thì chuyển snapshot + _common.py sang thư mục bất biến), có formatted_address, và thỏa
     confidence >= 0.6, hoặc confidence >= 0.4 và address_match(địa chỉ gốc, formatted_address) == true. Cờ `address_match` đã ghi, nếu có, phải bằng giá trị tính lại.
     Bản ghi google_maps MỚI (thuộc venue, hoặc có formatted_address) mà thiếu address_source là ĐỎ, không bỏ qua. Photography cũ (không formatted_address, không địa chỉ gốc) không bị tính.
(ii) Luật status: dòng audit mới nhất có ứng viên Google (matched_name hoặc confidence > 0) mà luật từ chối thì status = low_confidence và vendor không có place_id; status no_match không được kèm ứng viên.
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq). Thiếu repo/dữ liệu: PASS 'chưa áp dụng'. Mã thoát 0 = đạt."""
import glob, importlib.util, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
spec = importlib.util.spec_from_file_location("t106common", os.path.join(HQ, "eval", "T-106", "_common.py"))
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t: print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
snap = c.load_address_snapshot()
bad = []; n = 0


def gate(i, src, fa, conf, flag, where):
    if i in snap and src != snap[i]:
        return (i, where, "address_source khác địa chỉ gốc snapshot")
    if not src or not fa:
        return (i, where, "thiếu address_source hoặc formatted_address")
    am = c.address_match(snap.get(i, src), fa)
    if not c.accept_match(conf, am) or (flag is not None and flag is not am):
        return (i, where, "tính lại address_match=%s, confidence=%s, cờ ghi=%s" % (am, conf, flag))
    return None


for d in glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*")):
    vp = os.path.join(d, "vendors.json")
    if not os.path.isfile(vp): continue
    raw = json.load(open(vp, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
    by = {v.get("id"): v for v in vs}
    is_venue = os.path.basename(d) == "venue"
    for v in vs:
        src = (v.get("contact") or {}).get("address_source")
        for e in v.get("enrichment_log") or []:
            if e.get("source") == "google_maps" and e.get("place_id") and (is_venue or e.get("formatted_address") or src):
                n += 1
                r = gate(v.get("id"), src, e.get("formatted_address"), e.get("confidence"), e.get("address_match"), "enrichment_log")
                if r: bad.append(r)
    ap = os.path.join(d, "enrichment-audit.json")
    if os.path.isfile(ap):
        last = {}
        for a in json.load(open(ap, encoding="utf-8")): last[a.get("vendor_id")] = a
        for i, a in last.items():
            if i not in by: continue
            haspid = any(e.get("source") == "google_maps" and e.get("place_id") for e in by[i].get("enrichment_log") or [])
            cand = c.has_candidate(a)
            if a.get("status") == "no_match" and cand:
                bad.append((i, "audit", "no_match nhưng có ứng viên"))
            elif cand and a.get("formatted_address") and (is_venue or (by[i].get("contact") or {}).get("address_source")):
                src = (by[i].get("contact") or {}).get("address_source")
                if (is_venue and i in snap and src != snap[i]) or (is_venue and not src):
                    bad.append((i, "audit", "address_source thiếu hoặc khác địa chỉ gốc"))
                    continue
                accepted = c.accept_match(a.get("confidence"), c.address_match(snap.get(i, src), a["formatted_address"])) if src else True
                if not accepted and (a.get("status") != "low_confidence" or haspid):
                    bad.append((i, "audit", "bị luật từ chối nhưng status=%r, có place_id=%s" % (a.get("status"), haspid)))
if bad: print("FAIL %d vi phạm cổng nhận khớp, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS nhận khớp có cổng (%d bản ghi tính lại được address_match từ địa chỉ gốc)" % n); sys.exit(0)
