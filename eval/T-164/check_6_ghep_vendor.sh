#!/usr/bin/env bash
# T-164 tiêu chí 6. Chạy từ gốc tohong-hq: bash eval/T-164/check_6_ghep_vendor.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_6_ghep_vendor.mjs" "$@"
