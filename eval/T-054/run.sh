#!/usr/bin/env bash
# Eval tầng 1 của T-054. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-054/run.sh <thư-mục-tohong-front> [--only N]
# N = 1..7 là tiêu chí cùng số của spec products/T-054-cuon-cap-trang.md (UI Chromium, dữ liệu giả, mạng ngoài bị chặn).
# --only 8 : bất biến layout + navigation + budget + _shared (bash eval/T-054/run_invariants.sh <front>)
# Tiêu chí 9 (Safari iPhone thật): eval/T-054/checklist.md, Capu tự kiểm.
# Không có tham số --only: chạy 1..7 rồi 8; PASS khi cả hai xanh.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
shift
if [ "${1:-}" = "--only" ] && [ "${2:-}" = "8" ]; then exec bash "$HERE/run_invariants.sh" "$FRONT"; fi
if [ "${1:-}" = "--only" ]; then exec node "$HERE/check_ui.cjs" --repo "$FRONT" "$@"; fi
node "$HERE/check_ui.cjs" --repo "$FRONT" "$@"; a=$?
bash "$HERE/run_invariants.sh" "$FRONT"; b=$?
if [ $a -eq 0 ] && [ $b -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL ui=$a invariants=$b"; exit 1
