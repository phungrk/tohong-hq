#!/usr/bin/env bash
# T-152: bọc check_5_quyen_403.mjs. Chạy từ gốc tohong-hq: bash eval/T-152/check_5_quyen_403.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-152/check_5_quyen_403.mjs"
