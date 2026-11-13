#!/usr/bin/env bash
# Eval đối kháng T-143 (adversary, tầng 3): tab Vendor qua đường HTTP (api/vendors.js) y nguyên main trước T-143 (spec T-140 mục 5).
# Chạy từ gốc tohong-hq: bash eval/T-143/adv-01-tab-http-khong-doi.sh   · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/adv-01-tab-http-khong-doi.mjs" "$@"
