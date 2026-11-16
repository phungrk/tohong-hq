#!/usr/bin/env bash
# T-188 tiêu chí 2: cờ bật, mọi thao tác ghi thành công, nhật ký/lịch sử ghi danh tính cố định, không bao giờ là Capu.
# Chạy từ gốc tohong-hq: bash eval/T-188/check_2_co_bat_ghi_danh_tinh_co_dinh.sh. Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/check_back.mjs" --repo "${TOHONG_BACK_REPO:-$HERE/../../../tohong-back}" --case 2
