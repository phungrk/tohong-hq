#!/usr/bin/env python3
"""ĐỀ XUẤT v2 của INV-B (planner/vendor/inv-002) từ T-217 (ADR-138): thay bản hiện hành khi T-217 qua Spec Gate; đổi bất biến phải qua Chief of Staff và ghi decisions/ (như ADR-126/137).
INV-B v2 · Không bề mặt API cặp đôi nào trả giá của vendor mà thiếu nhãn: với pool thật + worker thật, mọi vendor có priceMin/priceMax > 0 ở POST /api/vendors/status (mọi id),
  GET /api/vendors/:id và GET /api/vendors/match đều có price_label (chuỗi không rỗng) và price_basis ∈ {admin_verified, source_verified, admin, legacy_marry, estimate_category, estimate_default},
  với bốn trạng thái overlay: không có, giá chưa xác minh, giá đã xác minh, chỉ xác minh; và mọi vendor pool có priceSource "verified" (không overlay) trả price_basis "source_verified",
  price_label "Giá đã xác minh", price_as_of null. Pool chưa có priceSource: PASS "chưa áp dụng". Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
r = subprocess.run(["node", os.path.join(HERE, "gia_nhan_v2.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
