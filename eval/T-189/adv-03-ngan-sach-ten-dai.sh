#!/usr/bin/env bash
# T-189 adv-03: bọc adv-03-ngan-sach-ten-dai.cjs. Biến: TOHONG_FRONT_REPO, TOHONG_BACK_REPO, PLAYWRIGHT_PATH.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
exec node "$HQ/eval/T-189/adv-03-ngan-sach-ten-dai.cjs" --repo "$FRONT"
