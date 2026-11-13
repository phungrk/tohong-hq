#!/usr/bin/env bash
# Eval đối kháng T-143 (adversary, tầng 3): hồ sơ thiếu/lạ trên đường chat (spec T-140 mục 1, 2, 3, 6).
# Chạy từ gốc tohong-hq: bash eval/T-143/adv-02-ho-so-thieu-truong.sh   · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/adv-02-ho-so-thieu-truong.mjs" "$@"
