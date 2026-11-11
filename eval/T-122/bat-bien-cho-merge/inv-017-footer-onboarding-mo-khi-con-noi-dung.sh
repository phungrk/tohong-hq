#!/usr/bin/env bash
# Nguồn: T-122 (spec v2, Chốt 3-5 + hành vi 1, 4, 5, 7; qua Spec Gate 2026-11-11, spec-critic). Bất biến CHỜ MERGE: đỏ trên main a7e5807 (chính là việc T-122 làm).
# Khi T-122 (cùng #66) merge, Chief of Staff chuyển file này vào eval/invariants/planner/front/layout/ (số inv lấy số trống kế tiếp, sửa đường dẫn HQ/lib).
# Bất biến: footer Onboarding báo hiệu còn nội dung bị che: ở bước 2/3 (390x650, 375x632, 390x664, 393x662) và bước 3a,
#   còn nội dung nằm dưới đỉnh footer (- 4px) thì footer MỜ (dải mờ, nhìn xuyên, chạm xuyên ở dải mờ, phần đặc không chạm xuyên), hết thì ĐẶC,
#   đổi hai chiều theo vị trí cuộn; hình học hộp footer không đổi giữa hai trạng thái; innerHeight < 480 thì footer đặc và không đè nội dung.
#   Không gồm tiêu chí 3 của spec (số tuyệt đối desktop 76/724, footer 119) vì đó là số của spec này, không phải tính chất của vùng.
# Đo bằng eval/invariants/planner/front/layout/lib/t122/check.cjs --only 1,4,6 (bản chụp cố định).
# Chạy: bash <file>   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HQ="$(cd "$(dirname "$0")/../../.." && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HQ/eval/invariants/planner/front/layout/lib/t122/check.cjs" --repo "$REPO" --only 1,4,6
