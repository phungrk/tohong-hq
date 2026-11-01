#!/usr/bin/env bash
# Nguồn: T-028 (spec products/T-028-mo-hinh-dot-chay.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: khối không có việc theo sổ cái thì không sáng; khối giữ nhận dot mà sổ cái không có việc thì tắt trong 10 giây.
# Chạy: bash eval/invariants/dashboard/model/inv-004-khong-ket-sang.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/model_inv.cjs" --repo "$REPO" --check no-stuck-lit
