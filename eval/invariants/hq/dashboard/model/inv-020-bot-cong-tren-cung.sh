#!/usr/bin/env bash
# Nguồn: T-035 (spec products/T-035-bo-cuc-phong-to.md v2, qua Spec Gate 2026-11-01, spec-critic; đề xuất INV-D của Product).
# Bất biến: ở gt_spec và gt_code (1280 và 390px): không phần tử vẽ nào ngoài g.mch của cổng, đứng sau nó trong DOM, giao hộp bao thân bot (trừ #fx_b .bub), lúc nghỉ và khi chạy sự kiện; dot thử trong #fx_f nằm dưới bot; không đường p_* nào đi qua thân bot nới 2u; thân bot nằm trọn trong vòng tròn cổng, cách viền ≥ 2u.
# Áp dụng từ khi T-035 vào (trang có button#model-zoom hoặc repo có docs/screenshots/T-035/); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-020-bot-cong-tren-cung.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t035_inv.cjs" --repo "$REPO" --check gate-on-top
