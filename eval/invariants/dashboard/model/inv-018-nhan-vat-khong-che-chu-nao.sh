#!/usr/bin/env bash
# Nguồn: T-035 (spec products/T-035-bo-cuc-phong-to.md v2, qua Spec Gate 2026-11-01, spec-critic; đề xuất INV-B của Product).
# Bất biến: ở 1280 và 390px, lúc nghỉ và mọi trạng thái khi chạy sự kiện, hộp bao [data-part=body] của mọi nhân vật không chồng quá 2u (cả hai chiều) lên BẤT KỲ text nào ngoài .mch/.bub, kể cả nhãn đường và chữ khối khác (tổng quát hoá inv-016).
# Áp dụng từ khi T-035 vào (trang có button#model-zoom hoặc repo có docs/screenshots/T-035/); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/dashboard/model/inv-018-nhan-vat-khong-che-chu-nao.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t035_inv.cjs" --repo "$REPO" --check no-text-cover
