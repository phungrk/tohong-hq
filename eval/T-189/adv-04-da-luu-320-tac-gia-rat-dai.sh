#!/usr/bin/env bash
# T-189 adv-04: bọc adv-04-da-luu-320-tac-gia-rat-dai.cjs. Biến: TOHONG_FRONT_REPO, TOHONG_BACK_REPO, PLAYWRIGHT_PATH.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
exec node "$HQ/eval/T-189/adv-04-da-luu-320-tac-gia-rat-dai.cjs" --repo "$FRONT"
