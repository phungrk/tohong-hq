#!/usr/bin/env bash
# Eval tầng 1 của T-089 (cột Xong của Kanban chỉ hiện 10 việc gần nhất, nút Xem thêm).
#   cd /home/user/tohong-hq && bash eval/T-089/run.sh <tiêu chí 1..7>
# Repo dashboard tự tìm: $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard.
# Cần Playwright (NODE_PATH mặc định từ `npm root -g`) và d3 cục bộ (biến D3). In PASS hoặc FAIL <lý do>, mã thoát 0/1.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/done-kanban.cjs" "${1:-}"
