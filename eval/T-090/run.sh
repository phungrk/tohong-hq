#!/usr/bin/env bash
# Eval tầng 1 của T-090 (nhân vật bảng Mô hình nhỏ còn 1/2, khối thu nhỏ tương ứng). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-090/run.sh <thư-mục-repo-dashboard> [--criterion N] [--no-inv]
#   cd /home/user/tohong-hq && bash eval/T-090/run.sh <repo> --shots <thư-mục-ảnh> --label truoc|sau     (chụp ảnh 1280 và 390)
# Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3). Hằng số "trước" đóng cứng trong nhan-vat-nho.cjs.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/nhan-vat-nho.cjs" "$REPO" "$@"
