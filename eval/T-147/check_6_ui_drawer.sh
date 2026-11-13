#!/usr/bin/env bash
# T-147 tiêu chí 6: bọc check_6_ui_drawer.cjs. Chạy từ gốc tohong-hq: bash eval/T-147/check_6_ui_drawer.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-147/check_6_ui_drawer.cjs" --repo .
