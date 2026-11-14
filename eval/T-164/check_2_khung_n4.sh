#!/usr/bin/env bash
# T-164 tiêu chí 2. Chạy từ gốc tohong-hq: bash eval/T-164/check_2_khung_n4.sh  · Biến: TOHONG_REPO (mặc định ../tohong).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_2_khung_n4.mjs" "$@"
