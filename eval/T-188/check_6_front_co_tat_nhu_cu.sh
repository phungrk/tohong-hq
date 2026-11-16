#!/usr/bin/env bash
# T-188 tiêu chí 6: cờ build tắt/khác "1" = hành vi cũ.
# Chạy từ gốc tohong-hq: bash eval/T-188/check_6_front_co_tat_nhu_cu.sh. Repo front lấy từ TOHONG_FRONT_REPO (mặc định /home/user/tohong-front). Tự build vào thư mục tạm.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/check_front.cjs" --repo "${TOHONG_FRONT_REPO:-$HERE/../../../tohong-front}" --case 6
