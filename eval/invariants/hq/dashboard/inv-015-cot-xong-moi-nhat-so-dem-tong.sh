#!/usr/bin/env bash
# Nguồn: T-089 (spec products/T-089-kanban-xong-10-gan-nhat.md v1, qua Spec Gate 2026-11-07, spec-critic; bất biến đề xuất 1 và 2 của Product). Chờ merge (ADR-028).
# Đã đưa vào bể 2026-11-07 sau khi tohong-hq-dashboard#19 (T-091) merge, xanh trên main (ADR-028, ADR-031).
# Bất biến: với mọi bộ dữ liệu và mọi bộ chọn sản phẩm, cột Xong của Kanban hiện min(tổng, giới hạn) việc xong mới nhất theo updated (hoà: id lớn trước;
# giới hạn đầu 10, Xem thêm mở tới hết), số đầu cột và KPI Đã xong luôn là tổng; sáu cột kia đủ thẻ; việc xong đang ẩn vẫn mở được Dòng thời gian qua Feed.
# Chạy: bash inv-015-cot-xong-moi-nhat-so-dem-tong.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/xong_inv.cjs" --repo "$REPO" --check done-cap
