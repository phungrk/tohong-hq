#!/usr/bin/env python3
"""Nguồn: T-207 (products/T-207-accept-place-lay-tu-enrich.md, Hành vi 2, Quyết định 5), qua Spec Gate 2026-11-18 (spec-critic). Gác ở
eval/T-207/bat-bien-cho-merge/ tới khi PR tohong của T-207 merge (ADR-028), rồi vào eval/invariants/planner/vendor/images/ cạnh INV-016/017 (số do Chief đặt).
INV-046 (images) · `resolved` lấy từ báo cáo enrich đi qua ĐÚNG các kiểm như `resolved` từ Google, và resolve không tự lọc.
Sau khi resolve điền từ báo cáo (0 Google), áp duyệt tay (enrich.py --category venue) vẫn từ chối CLOSED_PERMANENTLY (place_closed_permanently),
CLOSED_TEMPORARILY (place_temporarily_closed), địa chỉ ngoài tỉnh/thành (out_of_province, INV-016), trùng place_id khác địa chỉ gốc (place_conflict, INV-017);
mục sạch được áp. Lý do: đường thay Google không được thành đường vòng qua kiểm.
Chạy eval/T-207/check_2 (offline, Google giả). Thiếu repo tohong: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. Thoát 0 = đạt."""
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


run(__file__, ["check_2_kiem_dong_cua_tinh_trung_van_chay.py"], "resolved từ báo cáo vẫn bị kiểm đóng cửa, tỉnh/thành, trùng place như resolved từ Google")
