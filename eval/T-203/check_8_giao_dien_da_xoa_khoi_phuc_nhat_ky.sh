#!/usr/bin/env bash
# T-203 tiêu chí 8: nhãn "Đã xoá", nút Khôi phục, vendor đã xoá không sửa được, Nhật ký có hai thao tác (giao diện). Chạy từ gốc tohong-hq. Front: TOHONG_FRONT_REPO; back: TOHONG_BACK_REPO.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HERE/check_ui.mjs" --repo . --case 2
