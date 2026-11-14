#!/usr/bin/env bash
# Nguồn: T-162 (spec products/T-162-so-do-luong-theo-roster.md v2), spec-critic rút ở Spec Gate 2026-11-14. Chờ merge (ADR-028): đỏ trên trang hiện tại, chỉ xanh khi PR tohong-hq-dashboard của T-162 merge.
# Khi đưa vào eval/invariants/hq/dashboard/: chuyển kèm lib/roster_luong_inv.cjs vào hq/dashboard/lib/ và bỏ chữ "Chờ merge".
# Bất biến INV-021 (hq/dashboard): Chữ trên node sơ đồ luồng là một dòng: nhịp tohong-live còn hạn thì hiện hành động của nhịp mới nhất theo at, không có "Đang làm"; không có nhịp mà giữ việc doing/review/spec/rework thì hiện "Đang làm"; còn lại (new/blocked/escalated, nhịp quá hạn, không giữ) thì không có chữ. Sprite .chr là working khi và chỉ khi có chữ. Cả hai luật theo bộ lọc sản phẩm.
# Chạy: bash inv-021-chu-node-theo-nhip-va-viec-giu.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard). Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/roster_luong_inv.cjs" --repo "$REPO" --check label
