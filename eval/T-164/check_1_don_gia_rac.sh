#!/usr/bin/env bash
# T-164 tiêu chí 1. Chạy từ gốc tohong-hq: bash eval/T-164/check_1_don_gia_rac.sh  · Biến: TOHONG_REPO (mặc định ../tohong).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_1_don_gia_rac.mjs" "$@"
