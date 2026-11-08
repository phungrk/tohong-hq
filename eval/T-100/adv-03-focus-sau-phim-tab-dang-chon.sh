#!/usr/bin/env bash
# Eval đối kháng T-100 (adversary, tầng 3): focus sau Home/End trên tab đang chọn: Xem thêm giữ focus ở nút, làm tươi không kéo focus về tab (spec T-096 mục B, C).
# Chạy: bash eval/T-100/adv-03-focus-sau-phim-tab-dang-chon.sh
# Biến: TOHONG_DASHBOARD_REPO (mặc định /home/user/tohong-hq-dashboard), D3 (mặc định d3 trong scratchpad như eval T-096), NODE_PATH (mặc định npm root -g).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export D3="${D3:-/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv-03-focus-sau-phim-tab-dang-chon.cjs" "$@"
