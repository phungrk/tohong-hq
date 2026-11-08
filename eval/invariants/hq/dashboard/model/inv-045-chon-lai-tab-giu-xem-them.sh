#!/usr/bin/env bash
# INV-045 hq/dashboard/model · nguồn: T-100 (eval/T-100/adv-02-bien-keo-gian-lam-tuoi-ban-phim.sh ca E; đỏ trên nhánh T-100 v1 f70ce76; adversary rút vào bể sau khi PR dashboard #22 và exporter #32 merge, 2026-11-08). Spec: products/T-096-drawer-tab-keo-rong.md.
# Bất biến: chọn lại đúng tab đang chọn (Home trên tab đầu, End trên tab cuối, bấm chuột lại tab) không phải đổi tab: số dòng đã mở bằng Xem thêm giữ nguyên, tab và focus giữ.
# Cách đo: ở 1280x800 với 25 bất biến, 23 eval đối kháng, 3 hồi quy: Xem thêm ở tab Bất biến (20 dòng) rồi Home trên tab đó phải còn 20; Xem thêm ở tab Đối kháng rồi bấm chuột lại tab đó phải còn 20; End trên tab Hồi quy đang chọn giữ tab và focus. Dữ liệu dashboard.json, WebSocket, d3 giả/cục bộ; thư viện lib/t100_inv.cjs --check reselect-limit (tự đủ, không dùng eval/T-100).
# Áp dụng khi index.html có #kr-drawer-resize hoặc data-kr-tab, hoặc repo có docs/screenshots/T-100/; trước đó in "PASS ... (chưa áp dụng ...)".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-045-chon-lai-tab-giu-xem-them.sh
#   repo dashboard = $TOHONG_DASHBOARD_REPO, nếu không có thì ../tohong-hq-dashboard cạnh repo tohong-hq; cần NODE_PATH có playwright (mặc định npm root -g) và D3 (biến D3 hoặc bản cục bộ như các inv khác của vùng).
# In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm hoặc thiếu repo/D3/playwright.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-$(cd "$HERE/../../../../.." && pwd)/../tohong-hq-dashboard}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t100_inv.cjs" --repo "$REPO" --check reselect-limit
