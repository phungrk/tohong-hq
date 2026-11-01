#!/usr/bin/env bash
# Nguồn: T-031 (spec products/T-031-nhan-vat-khoi-mo-hinh.md v1, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: prefers-reduced-motion: reduce thì không animation/transition nào trên g.mch và g.bub, data-anim=none, thân đứng yên ở mọi trạng thái; trạng thái give/take vẫn có.
# Chạy: bash eval/invariants/dashboard/model/inv-012-reduced-motion-nhan-vat-dung-yen.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Chưa có nhân vật trong trang và repo chưa có docs/screenshots/T-031/ thì PASS "chưa áp dụng". Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/char_inv.cjs" --repo "$REPO" --check reduced-still
