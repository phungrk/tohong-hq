#!/usr/bin/env bash
# T-152: bọc check_7_drawer_pool_dau_anh_sua.cjs. Chạy từ gốc tohong-hq: bash eval/T-152/check_7_drawer_pool_dau_anh_sua.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-152/check_7_drawer_pool_dau_anh_sua.cjs" --repo .
