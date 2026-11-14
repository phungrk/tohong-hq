#!/usr/bin/env bash
# T-164 tiêu chí 4. Chạy từ gốc tohong-hq: bash eval/T-164/check_4_nhan_moi_be_mat_back.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_4_nhan_moi_be_mat_back.mjs" "$@"
