#!/usr/bin/env bash
# Eval tầng 1 của T-061. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-061/run.sh <thư-mục-tohong-front> [--only N] [--shots <thư-mục>]
# N = 1..11 : check_skel.cjs (Chromium, API giả trả chậm 1,5s; tiêu chí cùng số trong products/T-061-skeleton-dang-tai.md)
#     12    : ảnh 390 trước/sau trong PR  -> bash eval/T-061/check_pr.sh <số-PR>   (cần gh đăng nhập)
#     13    : bất biến planner/front/* + _shared và eval T-054 (cuộn cấp trang) vẫn xanh
# Không có --only: chạy 1..11 rồi 13 (12 cần số PR nên chạy riêng).
# Ảnh 390 cho PR: bash eval/T-061/run.sh <front> --only 1,2,3 --shots <thư-mục>  (ghi *-390-dang-tai.png và *-390-da-tai.png; ảnh "trước" chụp cùng lệnh trên main).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
FRONT="$(cd "$FRONT" && pwd)"; shift
if [ "${1:-}" = "--only" ] && [ "${2:-}" = "13" ]; then
  bash "$HERE/../T-054/run_invariants.sh" "$FRONT"; a=$?
  bash "$HERE/../T-054/run.sh" "$FRONT" --only 1,2,3,4,5,6,7,8 >/tmp/t061-t054.$$ 2>&1; b=$?
  tail -1 /tmp/t061-t054.$$; rm -f /tmp/t061-t054.$$
  if [ $a -eq 0 ] && [ $b -eq 0 ]; then echo PASS; exit 0; fi
  echo "FAIL invariants=$a t054=$b"; exit 1
fi
if [ "${1:-}" = "--only" ]; then exec node "$HERE/check_skel.cjs" --repo "$FRONT" "$@"; fi
node "$HERE/check_skel.cjs" --repo "$FRONT" "$@"; a=$?
bash "$0" "$FRONT" --only 13; b=$?
if [ $a -eq 0 ] && [ $b -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL skeleton=$a invariants+t054=$b"; exit 1
