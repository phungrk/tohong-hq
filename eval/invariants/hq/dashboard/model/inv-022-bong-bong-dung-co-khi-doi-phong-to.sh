#!/usr/bin/env bash
# Nguồn: eval đối kháng T-036 adv-01 (adversary, 2026-11-02); spec products/T-035-bo-cuc-phong-to.md mục 1.7 (T-031 mục 4) và mục 2. Chief of Staff đồng ý đưa vào bể.
# Bất biến: ở 390 và 1280px, bong bóng ĐANG HIỆN lúc bấm Phóng to / Thu nhỏ vẫn có chữ 9–16px trên màn hình và trọn trong svg
# (đổi chế độ không bắn resize tự nhiên; mã phải tự bố trí lại). Trang chưa có #model-zoom: PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-022-bong-bong-dung-co-khi-doi-phong-to.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/inv_zoom_bub.cjs" --repo "$REPO"
