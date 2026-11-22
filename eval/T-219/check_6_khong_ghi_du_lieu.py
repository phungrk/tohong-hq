#!/usr/bin/env python3
"""T-219 tiêu chí 6 (offline): P0 chỉ đo. Sau dry-run, chạy thật, chạy bị dừng vì trần và stage=report, mọi file dưới output/ (vendors.json, enrich-report.json,
manual_overrides.json, removed_vendors.json …) giữ nguyên từng byte; file mới chỉ nằm dưới thư mục --out và run-logs/ (không có file nào khác trong cây scraper)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
files, removed, fx, meta = k.world()
r = k.Root(files, removed)
before_all = r.all_files()
before = r.data_tree()
if not before:
    bad.append("setup: cây output/ rỗng")


def audit(tag):
    now = r.data_tree()
    if now != before:
        diff = sorted(set(now) ^ set(before)) or [p for p in now if now[p] != before.get(p)]
        bad.append("%s: file dữ liệu đổi: %s" % (tag, diff[:3]))
    extra = [p for p in r.all_files() if p not in before_all and not p.startswith(("p0-out" + os.sep, "run-logs" + os.sep))]
    if extra:
        bad.append("%s: file mới ngoài --out và run-logs/: %s" % (tag, extra[:3]))


rc, out, _ = r.run(k.std_args() + ["--dry-run"], dict(fx, deny=True), maps=False, gemini=False)
audit("dry-run")
rc, out, _ = r.run(k.std_args("p0-out/real"), fx, run_id="901")
audit("chạy thật")
rc, out, _ = r.run(k.std_args("p0-out/capped", max_gemini=3, max_details=2), fx, run_id="902")
audit("chạy bị dừng vì trần")
rows = r.rows("p0-out/real/private/samples.csv") or []
if not rows:
    bad.append("không có samples.csv để chạy stage=report")
else:
    import csv
    lp = os.path.join(r.base, "labels.csv")
    with open(lp, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["place_id", "capu_label"])
        for x in rows:
            w.writerow([x["place_id"], x["ai_label"]])
    rc, out, calls = r.run(["--state", "HCMC", "--category", "transport", "--stage", "report", "--run-dir", "p0-out/real", "--labels", lp, "--out", "p0-out/real"], dict(fx, deny=True), maps=False, gemini=False)
    if rc != 0 or calls:
        bad.append("stage=report phải thoát 0, 0 lượt gọi, không cần khoá (rc=%d, calls=%d): %s" % (rc, len(calls), out.strip()[-120:]))
    audit("stage=report")
k.done(bad, "output/ giữ nguyên từng byte qua dry-run, chạy thật, chạy bị dừng và stage=report; file mới chỉ ở --out và run-logs/")
