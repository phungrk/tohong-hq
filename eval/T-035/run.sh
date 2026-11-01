#!/usr/bin/env bash
# Eval tầng 1 của T-035 (bố cục phóng to, chế độ phóng to, bot ở hai cổng trên cùng). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-035/run.sh <thư-mục-repo-dashboard> --task T-035 [--criterion N] [--shots [thư-mục-ảnh]] [--ref origin/main] [--no-old]
# --criterion N: chỉ chạy tiêu chí N (1..5). Không có thì chạy cả năm (tiêu chí 4 chạy lâu: 16 bất biến + eval T-028/T-031/T-032).
# --task <T-xxx>: bắt buộc cho tiêu chí 5 và --shots (thư mục ảnh docs/screenshots/<task>/).
# --shots [dir]: chỉ chụp ảnh trước/sau, phóng to, cận cảnh hai cổng, chụp lúc đang cử động. --ref: bản "trước" (mặc định origin/main).
# Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3, nếu không có thì tìm vài chỗ quen).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/bo-cuc-phong-to.cjs" "$REPO" "$@"
