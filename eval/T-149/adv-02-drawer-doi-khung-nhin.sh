#!/usr/bin/env bash
# T-149 adv-02: bọc adv-02-drawer-doi-khung-nhin.cjs. Chạy từ gốc tohong-hq: bash eval/T-149/adv-02-drawer-doi-khung-nhin.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-149/adv-02-drawer-doi-khung-nhin.cjs" --repo .
