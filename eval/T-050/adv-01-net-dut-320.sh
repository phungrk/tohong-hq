#!/usr/bin/env bash
# T-050 adv-01 (adversary, tầng 3): ở 320px ba nét nối giữa bốn vòng tròn bước phải là nét đứt thấy được (>= 2 đoạn vẽ),
# không chỉ một chấm. Spec T-048 hành vi 5 + 7. Chạy: bash eval/T-050/adv-01-net-dut-320.sh [/home/user/tohong-front]
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/net-dut-320.cjs" "${1:-/home/user/tohong-front}"
