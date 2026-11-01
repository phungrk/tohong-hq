#!/usr/bin/env bash
# Eval tầng 1 của T-028 (bảng Mô hình có dot chạy và khối sáng). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-028/run.sh <thư-mục-repo-dashboard> [--criterion N] [--shots <thư-mục-ảnh>]
# Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3, nếu không có thì tìm vài chỗ quen).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/model-dots.cjs" "$REPO" "$@"
