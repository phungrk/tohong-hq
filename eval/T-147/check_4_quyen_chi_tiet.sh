#!/usr/bin/env bash
# T-147 tiêu chí 4: bọc check_4_quyen_chi_tiet.mjs. Chạy từ gốc tohong-hq: bash eval/T-147/check_4_quyen_chi_tiet.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-147/check_4_quyen_chi_tiet.mjs"
