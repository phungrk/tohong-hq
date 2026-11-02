#!/usr/bin/env bash
# Nguồn: T-041 (spec products/T-041-loc-san-pham.md v2, quyết định decisions/2026-11-02-t041-pham-vi-loc-san-pham.md, qua Spec Gate 2026-11-02, spec-critic; đề xuất INV-P2 của Product).
# Bất biến: trong khối Knowledge Reservoir, tổng số của các dòng [data-kr-scope] bằng model.invariants_total, mỗi nhánh đúng một dòng và luôn có dòng _shared; đúng với mọi bể (kể cả sản phẩm mới, vùng cũ chưa có tiền tố), ở mọi lựa chọn của bộ chọn, ở 1280 và 390px.
# Áp dụng từ khi T-041 vào (trang có select#product-filter); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/inv-002-cay-bat-bien-khop-tong.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/loc_inv.cjs" --repo "$REPO" --check kr-sum
