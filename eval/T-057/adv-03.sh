#!/usr/bin/env bash
# Eval đối kháng T-057 case 3 (xem adv-vv.cjs). cd /home/user/tohong-hq && bash eval/T-057/adv-03.sh /home/user/tohong-front
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/adv-vv.cjs" --repo "${1:-/home/user/tohong-front}" --case 3
