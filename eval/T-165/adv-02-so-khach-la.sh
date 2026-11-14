#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-165/adv-02-so-khach-la.sh · Biến: TOHONG_BACK_REPO.
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-02-so-khach-la.mjs" "$@"
