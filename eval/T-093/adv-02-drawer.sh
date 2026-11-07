#!/usr/bin/env bash
# Eval đối kháng tầng 3 của T-093 (adversary): drawer Knowledge Reservoir, các ca biên (xem lib/adv-02-drawer.cjs).
# Chạy: cd /home/user/tohong-hq && D3=/đường/dẫn/d3.min.js NODE_PATH=$(npm root -g) bash eval/T-093/adv-02-drawer.sh
set -u
exec node "$(dirname "$0")/lib/adv-02-drawer.cjs" "$@"
