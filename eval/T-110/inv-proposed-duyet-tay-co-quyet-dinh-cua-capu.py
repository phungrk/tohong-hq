#!/usr/bin/env python3
"""BẢN NHÁP bất biến (Spec critic rút vào eval/invariants/planner/vendor/images/ khi spec T-110 qua cổng). Nguồn: products/T-110-duyet-tay-venue.md Hành vi 1.
INV-? · Mọi mục trong tools/scraper/output/HCMC/manual_overrides.json hợp schema và có quyết định của Capu:
schema_version=1; vendor_id duy nhất; action thuộc {accept_place, remove, temporarily_closed, reject_match}; reason không rỗng; approved_by='capu'; approved_on YYYY-MM-DD;
`decision` là đường dẫn trong HQ tới file có dòng `decided_by: capu` và nhắc vendor_id. Lý do: duyệt tay thắng luật tự động nên không agent nào được tự thêm mục.
Chưa có manual_overrides.json hoặc repo tohong: PASS 'chưa áp dụng'. Không gọi Google. Chạy không tham số (python3 -I). Mã thoát 0 = đạt."""
import json, os, re, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
fp = t and os.path.join(t, "tools", "scraper", "output", "HCMC", "manual_overrides.json")
if not fp or not os.path.isfile(fp):
    print("PASS chưa áp dụng (chưa có manual_overrides.json)"); sys.exit(0)
try:
    doc = json.load(open(fp, encoding="utf-8"))
except ValueError as e:
    print("FAIL manual_overrides.json không phải JSON: %s" % e); sys.exit(1)
bad, seen = [], set()
if doc.get("schema_version") != 1:
    bad.append("schema_version != 1")
for e in doc.get("overrides") or []:
    v = e.get("vendor_id")
    if not v or v in seen: bad.append("vendor_id thiếu/trùng %r" % v)
    seen.add(v)
    if e.get("action") not in ("accept_place", "remove", "temporarily_closed", "reject_match"): bad.append("%s: action %r" % (v, e.get("action")))
    if not (e.get("reason") or "").strip(): bad.append("%s: thiếu reason" % v)
    if e.get("approved_by") != "capu": bad.append("%s: approved_by %r" % (v, e.get("approved_by")))
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(e.get("approved_on") or "")): bad.append("%s: approved_on %r" % (v, e.get("approved_on")))
    d = os.path.join(HQ, str(e.get("decision") or "?"))
    if not os.path.isfile(d): bad.append("%s: decision %r không tồn tại" % (v, e.get("decision"))); continue
    txt = open(d, encoding="utf-8").read()
    if not re.search(r"^decided_by:\s*capu\s*$", txt, re.M) or str(v) not in txt: bad.append("%s: decision thiếu decided_by: capu hoặc không nhắc vendor_id" % v)
if bad:
    print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d mục duyệt tay đều hợp schema và có quyết định của Capu" % len(seen)); sys.exit(0)
