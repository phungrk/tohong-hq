#!/usr/bin/env bash
# T-156: bọc check_3_be_mat_chat.cjs (tohong-front, vite dev). Chạy từ gốc tohong-hq: bash eval/T-156/check_3_be_mat_chat.sh · Biến: TOHONG_FRONT_REPO, TOHONG_BACK_REPO (pool thật), PLAYWRIGHT_PATH. T156_ALL=1 in đủ lỗi.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
exec node "$HQ/eval/T-156/check_3_be_mat_chat.cjs" --repo "$FRONT"
