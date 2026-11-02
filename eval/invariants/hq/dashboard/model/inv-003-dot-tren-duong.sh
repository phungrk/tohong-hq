#!/usr/bin/env bash
# Nguồn: T-028 (spec products/T-028-mo-hinh-dot-chay.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: mọi dot nằm trên một đường p_* của #model svg và có fill thuộc 5 màu #14754d #2b7fb8 #d9931f #d33 #8a5cf6.
# Chạy: bash eval/invariants/hq/dashboard/model/inv-003-dot-tren-duong.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/model_inv.cjs" --repo "$REPO" --check dot-on-path
