#!/usr/bin/env python3
"""Nguồn: T-110 (spec products/T-110-duyet-tay-venue.md v2, Hành vi 2, 3, 6; ADR-048, ADR-049 mục 2; bản nháp eval/T-110/inv-proposed-du-lieu-khop-file-duyet-tay.py;
qua Spec Gate lần 2 2026-11-08, spec-critic; sửa so với bản nháp: dấu hiệu tạm đóng cửa đọc ở mọi category (spec: "dòng audit mới nhất ở bất kỳ category file nào"),
accept_place xét mọi category, và mục accept_place bị OVERRIDE_ERROR hợp lệ (ngoài tỉnh, đóng cửa, place_conflict, unknown_vendor) không bị tính là lệch).
Nằm ở eval/invariants/planner/vendor/images/ cho tới khi PR T-110 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/images/.
INV-021 · Dữ liệu vendor khớp file duyệt tay, và vendor tạm đóng cửa không hiện trên app.
  (a) accept_place có `resolved` (OPERATIONAL hoặc vắng, trong tỉnh, không chung resolved.place_id với mục accept_place khác, vendor có ở vendors.json nào đó):
      vendor có enrichment_log[google_maps].place_id = resolved.place_id.
  (b) remove: id không có ở vendors.json nào của HCMC và có bản ghi manual=true trong removed_vendors.json (khôi phục được).
  (c) mục khác remove: vendor không nằm trong removed_vendors.json nào (luật tự động, kể cả T-111, không gỡ vendor có mục duyệt tay).
  (d) temporarily_closed, vendor chưa có place_id: dòng audit mới nhất có retry=true và closed_state='temporarily_closed'.
  (e) reject_match: vendor không giữ place_id bị loại.
  (f) vendor có dòng audit mới nhất (ở bất kỳ category) mang closed_state='temporarily_closed' không có trong pool tohong-back (ADR-049: không hiển thị trên app).
Chưa có repo tohong hoặc manual_overrides.json: (a)-(e) không áp; (f) vẫn chạy nếu có cả hai repo. Thiếu cả hai điều kiện: PASS 'chưa áp dụng'. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, importlib.util, json, os, sys


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "eval", "T-106", "_common.py")):
            return d
        d = os.path.dirname(d)
    return None


HQ = _hq()
if not HQ:
    print("FAIL thiếu eval/T-106/_common.py (định nghĩa chuẩn in_province)"); sys.exit(1)
_s = importlib.util.spec_from_file_location("t106common", os.path.join(HQ, "eval", "T-106", "_common.py"))
C = importlib.util.module_from_spec(_s); _s.loader.exec_module(C)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
b = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back"))
          if x and os.path.isfile(os.path.join(x, "lib", "vendorPool.generated.js"))), None)
if not t:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
out = os.path.join(t, "tools", "scraper", "output", "HCMC")


def load(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return d


def rows(x):
    return x.get("vendors", []) if isinstance(x, dict) else (x or [])


def pid(v):
    for e in reversed(v.get("enrichment_log") or []):
        if e.get("source") == "google_maps" and e.get("place_id"):
            return e["place_id"]


cats = sorted(os.path.basename(os.path.dirname(f)) for f in glob.glob(os.path.join(out, "*", "vendors.json")))
allv = {c: {v.get("id"): v for v in rows(load(os.path.join(out, c, "vendors.json"), {}))} for c in cats}
anyv = {}
for c in cats:
    for i, v in allv[c].items():
        anyv.setdefault(i, v)
audit = {}
for f in sorted(glob.glob(os.path.join(out, "*", "enrichment-audit.json"))):
    last = {}
    for r in rows(load(f, [])):
        last[r.get("vendor_id")] = r
    for i, r in last.items():
        audit.setdefault(i, []).append(r)
removed = [((x.get("vendor") or {}).get("id"), x.get("manual")) for f in glob.glob(os.path.join(out, "*", "removed_vendors.json")) for x in rows(load(f, []))]
bad, n = [], 0

if b:
    txt = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
    try:
        pool_ids = {p.get("id") for p in json.loads(txt[txt.index("= [") + 2:txt.rindex("]") + 1])}
    except ValueError as e:
        print("FAIL không giải mã được pool: %s" % e); sys.exit(1)
    for i, rs in audit.items():
        if any(r.get("closed_state") == "temporarily_closed" for r in rs):
            n += 1
            if i in pool_ids:
                bad.append("%s: tạm đóng cửa mà còn trong pool (ADR-049)" % i)

mo = os.path.join(out, "manual_overrides.json")
if not os.path.isfile(mo):
    if bad:
        print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
    print("PASS %d vendor tạm đóng cửa đều vắng khỏi pool; chưa có manual_overrides.json" % n); sys.exit(0)
ov = [e for e in (load(mo, {}).get("overrides") or []) if isinstance(e, dict)]
acc_pids = {}
for e in ov:
    if e.get("action") == "accept_place" and e.get("resolved"):
        acc_pids.setdefault((e["resolved"] or {}).get("place_id"), []).append(e.get("vendor_id"))
for e in ov:
    i, a = e.get("vendor_id"), e.get("action")
    n += 1
    v = anyv.get(i)
    if a != "remove" and any(r[0] == i for r in removed):
        bad.append("%s: có mục %s nhưng nằm trong removed_vendors.json" % (i, a))
    if a == "accept_place" and e.get("resolved"):
        rs = e["resolved"]
        if (rs.get("business_status") not in (None, "", "OPERATIONAL") or not C.in_province(rs.get("formatted_address") or "")
                or len(acc_pids.get(rs.get("place_id"), [])) > 1 or not v):
            continue  # mục bị OVERRIDE_ERROR hợp lệ (spec Hành vi 1.5): vendor giữ trạng thái tự động
        if pid(v) != rs.get("place_id"):
            bad.append("%s: accept_place resolved.place_id=%s nhưng place_id thực=%r" % (i, rs.get("place_id"), pid(v)))
    elif a == "remove":
        if any(i in m for m in allv.values()):
            bad.append("%s: remove nhưng còn trong vendors.json" % i)
        if not any(r[0] == i and r[1] is True for r in removed):
            bad.append("%s: remove nhưng không có bản ghi manual=true trong removed_vendors.json" % i)
    elif a == "temporarily_closed" and v and not pid(v):
        rs = audit.get(i) or []
        if not any(r.get("retry") is True and r.get("closed_state") == "temporarily_closed" for r in rs):
            bad.append("%s: temporarily_closed nhưng dòng audit mới nhất thiếu retry=true + closed_state" % i)
    elif a == "reject_match" and v and e.get("place_id") and pid(v) == e.get("place_id"):
        bad.append("%s: reject_match nhưng vẫn giữ place_id bị loại" % i)
if bad:
    print("FAIL %d lệch file duyệt tay, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d mục duyệt tay / vendor tạm đóng cửa đều khớp dữ liệu và pool" % n); sys.exit(0)
