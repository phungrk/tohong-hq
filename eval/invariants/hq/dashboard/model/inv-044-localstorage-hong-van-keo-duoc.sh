#!/usr/bin/env bash
# INV-044 hq/dashboard/model · nguồn: T-100 (eval/T-100/adv-02-bien-keo-gian-lam-tuoi-ban-phim.sh ca A; adversary rút vào bể sau khi PR dashboard #22 và exporter #32 merge, 2026-11-08). Spec: products/T-096-drawer-tab-keo-rong.md.
# Bất biến: giá trị localStorage 'kr-drawer-width' hỏng ("abc", "-5", "0", "", "NaN", "99999") hoặc getItem/setItem ném lỗi không làm hỏng drawer: bề rộng luôn trong [min, max] (hỏng thì về min 560, quá lớn thì kẹp max), aria-valuenow khớp, tay nắm vẫn đổi bề rộng bằng bộ nhớ trong và giữ qua đóng/mở, không lỗi JS.
# Cách đo: ở 1280x800 đặt từng giá trị hỏng trước khi trang tải, mở drawer bằng chuột thật, đo bề rộng [data-kr-panel]; rồi thay Storage.getItem/setItem bằng hàm ném lỗi, ArrowLeft x5 trên #kr-drawer-resize phải ra 660, Esc rồi mở lại vẫn 660. Dữ liệu dashboard.json, WebSocket, d3 giả/cục bộ; thư viện lib/t100_inv.cjs --check bad-storage (tự đủ, không dùng eval/T-100).
# Áp dụng khi index.html có #kr-drawer-resize hoặc data-kr-tab, hoặc repo có docs/screenshots/T-100/; trước đó in "PASS ... (chưa áp dụng ...)".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-044-localstorage-hong-van-keo-duoc.sh
#   repo dashboard = $TOHONG_DASHBOARD_REPO, nếu không có thì ../tohong-hq-dashboard cạnh repo tohong-hq; cần NODE_PATH có playwright (mặc định npm root -g) và D3 (biến D3 hoặc bản cục bộ như các inv khác của vùng).
# In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm hoặc thiếu repo/D3/playwright.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-$(cd "$HERE/../../../../.." && pwd)/../tohong-hq-dashboard}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t100_inv.cjs" --repo "$REPO" --check bad-storage
