#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_3_chat_cham_diem_goc_noi_chi_o_loc.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_3_chat_cham_diem_goc_noi_chi_o_loc.mjs" "$@"
