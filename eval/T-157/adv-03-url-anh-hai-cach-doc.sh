#!/usr/bin/env bash
# Eval đối kháng T-157 (adversary, tầng 3) · spec products/T-152-drawer-phu-pool-dau-anh-admin-sua-pool.md (v2).
# Chạy từ gốc tohong-hq: bash eval/T-157/adv-03-url-anh-hai-cach-doc.sh   · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/adv-03-url-anh-hai-cach-doc.mjs" "$@"
