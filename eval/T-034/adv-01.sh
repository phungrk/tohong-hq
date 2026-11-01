#!/usr/bin/env bash
# Eval đối kháng T-034 (adversary, 2026-11-01). Spec products/T-031-nhan-vat-khoi-mo-hinh.md mục 1 "Vị trí và cỡ" + mục 6 390px:
# hộp bao [data-part=body] không chồng lên chữ của khối nó quá 2 đơn vị SVG theo mỗi chiều, ở MỌI trạng thái (kể cả give lao, take nhảy), ở 1280 và 390px.
# Tầng 1 (C1, C8) chỉ đo lúc nghỉ. Chạy: bash eval/T-034/adv-01.sh   (repo = $TOHONG_DASHBOARD_REPO hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv_chars.cjs" --repo "$REPO" --check overlap
