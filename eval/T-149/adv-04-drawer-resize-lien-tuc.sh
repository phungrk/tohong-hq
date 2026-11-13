#!/usr/bin/env bash
# T-149 adv-04: bọc adv-04-drawer-resize-lien-tuc.cjs. Chạy từ gốc tohong-hq: bash eval/T-149/adv-04-drawer-resize-lien-tuc.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-149/adv-04-drawer-resize-lien-tuc.cjs" --repo .
