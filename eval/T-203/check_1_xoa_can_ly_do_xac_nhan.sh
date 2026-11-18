#!/usr/bin/env bash
# T-203 tiêu chí 1: Xoá vendor cần lý do và bước xác nhận (giao diện). Chạy từ gốc tohong-hq. Front: TOHONG_FRONT_REPO (mặc định /home/user/tohong-front); back: TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HERE/check_ui.mjs" --repo . --case 1
