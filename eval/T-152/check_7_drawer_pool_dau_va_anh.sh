#!/usr/bin/env bash
# T-152: tiêu chí 7 = check_7_8_drawer_noi_dung.cjs --part=1. Chạy từ gốc tohong-hq: bash eval/T-152/check_7_drawer_pool_dau_va_anh.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-152/check_7_8_drawer_noi_dung.cjs" --repo . --part=1
