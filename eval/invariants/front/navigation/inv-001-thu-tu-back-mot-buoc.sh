#!/usr/bin/env bash
# Nguồn: T-027 (spec products/T-027-back-va-cai-app.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: mỗi lần đổi tab hoặc mở trang con là đúng một bước lịch sử; chạm lại tab đang chọn không thêm bước; Back/Forward nhiều bước đi đúng thứ tự ngược/xuôi; nút "Quay lại" của trang con tương đương Back.
# Đo bằng lib/nav_check.cjs (bản chụp cố định của eval/T-027/check_t027.cjs) --only 1 --inv. 
# Chạy: bash eval/invariants/front/navigation/inv-001-thu-tu-back-mot-buoc.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/nav_check.cjs" --repo "$REPO" --only 1 --inv
