#!/usr/bin/env bash
# Eval tầng 1 của T-056. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-056/run.sh <thư-mục-tohong-front> [--only N]
# N = 1,2,3,4,6,8 (check_vv.cjs, visualViewport giả lập) hoặc 5 (eval T-054 đầy đủ: Safari/Back/cuộn/khoá nền + bất biến).
# Tiêu chí 7 (iPhone thật, Chrome và Safari): eval/T-056/checklist-iphone.md.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
shift
if [ "${1:-}" = "--only" ] && [ "${2:-}" = "5" ]; then exec bash "$HERE/../T-054/run.sh" "$FRONT"; fi
if [ "${1:-}" = "--only" ]; then exec node "$HERE/check_vv.cjs" --repo "$FRONT" "$@"; fi
node "$HERE/check_vv.cjs" --repo "$FRONT"; a=$?
bash "$HERE/../T-054/run.sh" "$FRONT"; b=$?
if [ $a -eq 0 ] && [ $b -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL vv=$a t054=$b"; exit 1
