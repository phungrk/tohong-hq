#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-165/adv-04-gia-rac-la.sh · Biến: TOHONG_REPO.
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-04-gia-rac-la.mjs" "$@"
