#!/usr/bin/env bash
# T-211 tiêu chí 13: Hộp kết nối hiện Địa chỉ vendor + Liên hệ vendor đã sửa (giao diện thật + Worker thật). Chạy từ gốc tohong-hq. Front: TOHONG_FRONT_REPO; back: TOHONG_BACK_REPO.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HERE/check_ui.mjs" --repo . --case 2
