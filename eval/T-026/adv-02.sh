#!/usr/bin/env bash
# Eval đối kháng tầng 3 cho T-026 (adversary). Chi tiết input trong lib/adv-02.cjs.
# Chạy: bash eval/T-026/adv-02.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/adv-02.cjs" --repo "$REPO"
