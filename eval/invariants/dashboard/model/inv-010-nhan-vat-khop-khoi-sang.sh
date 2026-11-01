#!/usr/bin/env bash
# Nguồn: T-031 (spec products/T-031-nhan-vat-khoi-mo-hinh.md v1, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: ngoài lúc give/take, nhân vật work hoặc wait thì khối của nó đang sáng, idle thì khối không sáng (lệch không quá 0,3 giây), bất kể khối sáng theo quy tắc nào (T-028, T-032 hay sau này); chỉ nd_capu được wait.
# Chạy: bash eval/invariants/dashboard/model/inv-010-nhan-vat-khop-khoi-sang.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Chưa có nhân vật trong trang và repo chưa có docs/screenshots/T-031/ thì PASS "chưa áp dụng". Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/char_inv.cjs" --repo "$REPO" --check char-match-lit
