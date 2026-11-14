#!/usr/bin/env python3
"""Nguồn: T-164 (spec products/T-164-gia-vendor-n4-nhan-gia.md, H4 và "Bất biến đề xuất" INV-B; đề xuất của product, chờ spec-critic rút vào bể khi spec qua Spec Gate).
Nằm ở eval/T-164/bat-bien-cho-merge/ cho tới khi PR code T-164 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/images/ và đặt số.
INV-B · Không bề mặt API cặp đôi nào trả giá của vendor mà thiếu nhãn: với pool thật + worker thật, mọi vendor có priceMin/priceMax > 0 ở POST /api/vendors/status (mọi id),
  GET /api/vendors/:id và GET /api/vendors/match đều có price_label (chuỗi không rỗng) và price_basis ∈ {admin_verified, admin, legacy_marry, estimate_category, estimate_default},
  với bốn trạng thái overlay: không có, giá chưa xác minh, giá đã xác minh, chỉ xác minh. Pool chưa có priceSource: PASS "chưa áp dụng".
Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
r = subprocess.run(["node", os.path.join(D, "lib", "gia_nhan.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
