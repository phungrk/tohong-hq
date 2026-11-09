#!/usr/bin/env bash
# Nguồn: T-115 (spec products/T-115-onboarding-buoc2-cao-hon.md v2, qua Spec Gate 2026-11-09, spec-critic). Tiêu chí 3 + 4 của spec, như Spec Writer đề xuất.
# Bất biến: ở bước 2/3 Onboarding ("Kế hoạch đám cưới"), ở điện thoại 375x667, 390x664, 430x932 và màn thấp 320x568, 375x548:
#   (a) vùng nội dung dài hơn chỗ hiển thị thì cuộn được; sau khi cuộn hết, tiêu đề "Số khách ..." và nút cuối của nội dung nằm trên footer (cách >= 4px),
#       không bị phần tử nào phủ (elementFromPoint tại tâm trả về chính nó);
#   (b) footer (Tiếp theo + Quay lại bước 1) nằm trọn trong vùng nhìn thấy, nút Tiếp theo cao >= 44px, nằm trong bề rộng, không bị phủ; trang không cuộn ngang.
#   390x664 là vùng nhìn thấy GIẢ ĐỊNH của iPhone Safari có thanh địa chỉ dưới (tự tin ~65%); có số đo `?vvdebug=1` thật thì đổi qua Chief of Staff.
# Phần tử tìm theo nhãn/hành vi (tổ tiên cuộn được của tiêu đề, tổ tiên chung của hai nút), không theo cấu trúc DOM.
# Đo bằng lib/t115/check_inv.cjs --only 3,4 (bản chụp cố định của eval/T-115/check.cjs + lib.cjs; không trỏ thẳng eval/T-115/).
# Xanh trên tohong-front origin/main a7e5807 (2026-11-09).
# Chạy: bash eval/invariants/planner/front/layout/inv-012-onboarding-buoc2-cuon-het-khong-bi-che.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/t115/check_inv.cjs" --repo "$REPO" --only 3,4
