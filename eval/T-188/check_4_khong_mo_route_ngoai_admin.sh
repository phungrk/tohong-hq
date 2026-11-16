#!/usr/bin/env bash
# T-188 tiêu chí 4: cờ bật không đổi gì ở route ngoài /api/admin/* và quyền cặp đôi.
# Chạy từ gốc tohong-hq: bash eval/T-188/check_4_khong_mo_route_ngoai_admin.sh. Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/check_back.mjs" --repo "${TOHONG_BACK_REPO:-$HERE/../../../tohong-back}" --case 4
