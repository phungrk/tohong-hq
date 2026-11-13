#!/usr/bin/env bash
# T-153 tiêu chí 4: bọc check_ui_admin_tab.cjs --case 4. Chạy từ gốc tohong-hq: bash eval/T-153/check_4_nguoi_ngoai_khong_vao_duoc.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HQ/eval/T-153/check_ui_admin_tab.cjs" --repo . --case 4
