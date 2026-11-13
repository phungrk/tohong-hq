#!/usr/bin/env python3
"""Nguồn: T-147 (spec products/T-147-drawer-vendor-enrich.md v2, Hành vi 1-2), rút bởi spec-critic tại Spec Gate 2026-11-13.
Nằm ở eval/T-147/bat-bien-cho-merge/ cho tới khi ba PR T-147 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào eval/invariants/planner/admin/vendor-enrich/ và đặt số.
INV-??? (planner/admin/vendor-enrich) · Dữ liệu nguồn nhúng trong báo cáo enrich không mang liên hệ hay địa chỉ của vendor:
  trong tools/scraper/output/<state>/enrich-report.json (repo tohong) và lib/vendorEnrichReport.generated.js (repo tohong-back, nếu có):
  (a) không mục nào của `pool_catalog` có khoá (hoặc khoá gốc) thuộc contact / address / address_source / phone / email / website / facebook / zalo;
  (b) không `pool_input` nào (record, audit) có các khoá đó ở bất kỳ cấp nào;
  (c) mọi khoá gốc của `pool_input.record` đều là khoá gốc của một mục `pool_catalog` có file vendors.json (báo cáo không nhúng trường ngoài danh mục).
Lý do: báo cáo được nhúng vào Worker và hiện ra drawer; liên hệ/địa chỉ không bao giờ được đi theo đường này (chữ mô tả nguyên văn là phạm vi T-148).
Chưa có `pool_input` trong báo cáo: PASS 'chưa áp dụng'. Tĩnh, không mạng. Repo: TOHONG_REPO / TOHONG_BACK_REPO, rồi ../tohong, ../tohong-back.
Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import glob, json, os, sys

d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
HQ = d
def find(env, rel, marker):
    for c in (os.environ.get(env), os.path.join(HQ, "..", rel)):
        if c and os.path.exists(os.path.join(c, marker)):
            return os.path.abspath(c)
T = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "enrich.py"))
B = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
BAN = {"contact", "address", "address_source", "phone", "email", "website", "facebook", "zalo"}
docs = []
if T:
    for p in sorted(glob.glob(os.path.join(T, "tools", "scraper", "output", "*", "enrich-report.json"))):
        docs.append((os.path.relpath(p, T), json.load(open(p, encoding="utf-8"))))
if B and os.path.isfile(os.path.join(B, "lib", "vendorEnrichReport.generated.js")):
    t = open(os.path.join(B, "lib", "vendorEnrichReport.generated.js"), encoding="utf-8").read()
    i = t.index("=", t.index("export const")) + 1
    docs.append(("tohong-back lib/vendorEnrichReport.generated.js", json.loads(t[i:].strip().rstrip(";"))))
if not docs:
    print("FAIL không thấy báo cáo enrich nào (đặt TOHONG_REPO / TOHONG_BACK_REPO)"); sys.exit(1)

def bad_keys(x, path=""):
    out = []
    if isinstance(x, dict):
        for k, v in x.items():
            if k.lower() in BAN:
                out.append(path + k)
            out += bad_keys(v, path + k + ".")
    elif isinstance(x, list):
        for e in x:
            out += bad_keys(e, path + "[].")
    return out

fails, applied = [], False
for name, rep in docs:
    rows = rep.get("vendors") or []
    if "pool_catalog" not in rep and not any(isinstance(r, dict) and "pool_input" in r for r in rows):
        continue
    applied = True
    cat = rep.get("pool_catalog") or []
    roots = set()
    for f in cat:
        k = str(f.get("key", ""))
        root = k.split("[]")[0].split(".")[0]
        if root.lower() in BAN or k.lower() in BAN:
            fails.append("%s: pool_catalog có mục liên hệ/địa chỉ `%s`" % (name, k))
        if f.get("file") == "vendors.json":
            roots.add(root)
    for r in rows:
        pi = r.get("pool_input") if isinstance(r, dict) else None
        if not isinstance(pi, dict):
            continue
        bk = bad_keys({"record": pi.get("record"), "audit": pi.get("audit")})
        if bk:
            fails.append("%s: %s pool_input có khoá liên hệ/địa chỉ %s" % (name, r.get("id"), bk[:3]))
        rec = pi.get("record") or {}
        extra = sorted(set(rec) - roots) if isinstance(rec, dict) else []
        if extra:
            fails.append("%s: %s pool_input.record có khoá ngoài danh mục %s" % (name, r.get("id"), extra[:3]))
if not applied:
    print("PASS chưa áp dụng (báo cáo chưa có pool_input)"); sys.exit(0)
if fails:
    print("FAIL " + fails[0] + (" (+%d lỗi nữa)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS")
