#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-165/adv-03-uoc-tinh-khong-khang-dinh-moi-cau.sh · Biến: TOHONG_BACK_REPO.
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-03-uoc-tinh-khong-khang-dinh-moi-cau.mjs" "$@"
