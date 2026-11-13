#!/usr/bin/env bash
# T-153 tiêu chí 2: bọc check_ui_admin_tab.cjs --case 2. Chạy từ gốc tohong-hq: bash eval/T-153/check_2_chuyen_tab_qua_lai.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HQ/eval/T-153/check_ui_admin_tab.cjs" --repo . --case 2
