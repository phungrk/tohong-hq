#!/usr/bin/env bash
# T-152: tiêu chí 8 = check_7_8_drawer_noi_dung.cjs --part=2. Chạy từ gốc tohong-hq: bash eval/T-152/check_8_drawer_admin_sua_pool.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-152/check_7_8_drawer_noi_dung.cjs" --repo . --part=2
