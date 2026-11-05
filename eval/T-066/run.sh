#!/usr/bin/env bash
# Eval tầng 1 của T-066. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-066/run.sh <thư-mục-tohong-front> [--only N] [--shots <thư-mục>] [--tag truoc|sau]
# N = 1..5 : check_ui.cjs (Chromium, dữ liệu giả + ảnh hỏng giả; cùng số với tiêu chí trong products/T-066-anh-minh-hoa-tu-tao.md)
#     6    : hạng mục lạ -> minh hoạ chung: eval/T-066/checklist.md (không tự động được, lý do ghi trong file)
#     7    : bất biến planner/front/* (layout, navigation, budget, loading) và _shared vẫn xanh
#     8    : ảnh 390 trước/sau trong PR  -> python3 eval/T-066/check_pr.py <front> [--pr N]  (tự tìm PR theo tên nhánh t-066-anh-minh-hoa)
# Không có --only: chạy 1..5 rồi 7 (6 là checklist, 8 cần PR nên chạy riêng).
# Ảnh 390 cho PR: bash eval/T-066/run.sh <front> --only 1 --shots <thư-mục> --tag truoc   (chạy trên main)  rồi  --tag sau (trên nhánh việc).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
FRONT="$(cd "$FRONT" && pwd)"; shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
inv() {
  bash "$HERE/../T-054/run_invariants.sh" "$FRONT"; a=$?
  n=0; for f in "$HERE"/../invariants/planner/front/loading/inv-*.sh; do [ -f "$f" ] || continue; n=$((n+1))
    if (cd "$FRONT" && TOHONG_FRONT_REPO="$FRONT" bash "$f") >/tmp/t066-inv.$$ 2>&1; then echo "  ok loading/$(basename "$f" .sh)"; else echo "  XX loading/$(basename "$f" .sh) :: $(tail -1 /tmp/t066-inv.$$ | cut -c1-200)"; a=1; fi; done; rm -f /tmp/t066-inv.$$
  [ $a -eq 0 ] && { echo PASS; return 0; }; echo "FAIL bất biến front đỏ"; return 1
}
if [ "${1:-}" = "--only" ]; then
  case "$2" in
    7) inv; exit $?;;
    8) python3 "$HERE/check_pr.py" "$FRONT"; exit $?;;
    6) echo "FAIL tiêu chí 6 là checklist: mở eval/T-066/checklist.md và trả lời từng dòng"; exit 1;;
    *) node "$HERE/check_ui.cjs" --repo "$FRONT" "$@"; exit $?;;
  esac
fi
node "$HERE/check_ui.cjs" --repo "$FRONT" "$@"; a=$?
inv; b=$?
if [ $a -eq 0 ] && [ $b -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL ui=$a invariants=$b"; exit 1
