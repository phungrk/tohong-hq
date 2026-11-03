#!/usr/bin/env bash
# T-050 adv-02 (adversary, tầng 3): chữ nhãn bước nằm trong hàng tiêu đề (icon (i) .. "Chi tiết >"), không lấn lề/viền thẻ.
# Spec T-048 hành vi 7 + ảnh mẫu. Chạy: bash eval/T-050/adv-02-nhan-trong-le.sh [/home/user/tohong-front]
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/nhan-trong-le.cjs" "${1:-/home/user/tohong-front}"
