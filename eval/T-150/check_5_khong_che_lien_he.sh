#!/usr/bin/env bash
# T-150 tiêu chí 5: bọc check_5_khong_che_lien_he.mjs. Chạy từ gốc tohong-hq: bash eval/T-150/check_5_khong_che_lien_he.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-150/check_5_khong_che_lien_he.mjs"
