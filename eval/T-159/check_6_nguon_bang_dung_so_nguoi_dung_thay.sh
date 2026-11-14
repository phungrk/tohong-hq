#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_6_nguon_bang_dung_so_nguoi_dung_thay.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_6_nguon_bang_dung_so_nguoi_dung_thay.mjs" "$@"
