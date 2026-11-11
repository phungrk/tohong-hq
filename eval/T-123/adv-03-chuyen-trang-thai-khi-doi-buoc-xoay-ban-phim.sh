#!/usr/bin/env bash
# T-123 adv-03 (adversary). Trạng thái MỜ/ĐẶC của footer onboarding khớp luật spec T-122 sau đổi bước 2->3a->2, xoay ngang/dọc, bàn phím mở/đóng
# giữa chừng, cuộn nhanh/mượt; không nhấp nháy ở biên 4px; không rò listener. Logic: eval/T-123/lib/a03.cjs. (đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a03.cjs"
