#!/usr/bin/env bash
# Nguồn: T-041 (spec products/T-041-loc-san-pham.md v2, quyết định decisions/2026-11-02-t041-pham-vi-loc-san-pham.md, qua Spec Gate 2026-11-02, spec-critic; đề xuất INV-P1 của Product).
# ADR-031 (2026-11-07): lời bất biến sửa — sáu cột đầu đủ thẻ; cột Xong có min(tổng, giới hạn) thẻ mới nhất, số đếm là tổng. Phép kiểm hiện có không đổi.
# Bất biến: bộ chọn sản phẩm ở "Tất cả" (mặc định, và khi localStorage["tohong.productFilter"] thiếu, rỗng, lạ, sai hoa thường hay bị cấm) thì bảng việc hiện đủ mọi việc ở bảy cột, kể cả việc có product rỗng hoặc thiếu; chọn sản phẩm P thì bảng là đúng các việc có trường product = P, không suy từ area.
# Áp dụng từ khi T-041 vào (trang có select#product-filter); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/inv-001-tat-ca-luon-du.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/loc_inv.cjs" --repo "$REPO" --check all-complete
