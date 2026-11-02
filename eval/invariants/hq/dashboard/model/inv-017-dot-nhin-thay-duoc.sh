#!/usr/bin/env bash
# Nguồn: T-035 (spec products/T-035-bo-cuc-phong-to.md v2, qua Spec Gate 2026-11-01, spec-critic; đề xuất INV-A của Product).
# Bất biến: khi có sự kiện có đường dot, dot hiện thật trên màn hình: #fx_f không display:none, có circle trong #fx_f với getBoundingClientRect().width ≥ 7px ở ≥ 5 khung hình, ở 1280 và 390px (lỗ hổng cũ: inv-001/002/003/008 chỉ đo thuộc tính).
# Áp dụng từ khi T-035 vào (trang có button#model-zoom hoặc repo có docs/screenshots/T-035/); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-017-dot-nhin-thay-duoc.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t035_inv.cjs" --repo "$REPO" --check dot-visible
