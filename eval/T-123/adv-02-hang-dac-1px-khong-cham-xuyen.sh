#!/usr/bin/env bash
# T-123 adv-02 (adversary). Phần đặc của footer onboarding (mọi hàng có alpha >= 0.95 trên ba cột) không chạm xuyên, quét TỪNG HÀNG 1px
# (eval T-122 quét cách 4px). Logic: eval/T-123/lib/a02.cjs. Chạy: bash eval/T-123/adv-02-hang-dac-1px-khong-cham-xuyen.sh (đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a02.cjs"
