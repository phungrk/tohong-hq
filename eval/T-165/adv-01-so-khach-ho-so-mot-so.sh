#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-165/adv-01-so-khach-ho-so-mot-so.sh · Biến: TOHONG_BACK_REPO.
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-01-so-khach-ho-so-mot-so.mjs" "$@"
