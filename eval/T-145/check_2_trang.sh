#!/usr/bin/env bash
# Eval T-145 tiêu chí 2 (bọc Node). Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}. Cần Playwright và D3 (như bất biến hq/dashboard).
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/check_2_trang.cjs"
