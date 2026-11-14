#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-165/adv-06-so-khach-ho-so-khop-seed.sh · Biến: TOHONG_BACK_REPO.
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-06-so-khach-ho-so-khop-seed.mjs" "$@"
