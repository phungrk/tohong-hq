#!/usr/bin/env bash
# T-203 tiêu chí 10 (phần giao diện): vendor đã xoá rồi rời pool: chỉ ở nhãn "Đã xoá" kèm ghi chú "không còn trong pool", không ở "Mồ côi", Khôi phục bấm được. Chạy từ gốc tohong-hq. Front: TOHONG_FRONT_REPO; back: TOHONG_BACK_REPO.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec node "$HERE/check_ui.mjs" --repo . --case 3
