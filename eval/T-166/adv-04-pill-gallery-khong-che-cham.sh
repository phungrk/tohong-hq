#!/usr/bin/env bash
# T-166 adv-04: chạy từ gốc tohong-hq. Biến: TOHONG_FRONT_REPO, TOHONG_BACK_REPO, PLAYWRIGHT_PATH.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
exec node "$HQ/eval/T-166/adv-04-pill-gallery-khong-che-cham.cjs" --repo "$FRONT"
