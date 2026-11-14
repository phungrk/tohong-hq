#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_2_chua_phan_bo_nhu_cu.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_2_chua_phan_bo_nhu_cu.mjs" "$@"
