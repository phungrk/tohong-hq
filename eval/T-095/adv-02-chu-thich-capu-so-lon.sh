#!/usr/bin/env bash
# Eval đối kháng T-095 (adversary, 2026-11-07), vùng hq/dashboard/model. Mô tả: lib/adv_bam_so.cjs --check capu-caption.
# Chạy: bash eval/T-095/adv-02-chu-thich-capu-so-lon.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc /home/user/tohong-hq-dashboard; cần NODE_PATH có playwright và D3)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv_bam_so.cjs" --repo "$REPO" --check capu-caption
