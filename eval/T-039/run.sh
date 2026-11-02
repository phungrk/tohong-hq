#!/usr/bin/env bash
# Eval tầng 1 của T-039 (mũi tên chỉ hướng bảng Mô hình). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-039/run.sh <thư-mục-repo-dashboard> --task T-039 [--criterion N] [--engines chromium,webkit,firefox] [--require-engines] [--no-inv]
#   cd /home/user/tohong-hq && bash eval/T-039/run.sh <repo> --task T-039 --shots <thư-mục-ảnh> --label truoc|sau
# Engine không có sẵn thì in SKIP kèm lý do (không PASS giả). Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/mui-ten-huong.cjs" "$REPO" "$@"
