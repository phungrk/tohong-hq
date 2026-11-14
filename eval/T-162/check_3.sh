#!/usr/bin/env bash
# Eval T-162 tiêu chí 3 (bọc Node). Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}; D3 mặc định là bản cục bộ của phiên.
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
export D3="${D3:-/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js}"
exec node "$HERE/check_page.cjs" 3
