#!/usr/bin/env bash
# Nguồn: T-115 (spec v2, hành vi 1, qua Spec Gate 2026-11-09, spec-critic). Bất biến CHỜ MERGE: đỏ trên main a7e5807 (chính là lỗi T-115 sửa).
# Khi T-115 merge, Chief of Staff chuyển file này vào eval/invariants/planner/front/layout/ (số inv lấy số trống kế tiếp).
# Bất biến: mở bước 2/3 Onboarding ở 375x667, 390x664 (GIẢ ĐỊNH iPhone Safari thanh dưới, ~65%), 430x932, chưa cuộn: tiêu đề "Số khách ..." và nút lựa chọn đầu
#   nằm trọn trong vùng nội dung, trên footer (cách >= 4px), không bị phần tử nào phủ.
# Đo bằng eval/invariants/planner/front/layout/lib/t115/check_inv.cjs --only 1 (bản chụp cố định).
# Chạy: bash <file>   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HQ="$(cd "$(dirname "$0")/../../.." && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HQ/eval/invariants/planner/front/layout/lib/t115/check_inv.cjs" --repo "$REPO" --only 1
