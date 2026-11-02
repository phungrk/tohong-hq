#!/usr/bin/env bash
# Nguồn: T-035 (spec products/T-035-bo-cuc-phong-to.md v2, qua Spec Gate 2026-11-01, spec-critic; đề xuất INV-C của Product).
# Bất biến: đủ 11 nhân vật; thân [data-part=body] lúc nghỉ cao ≥ 62u, và ≥ 68px ở 1280, ≥ 19px ở 390px.
# Áp dụng từ khi T-035 vào (trang có button#model-zoom hoặc repo có docs/screenshots/T-035/); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-019-nhan-vat-du-to.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t035_inv.cjs" --repo "$REPO" --check char-size
