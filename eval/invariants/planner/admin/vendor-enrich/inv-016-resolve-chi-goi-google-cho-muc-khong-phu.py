#!/usr/bin/env python3
"""Nguồn: T-207 (products/T-207-accept-place-lay-tu-enrich.md, Hành vi 1, 3, 4 phần hạn mức), qua Spec Gate 2026-11-18 (spec-critic). Gác ở
eval/T-207/bat-bien-cho-merge/ tới khi PR tohong của T-207 merge (ADR-028), rồi vào eval/invariants/planner/admin/vendor-enrich/ (số do Chief đặt khi đưa vào bể).
INV-016 (vendor-enrich) · Resolve chỉ tốn Google cho mục KHÔNG được báo cáo enrich phủ.
Mục accept_place có place_id đúng bằng ứng viên của vendor trong enrich-report.json, ứng viên có business_status, name, address không rỗng và checked_at
(YYYY-MM-DDTHH:MM:SSZ) không quá 30 ngày: resolve 0 request Google, `resolved` lấy từ báo cáo (resolved_from=enrich_report, resolved_at=checked_at), kể cả với
--max-requests 0. Mọi mục khác (chỉ maps_link, place_id báo cáo không biết, place_id khác ứng viên, dữ liệu cũ/thiếu/sai dạng) gọi Google như trước,
chịu đúng trần --max-requests, GOOGLE_REQUEST in trước mỗi request; tổng request = số mục không phủ.
Chạy eval/T-207/check_1, check_3, check_4, check_8 (offline, Google giả). Thiếu repo tohong: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. Thoát 0 = đạt."""
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


run(__file__, ["check_1_ung_vien_enrich_khong_goi_google.py", "check_3_muc_khong_phu_ung_vien_van_goi_google.py",
                 "check_4_du_lieu_cu_hoac_thieu_van_goi_google.py", "check_8_han_muc_khong_tang.py"],
      "mục được báo cáo phủ 0 request Google; mục không phủ gọi Google như cũ, trong trần")
