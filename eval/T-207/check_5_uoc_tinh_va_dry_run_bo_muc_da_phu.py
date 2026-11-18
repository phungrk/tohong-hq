#!/usr/bin/env python3
"""T-207 tiêu chí 5 (offline): ước tính trước khi chạy KHÔNG đếm mục đã được báo cáo phủ, nếu không cổng hạn mức (plan_batch.py) chặn oan hoặc Capu thấy số sai.
  - `resolve_overrides.py --dry-run`: dòng cuối `DRY RUN: ... tối đa <n> lượt Places` có n = số mục cần Google; mục đã phủ không in "Place Details"/"mở link".
  - `plan_batch.py --state HCMC --usage-root run-logs` (không --pr-line): `BATCH_ESTIMATE ... resolve=<n>` và `QUOTA_ALLOWED resolve=<m>`:
      lô toàn mục đã phủ: resolve=0, không QUOTA_EXCEEDED;
      lô 2 mục phủ + 1 mục place_id không phủ: resolve=2 (công thức cũ cho một mục place_id: 1 Place Details + 1 Text Search), chỉ tính mục không phủ.
Không Google (deny), không mạng."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

bad = []
FX = k.t.fixture({}, deny=True)
r = k.mk_root(["a", "b", "z"])
k.write_report(r, [k.row("a", "PA"), k.row("b", "PB")])
r.set_overrides([k.acc("a", "PA"), k.acc("b", "PB")])
rc, out, calls = r.run(k.t.RESOLVE + ["--dry-run"], FX)
m = re.search(r"tối đa (\d+) lượt Places", out)
if calls or not m or int(m.group(1)) != 0:
    bad.append("dry-run lô toàn mục phủ: %r (kỳ vọng tối đa 0 lượt Places, 0 Google)" % (out[-200:],))
rc, out, calls = r.run(["plan_batch.py", "--state", "HCMC", "--usage-root", "run-logs"], FX)
m, a = re.search(r"BATCH_ESTIMATE .*?resolve=(\d+)", out), re.search(r"QUOTA_ALLOWED resolve=(\d+)", out)
if not m or int(m.group(1)) != 0 or "QUOTA_EXCEEDED" in out:
    bad.append("plan_batch lô toàn mục phủ: %r (kỳ vọng resolve=0, không QUOTA_EXCEEDED)" % (out[-300:],))
r.set_overrides([k.acc("a", "PA"), k.acc("b", "PB"), k.acc("z", "PZ")])
rc, out, calls = r.run(k.t.RESOLVE + ["--dry-run"], FX)
m = re.search(r"tối đa (\d+) lượt Places", out)
if not m or int(m.group(1)) != 1:
    bad.append("dry-run lô 2 phủ + 1 không phủ: %r (kỳ vọng tối đa 1 lượt Places)" % (out[-200:],))
for line in out.splitlines():
    if line.startswith("SẼ RESOLVE") and re.search(r"\b[ab]\b", line.split(":")[0]) and "Place Details" in line:
        bad.append("dry-run vẫn nói sẽ gọi Place Details cho mục đã phủ: " + line)
rc, out, calls = r.run(["plan_batch.py", "--state", "HCMC", "--usage-root", "run-logs"], FX)
m = re.search(r"BATCH_ESTIMATE .*?resolve=(\d+)", out)
if not m or int(m.group(1)) != 2:
    bad.append("plan_batch lô 2 phủ + 1 không phủ: %r (kỳ vọng resolve=2)" % (out[-300:],))
k.done(bad, "dry-run và cổng hạn mức chỉ đếm mục không được báo cáo phủ")
