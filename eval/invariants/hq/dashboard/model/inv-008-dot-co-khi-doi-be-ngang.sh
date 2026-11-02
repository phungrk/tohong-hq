#!/usr/bin/env bash
# Nguồn: T-029 adv-01 (adversary, 2026-11-01). Spec products/T-028-mo-hinh-dot-chay.md mục 3: đường kính dot 7–16px ở mọi bề ngang 320–1920px.
# Bất biến: đổi bề ngang giữa lúc dot đang chạy (xoay điện thoại 390↔844, thu cửa sổ 1280→390) thì dot vẫn 7–16px; không dùng bán kính tính một lần lúc tạo dot.
# Chạy: bash eval/invariants/hq/dashboard/model/inv-008-dot-co-khi-doi-be-ngang.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv_model.cjs" --repo "$REPO" --check rotate
