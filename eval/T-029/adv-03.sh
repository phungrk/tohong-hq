#!/usr/bin/env bash
# Eval đối kháng T-029 (adversary): --check decided. Xem mô tả ca trong eval/T-029/adv_model.cjs.
# Chạy: bash eval/T-029/adv-03.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/adv_model.cjs" --repo "$REPO" --check decided
