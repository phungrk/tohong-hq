#!/usr/bin/env bash
# T-154 adv-01 (adversary). Chạy từ gốc tohong-hq: bash eval/T-154/adv-01-admin-mo-trang-bien.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HQ/eval/T-154/adv-01-admin-mo-trang-bien.cjs" --repo .
