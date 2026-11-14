#!/usr/bin/env bash
# Nguồn: T-162 (spec products/T-162-so-do-luong-theo-roster.md v2), spec-critic rút ở Spec Gate 2026-11-14. Chờ merge (ADR-028): đỏ trên trang hiện tại, chỉ xanh khi PR tohong-hq-dashboard của T-162 merge.
# Khi đưa vào eval/invariants/hq/dashboard/: chuyển kèm lib/roster_luong_inv.cjs vào hq/dashboard/lib/ và bỏ chữ "Chờ merge".
# Bất biến INV-020 (hq/dashboard): Mỗi phần tử roster trong dashboard.json, cộng node "Hoàn thành" (done), có đúng một node trên sơ đồ luồng; không node nào khác; hộp bao vòng tròn các node cách nhau ít nhất 8px; node nằm trong khung; trang không cuộn ngang; ở 1200px và 390px. Fixture có một id mới để chắc node sinh theo roster.
# Chạy: bash inv-020-moi-roster-co-mot-node-luong.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard). Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/roster_luong_inv.cjs" --repo "$REPO" --check nodes
