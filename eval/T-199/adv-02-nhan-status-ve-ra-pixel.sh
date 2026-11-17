#!/usr/bin/env bash
# T-199 tầng 3 (adversary): chi tiết ở đầu adv-02-nhan-status-ve-ra-pixel.mjs. Chạy từ gốc tohong-hq. Front: TOHONG_FRONT_REPO (mặc định /home/user/tohong-front); back: TOHONG_BACK_REPO.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HERE/adv-02-nhan-status-ve-ra-pixel.mjs" --repo . --case 1
