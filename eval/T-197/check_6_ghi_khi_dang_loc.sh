#!/usr/bin/env bash
# T-197 tiêu chí 6: sau Approve / Rút lại / Sửa thủ công khi đang lọc, bảng khớp lại và không có trang trống. Chạy từ gốc tohong-hq. Front: TOHONG_FRONT_REPO (mặc định /home/user/tohong-front); back: TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
# Build front vào thư mục tạm, chạy trình duyệt thật, gọi worker thật của back (R2 giả). Chi tiết ở đầu check_ui.mjs.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HERE/check_ui.mjs" --repo . --case 4
