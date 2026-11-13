#!/usr/bin/env bash
# T-147 tiêu chí 3: bọc check_3_api_chi_tiet.mjs. Chạy từ gốc tohong-hq: bash eval/T-147/check_3_api_chi_tiet.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-147/check_3_api_chi_tiet.mjs"
