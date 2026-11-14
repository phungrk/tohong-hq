#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_7_bang_loi_khong_nem_va_chi_phi_doc.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_7_bang_loi_khong_nem_va_chi_phi_doc.mjs" "$@"
