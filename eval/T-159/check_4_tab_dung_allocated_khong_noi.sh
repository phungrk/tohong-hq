#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_4_tab_dung_allocated_khong_noi.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_4_tab_dung_allocated_khong_noi.mjs" "$@"
