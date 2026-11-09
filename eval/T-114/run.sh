#!/usr/bin/env bash
# Eval tầng 1 của T-114. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-114/run.sh <thư-mục-tohong-front> [N]
# N = 1..5 chọn một tiêu chí (C1 chữ nhìn thấy, C2 tên truy cập/khung/title, C3 ảnh thật, C4 chuột xuyên, C5 không cuộn ngang); bỏ N thì chạy cả năm.
# Một lần chạy đo cả năm (khoảng 2-3 phút), nên mỗi tiêu chí gọi lại sẽ đo lại.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
FRONT="$(cd "$FRONT" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/check_ui.cjs" --repo "$FRONT" --only "${2:-1,2,3,4,5}"
