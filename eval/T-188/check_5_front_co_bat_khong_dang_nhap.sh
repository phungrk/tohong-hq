#!/usr/bin/env bash
# T-188 tiêu chí 5: cờ build bật, ?admin= không đòi đăng nhập.
# Chạy từ gốc tohong-hq: bash eval/T-188/check_5_front_co_bat_khong_dang_nhap.sh. Repo front lấy từ TOHONG_FRONT_REPO (mặc định /home/user/tohong-front). Tự build vào thư mục tạm.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/check_front.cjs" --repo "${TOHONG_FRONT_REPO:-$HERE/../../../tohong-front}" --case 5
