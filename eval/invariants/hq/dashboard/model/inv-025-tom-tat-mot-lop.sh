#!/usr/bin/env bash
# Nguồn: T-037 (spec products/T-037-bam-nhan-vat-tom-tat.md v2, ADR-017, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: tối đa một tóm tắt trong toàn trang, ở lớp #fx_s là con cuối của svg và sau #fx_b; bong bóng sự kiện vẫn ≤ 3; không có bong bóng sự kiện cùng khối với tóm tắt đang mở.
# Áp dụng từ khi T-037 vào (trang có #model-sum-live hoặc repo có docs/screenshots/T-037/); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-025-tom-tat-mot-lop.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/sum_inv.cjs" --repo "$REPO" --check one-layer
