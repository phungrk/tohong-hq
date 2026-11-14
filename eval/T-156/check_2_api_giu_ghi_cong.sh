#!/usr/bin/env bash
# T-156: bọc check_2_api_giu_ghi_cong.mjs (tohong-back). Chạy từ gốc tohong-hq: bash eval/T-156/check_2_api_giu_ghi_cong.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-156/check_2_api_giu_ghi_cong.mjs"
