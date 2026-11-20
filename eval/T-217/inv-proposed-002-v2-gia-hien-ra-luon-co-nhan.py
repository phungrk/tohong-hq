#!/usr/bin/env python3
"""ĐỀ XUẤT v2 của INV-B (planner/vendor/inv-002) từ T-217 (ADR-138): thay bản hiện hành khi T-217 qua Spec Gate; đổi bất biến phải qua Chief of Staff và ghi decisions/ (như ADR-126/137).
INV-B v2 · Không bề mặt API cặp đôi nào trả giá của vendor mà thiếu nhãn: với pool thật + worker thật, mọi vendor có priceMin/priceMax > 0 ở POST /api/vendors/status (mọi id),
  GET /api/vendors/:id và GET /api/vendors/match đều có price_label (chuỗi không rỗng) và price_basis ∈ {admin_verified, source_verified, admin, legacy_marry, estimate_category, estimate_default},
  với bốn trạng thái overlay: không có, giá chưa xác minh, giá đã xác minh, chỉ xác minh; và mọi vendor pool có priceSource "verified" (không overlay) trả price_basis "source_verified",
  price_label "Giá đã xác minh", price_as_of null. Pool chưa có priceSource: PASS "chưa áp dụng". Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys

def _find_hq(start):
    """ADR-070: dò ngược tới thư mục có scripts/gate.py, không đếm cấp (file này chạy ở eval/T-217/ lúc đề xuất và ở eval/invariants/<vùng>/ sau khi vào bể)."""
    d = os.path.dirname(os.path.realpath(start))
    while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
        d = os.path.dirname(d)
    return d if os.path.isfile(os.path.join(d, "scripts", "gate.py")) else None
HQ = _find_hq(__file__)
if not HQ:
    print("FAIL không dò được gốc tohong-hq (scripts/gate.py) từ vị trí file"); sys.exit(1)
r = subprocess.run(["node", os.path.join(HQ, "eval", "T-217", "gia_nhan_v2.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
