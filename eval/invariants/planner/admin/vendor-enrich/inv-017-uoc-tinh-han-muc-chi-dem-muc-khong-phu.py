#!/usr/bin/env python3
"""Nguồn: T-207 (products/T-207-accept-place-lay-tu-enrich.md, Hành vi 4), qua Spec Gate 2026-11-18 (spec-critic). Gác ở eval/T-207/bat-bien-cho-merge/
tới khi PR tohong của T-207 merge (ADR-028), rồi vào eval/invariants/planner/admin/vendor-enrich/ (số do Chief đặt).
INV-017 (vendor-enrich) · Ước tính trước khi chạy và cổng hạn mức đếm đúng cùng tập mục mà resolve sẽ gọi Google.
`resolve_overrides.py --dry-run` ("tối đa <n> lượt Places", danh sách SẼ RESOLVE) và `plan_batch.py` (BATCH_ESTIMATE resolve=, QUOTA_ALLOWED) không đếm
mục được báo cáo enrich phủ; lô toàn mục phủ: resolve=0, không QUOTA_EXCEEDED; công thức cho mục không phủ giữ nguyên.
Chạy eval/T-207/check_5 (offline, Google giả chặn). Thiếu repo tohong: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. Thoát 0 = đạt."""
import os, subprocess, sys


def run(here, checks, ok_msg):
    d = os.path.dirname(os.path.abspath(here))
    while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
        d = os.path.dirname(d)
    hq = d
    t = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(hq, "..", "tohong"))
              if p and os.path.isfile(os.path.join(p, "tools", "scraper", "resolve_overrides.py"))), None)
    if not t:
        print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
    env = dict(os.environ, TOHONG_REPO=t)
    bad = []
    for c in checks:
        p = os.path.join(hq, "eval", "T-207", c)
        if not os.path.isfile(p):
            print("FAIL thiếu %s (eval nguồn của bất biến)" % os.path.relpath(p, hq)); sys.exit(1)
        r = subprocess.run([sys.executable, "-I", p], cwd=hq, env=env, capture_output=True, text=True, timeout=600)
        last = (r.stdout.strip().splitlines() or [""])[-1]
        if r.returncode != 0:
            bad.append("%s: %s" % (c.split("_")[1], last[:200] or r.stderr.strip()[-200:]))
    if bad:
        print("FAIL " + " | ".join(bad)); sys.exit(1)
    print("PASS " + ok_msg); sys.exit(0)


run(__file__, ["check_5_uoc_tinh_va_dry_run_bo_muc_da_phu.py"], "dry-run và cổng hạn mức chỉ đếm mục không được báo cáo phủ")
