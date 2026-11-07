#!/usr/bin/env bash
# Nguồn: T-089 + ADR-031 (decisions/2026-11-07-adr-031-cot-xong-gioi-han.md: ca "hơn 10 việc xong" của INV-001 hq/dashboard, T-041 INV-P1), spec-critic 2026-11-07. Chờ merge (ADR-028).
# Đã đưa vào bể 2026-11-07 sau khi tohong-hq-dashboard#19 (T-091) merge, xanh trên main (ADR-028, ADR-031).
# Bất biến (lời INV-001 theo ADR-031, phủ ca fixture cũ không phủ): bộ chọn "Tất cả" (mặc định, và localStorage trống/lạ/rỗng/sai hoa thường) với 29 việc xong:
# sáu cột đầu đủ thẻ mọi việc kể cả việc không sản phẩm; cột Xong có min(tổng, giới hạn) việc mới nhất theo updated, số đếm là tổng; chọn P thì đúng việc có product = P.
# Chạy: bash inv-016-tat-ca-du-khi-hon-10-viec-xong.sh   (repo như inv-015)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/xong_inv.cjs" --repo "$REPO" --check all-complete-many
