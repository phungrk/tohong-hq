#!/usr/bin/env bash
# Eval tầng 1 của T-037 (bấm nhân vật Mô hình để nghe tóm tắt, bong bóng gõ chữ). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-037/run.sh <thư-mục-repo-dashboard> --task T-037 [--criterion N] [--shots [thư-mục-ảnh]] [--no-inv]
# --criterion N: chỉ chạy tiêu chí N (1..6). Không có thì chạy cả sáu (tiêu chí 5 chạy lâu: 21 bất biến; --no-inv bỏ phần đó).
# --task <T-xxx>: bắt buộc cho tiêu chí 6 và --shots (thư mục ảnh docs/screenshots/<task>/).
# --shots [dir]: chỉ chụp ảnh lúc chữ đang gõ dở.
# Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3, nếu không có thì tìm vài chỗ quen).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/bam-nhan-vat-tom-tat.cjs" "$REPO" "$@"
