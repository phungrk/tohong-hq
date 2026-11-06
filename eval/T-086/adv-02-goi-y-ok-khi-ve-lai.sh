#!/usr/bin/env bash
# T-086 adv-02 (adversary, Code Gate v1): gợi ý /ok đúng sau các lần vẽ lại khi modal Capu đang mở (spec T-081 D-I5, D-I6, D-I9, Q1).
# Chi tiết input/mong đợi: eval/T-086/lib/adv02_goi_y_ok_khi_ve_lai.cjs. Cần NODE_PATH (Playwright), D3; repo = $TOHONG_DASHBOARD_REPO hoặc /home/user/tohong-hq-dashboard.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv02_goi_y_ok_khi_ve_lai.cjs"
