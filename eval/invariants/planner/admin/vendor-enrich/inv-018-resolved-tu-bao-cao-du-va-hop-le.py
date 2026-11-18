#!/usr/bin/env python3
"""Nguồn: T-207 (products/T-207-accept-place-lay-tu-enrich.md, Hành vi 1, 5; Quyết định 2, 4), qua Spec Gate 2026-11-18 (spec-critic).
Dựng từ bản nháp eval/T-207/inv-proposed-resolved-tu-enrich-day-du.py, sửa cho khớp spec: business_status là "chuỗi không rỗng" (spec Quyết định 2,
"nguyên văn Google"), không phải tập ba giá trị cố định. Xanh trên main hiện tại ('chưa áp dụng'); gác cùng lô T-207 (ADR-028), vào
eval/invariants/planner/admin/vendor-enrich/ khi PR merge (số do Chief đặt).
INV-018 (vendor-enrich) · Dữ liệu thay Google phải đủ và không bịa.
(a) Mọi mục accept_place trong tools/scraper/output/*/manual_overrides.json có resolved.resolved_from == "enrich_report": resolved.place_id == place_id của mục;
    name, formatted_address không rỗng; business_status là chuỗi không rỗng (không null); resolved_at dạng YYYY-MM-DDTHH:MM:SSZ.
(b) Mọi dòng enrich-report.json có google mang khoá business_status/checked_at: business_status là null hoặc chuỗi không rỗng; checked_at là null hoặc dạng trên.
Tĩnh, không mạng. Repo: TOHONG_REPO hoặc ../tohong. Thiếu repo: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. Thoát 0 = đạt."""
import glob, json, os, re, sys
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
T = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if p and os.path.isfile(os.path.join(p, "tools", "scraper", "enrich.py"))), None)
if not T:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
nonempty = lambda v: isinstance(v, str) and v.strip() != ""
bad, n, m = [], 0, 0
for p in sorted(glob.glob(os.path.join(T, "tools", "scraper", "output", "*", "manual_overrides.json"))):
    for e in json.load(open(p, encoding="utf-8")).get("overrides", []):
        rs = e.get("resolved") or {}
        if e.get("action") == "accept_place" and rs.get("resolved_from") == "enrich_report":
            n += 1
            if rs.get("place_id") != e.get("place_id") or not nonempty(rs.get("name")) or not nonempty(rs.get("formatted_address")) \
                    or not nonempty(rs.get("business_status")) or not ISO.match(str(rs.get("resolved_at"))):
                bad.append("%s: resolved từ báo cáo thiếu/sai (%s)" % (e.get("vendor_id"), {k: rs.get(k) for k in ("place_id", "business_status", "resolved_at")}))
for p in sorted(glob.glob(os.path.join(T, "tools", "scraper", "output", "*", "enrich-report.json"))):
    for r in json.load(open(p, encoding="utf-8")).get("vendors", []):
        g = r.get("google")
        if not isinstance(g, dict) or not ("business_status" in g or "checked_at" in g):
            continue
        m += 1
        bs, ca = g.get("business_status"), g.get("checked_at")
        if not (bs is None or nonempty(bs)) or not (ca is None or ISO.match(str(ca))):
            bad.append("%s: google.business_status/checked_at sai (%r, %r)" % (r.get("id"), bs, ca))
if bad:
    print("FAIL %s%s" % (bad[0], " (+%d)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS %d mục resolved_from=enrich_report, %d dòng báo cáo có trạng thái: đủ và hợp lệ" % (n, m) if (n or m) else "PASS chưa áp dụng (chưa có mục resolved_from=enrich_report, báo cáo chưa có trạng thái)"); sys.exit(0)
