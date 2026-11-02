#!/usr/bin/env bash
# Eval tầng 1 của T-045. Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-045/run.sh <thư-mục-tohong-front> [--only N] [--shots DIR]
# N = 1..6 là tiêu chí 1..6 của spec (UI, dữ liệu giả). Tiêu chí 7 (cổng hai repo): python3 eval/T-045/check_7_gates.py. Tiêu chí 8: checklist.md.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
shift
cd "$FRONT" && exec node "$HERE/check_ui.cjs" --repo . "$@"
