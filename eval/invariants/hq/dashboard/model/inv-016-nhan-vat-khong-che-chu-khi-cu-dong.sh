#!/usr/bin/env bash
# Nguồn: eval đối kháng T-034 adv-01 (adversary, 2026-11-01), spec products/T-031-nhan-vat-khoi-mo-hinh.md mục 1 "Vị trí và cỡ" + mục 6 (390px).
# Bất biến: hộp bao [data-part=body] của nhân vật không chồng lên chữ của khối nó quá 2 đơn vị SVG theo mỗi chiều ở MỌI trạng thái
# (nghỉ, work, give lao, take nhảy, wait), ở 1280 và 390px.
# Chạy: bash eval/invariants/hq/dashboard/model/inv-016-nhan-vat-khong-che-chu-khi-cu-dong.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/char_adv.cjs" --repo "$REPO" --check overlap
