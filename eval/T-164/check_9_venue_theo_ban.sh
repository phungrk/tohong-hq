#!/usr/bin/env bash
# T-164 tiêu chí 9. Chạy từ gốc tohong-hq: bash eval/T-164/check_9_venue_theo_ban.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_9_venue_theo_ban.mjs" "$@"
