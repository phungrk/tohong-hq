#!/usr/bin/env bash
# T-156 tiêu chí 6 (front admin). Chạy từ gốc tohong-hq: bash eval/T-156/check_6_admin_ngan_keo_va_hop_ket_noi.sh · Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
exec node "$HQ/eval/T-156/check_6_admin_ngan_keo_va_hop_ket_noi.cjs" --repo "$FRONT"
