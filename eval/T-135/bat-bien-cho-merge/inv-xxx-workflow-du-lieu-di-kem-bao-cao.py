#!/usr/bin/env python3
"""Nguồn: T-135 (spec products/T-135-resolve-tu-chay-pool-o-back.md v3, "Bất biến đề xuất"), qua Spec Gate 2026-11-13 (spec-critic); nguyên văn bản đề xuất của product.
Nằm ở eval/T-135/bat-bien-cho-merge/ cho tới khi PR code T-135 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào eval/invariants/planner/admin/vendor-enrich/ và đặt số.
Bất biến đề xuất (planner/admin/vendor-enrich) · nguồn: spec T-135/T-133, ADR-068 mục 3; sự cố thật: tohong#90 (enrich run 43235417847) merge SAU #89 làm enrich-report.json cũ lại, INV-003 đỏ trên main.
INV-??? · Mọi workflow của tohong thêm vào PR/nhánh một file nguồn của báo cáo (vendors.json, raw_vendors.json, removed_vendors.json, enrichment-audit.json, manual_overrides.json) cũng phải đưa `enrich-report.json`
  vào cùng commit: (a) bước `peter-evans/create-pull-request` có add-paths chứa enrich-report.json, hoặc vòng `git add` (apply-review-rule) có mẫu enrich-report.json; (b) có bước `run:` gọi build_enrich_report.py đứng
  TRƯỚC bước đó. Bổ sung cho INV-003 (động, trên dữ liệu đã commit): INV-003 đỏ SAU khi PR hỏng đã merge; bất biến này đỏ NGAY khi workflow mới quên bước, trước khi có PR nào.
Tĩnh, không mạng. Repo: TOHONG_REPO hoặc ../tohong. Không thấy .github/workflows hoặc build_enrich_report.py: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. 0 = đạt."""
import glob, os, re, sys
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML"); sys.exit(1)
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isdir(os.path.join(c, ".github", "workflows"))), None)
if not repo or not os.path.isfile(os.path.join(repo, "tools", "scraper", "build_enrich_report.py")):
    print("PASS chưa áp dụng (không thấy tohong hoặc build_enrich_report.py)"); sys.exit(0)
SRC = re.compile(r"(vendors|raw_vendors|removed_vendors|enrichment-audit|manual_overrides)(\.json|\*)|\*/vendors\.json")
bad = []
for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    n = os.path.basename(p); wf = yaml.safe_load(open(p, encoding="utf-8")) or {}
    for jn, j in (wf.get("jobs") or {}).items():
        steps = j.get("steps") or []
        rep = next((i for i, s in enumerate(steps) if "build_enrich_report.py" in str(s.get("run", ""))), None)
        for i, s in enumerate(steps):
            text = ""
            if str(s.get("uses", "")).startswith("peter-evans/create-pull-request"):
                text = str((s.get("with") or {}).get("add-paths", ""))
            elif re.search(r"\bgit\s+add\b", str(s.get("run", ""))) and re.search(r"\bgit\s+commit\b", str(s.get("run", ""))):
                text = str(s.get("run", ""))
            if not text or not SRC.search(text):
                continue
            if "enrich-report.json" not in text:
                bad.append("%s: bước #%d thêm file dữ liệu nhưng không đưa enrich-report.json vào cùng commit" % (n, i))
            elif rep is None or rep >= i:
                bad.append("%s: không có bước build_enrich_report.py đứng trước bước #%d" % (n, i))
if bad:
    print("FAIL " + bad[0] + (" (+%d)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS mọi workflow thêm file dữ liệu đều sinh lại và đưa enrich-report.json vào cùng commit"); sys.exit(0)
