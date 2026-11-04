#!/usr/bin/env bash
# Eval tầng 1 của T-059. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-059/run.sh <thư-mục-tohong-front> [--only N]
# N = 1,2,3 : check_tint.cjs (Chromium; tiêu chí cùng số trong products/T-059-safari-thanh-tren-xam.md)
#     4     : src/nav.js không đổi so với main lúc viết spec (67a33aa)
#     5     : chạy lại toàn bộ eval T-054 (UI + bất biến layout/navigation/budget/_shared)
#     6     : chạy lại toàn bộ eval T-056 (Chrome iOS, giả lập visualViewport) và T-054 qua T-056
#     7     : chỉ bất biến (eval/T-054/run_invariants.sh)
# Tiêu chí 8 (iPhone thật, Safari + Chrome iOS): eval/T-059/checklist-iphone.md.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
FRONT="$(cd "$FRONT" && pwd)"; shift
BASE=67a33aa
nav() { if ! git -C "$FRONT" cat-file -e "$BASE" 2>/dev/null; then echo "FAIL không thấy commit $BASE trong repo front (git fetch origin)"; return 1; fi
  if git -C "$FRONT" diff --quiet "$BASE" -- src/nav.js; then echo "PASS nav.js không đổi"; return 0; fi; echo "FAIL src/nav.js đã bị sửa so với $BASE"; return 1; }
if [ "${1:-}" = "--only" ]; then case "${2:-}" in
  1|2|3|1,*|2,*|3,*) exec node "$HERE/check_tint.cjs" --repo "$FRONT" "$@";;
  4) nav; exit $?;;
  5) exec bash "$HERE/../T-054/run.sh" "$FRONT";;
  6) exec bash "$HERE/../T-056/run.sh" "$FRONT";;
  7) exec bash "$HERE/../T-054/run_invariants.sh" "$FRONT";;
  *) echo "FAIL --only N với N = 1..7"; exit 1;; esac; fi
node "$HERE/check_tint.cjs" --repo "$FRONT"; a=$?
nav; b=$?
bash "$HERE/../T-056/run.sh" "$FRONT"; c=$?   # T-056 đã gồm T-054 + bất biến
if [ $a -eq 0 ] && [ $b -eq 0 ] && [ $c -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL tint=$a nav=$b t054_t056=$c"; exit 1
