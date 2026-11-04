#!/usr/bin/env bash
# Eval đối kháng T-060 (adversary). Chi tiết: adv-01.cjs. Chạy: cd /home/user/tohong-hq && bash eval/T-060/adv-01.sh <tohong-front> [--only A,B,C,D,E,F]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-$PWD}"; shift || true
exec node "$HERE/adv-01.cjs" --repo "$FRONT" "$@"
