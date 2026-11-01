#!/usr/bin/env bash
# Eval tầng 1 của T-032 (khối có số đếm > 0 thì sáng). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-032/run.sh <thư-mục-repo-dashboard> [--criterion N] [--shots <thư-mục-ảnh>] [--task T-032]
# --criterion N: chỉ chạy tiêu chí N (1..6). Không có thì chạy cả sáu.
# --shots <dir> --task <T-xxx>: chụp ảnh các trạng thái vào <dir>/<T-xxx>/ (mặc định task là T-032); không kiểm gì khác.
# Cần Playwright (NODE_PATH lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/khoi-sang.cjs" "$REPO" "$@"
