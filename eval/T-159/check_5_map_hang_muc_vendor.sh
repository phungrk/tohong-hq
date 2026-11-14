#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_5_map_hang_muc_vendor.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_5_map_hang_muc_vendor.mjs" "$@"
