#!/usr/bin/env bash
# T-188 tiêu chí 3: cờ tắt (thiếu hoặc khác đúng "1") = 403 như cũ, giống hệt từng byte; cấu hình repo không bật cờ.
# Chạy từ gốc tohong-hq: bash eval/T-188/check_3_co_tat_nhu_cu.sh. Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/check_back.mjs" --repo "${TOHONG_BACK_REPO:-$HERE/../../../tohong-back}" --case 3
