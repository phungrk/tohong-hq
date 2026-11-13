#!/usr/bin/env bash
# T-153 tiêu chí 1: bọc check_ui_admin_tab.cjs --case 1. Chạy từ gốc tohong-hq: bash eval/T-153/check_1_tab_dau_va_bang_enrich.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HQ/eval/T-153/check_ui_admin_tab.cjs" --repo . --case 1
