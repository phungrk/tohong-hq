#!/usr/bin/env bash
# Eval đối kháng T-036 (adversary, 2026-11-02). Spec products/T-035-bo-cuc-phong-to.md mục 1.7 (T-031 mục 4: chữ bong bóng 9–16px, trọn trong svg)
# và mục 2 ("chạy y như bản thường" khi phóng to). Bong bóng ĐANG HIỆN lúc bấm Phóng to / Thu nhỏ phải đổi cỡ theo bề rộng svg mới
# (đổi chế độ không bắn sự kiện resize). Tầng 1 C2 luôn vào phóng to trước khi bắn sự kiện nên không chạm ca này.
# Chạy: bash eval/T-036/adv-01.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv_zoom_bub.cjs" --repo "$REPO"
