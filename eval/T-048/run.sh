#!/usr/bin/env bash
# Eval tầng 1 của T-048. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-048/run.sh <thư-mục-tohong-front> [--only N] [--shots DIR]
# N = 1..6 là tiêu chí cùng số của spec products/T-048-cach-hoat-dong-chi-tiet-hang-muc.md (UI, dữ liệu giả).
# Tiêu chí 7 (ảnh 390px trong repo và PR): python3 eval/T-048/check_pr.py <thư-mục-tohong-front> [--pr N]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
shift
cd "$FRONT" && exec node "$HERE/check_ui.cjs" --repo . "$@"
