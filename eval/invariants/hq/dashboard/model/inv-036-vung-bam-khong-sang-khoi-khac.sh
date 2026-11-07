#!/usr/bin/env bash
# Nguồn: T-095 adv-05 (eval đối kháng, adversary, 2026-11-07; ADR-034). Vùng: hq/dashboard/model.
# Bất biến: ở 320, 360, 375, 390 (thường), 360 và 390 phóng to: vùng bấm nhân vật không nằm trên hình chính hay chữ của khối khác; bấm tâm thân mỗi nhân vật mở tóm tắt của chính nó.
# Xanh trên dashboard main d8febc8 và PR #21 (70b0f2b).
# Chạy: bash <file này>   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard; cần NODE_PATH có playwright và D3)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
LIB="$HERE/lib/vung_bam_inv.cjs"; [ -f "$LIB" ] || LIB="$HERE/../../invariants/hq/dashboard/model/lib/vung_bam_inv.cjs"
exec node "$LIB" --repo "$REPO" --check hit-other-block
