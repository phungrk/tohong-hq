#!/usr/bin/env bash
# T-164 tiêu chí 3. Chạy từ gốc tohong-hq: bash eval/T-164/check_3_thu_tu_nguon_va_nhan.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_3_thu_tu_nguon_va_nhan.mjs" "$@"
