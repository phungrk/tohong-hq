#!/usr/bin/env bash
# Eval tầng 1 của T-041 (bộ lọc theo sản phẩm của dashboard). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/claude/tohong-hq && bash eval/T-041/run.sh <thư-mục-repo-dashboard> [--criterion N]
# --criterion N: chỉ tiêu chí N (1..4). Không có thì chạy cả bốn.
# Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3, mặc định /opt/npm-tools/node_modules/d3/dist/d3.min.js).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/loc-san-pham.cjs" "$REPO" "$@"
