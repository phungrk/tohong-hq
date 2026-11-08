#!/usr/bin/env bash
# INV-046 hq/dashboard/model · nguồn: T-100 (eval/T-100/adv-03-focus-sau-phim-tab-dang-chon.sh + adv-04-mui-ten-doi-tab-sau-sua.sh; adv-03 đỏ trên nhánh T-100 v2 61fe450; adversary rút vào bể sau khi PR dashboard #22 và exporter #32 merge, 2026-11-08). Spec: products/T-096-drawer-tab-keo-rong.md.
# Bất biến: phím trên tab đang chọn không để lại focus chờ: sau đó bấm Xem thêm thì focus ở lại nút (nút còn), làm tươi dữ liệu không kéo focus về tab; mũi tên/Home/End sang tab khác thì chọn tab đó, focus theo, limit về 10 (kể cả quay lại tab cũ), vòng tròn hai đầu, roving tabindex đúng, làm tươi giữ focus ở tab vừa chọn.
# Cách đo: ở 1280x800 với 45 eval đối kháng, đồng hồ trang giả: (G) về lại tab đang chọn bằng ArrowLeft+ArrowRight và bằng vòng 3 ArrowRight, Home trên tab đang chọn rồi bấm Xem thêm, rời focus sang #kr-drawer-close rồi làm tươi 61 giây; (H) chuỗi Home, Home, ArrowRight, Xem thêm, End, End, ArrowRight, ArrowLeft, ArrowLeft, làm tươi hai lần; đo tab aria-selected, activeElement, số dòng, tabindex. Dữ liệu dashboard.json, WebSocket, d3 giả/cục bộ; thư viện lib/t100_inv.cjs --check focus (tự đủ, không dùng eval/T-100).
# Áp dụng khi index.html có #kr-drawer-resize hoặc data-kr-tab, hoặc repo có docs/screenshots/T-100/; trước đó in "PASS ... (chưa áp dụng ...)".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-046-focus-tab-khong-treo.sh
#   repo dashboard = $TOHONG_DASHBOARD_REPO, nếu không có thì ../tohong-hq-dashboard cạnh repo tohong-hq; cần NODE_PATH có playwright (mặc định npm root -g) và D3 (biến D3 hoặc bản cục bộ như các inv khác của vùng).
# In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm hoặc thiếu repo/D3/playwright.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-$(cd "$HERE/../../../../.." && pwd)/../tohong-hq-dashboard}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t100_inv.cjs" --repo "$REPO" --check focus
