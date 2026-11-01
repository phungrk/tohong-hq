#!/usr/bin/env bash
# Eval đối kháng T-030 (adversary, 2026-11-01). Kịch bản A–I trong lib/adv_nav.cjs:
# A Back nhanh x5/300ms (cả khi có 2 lớp) · B đổi tab khi lớp mở · C hash kiểu Clerk (#/sign-in/...) · D paywall xếp trễ + đóng chat ngay
# E Back ở Onboarding · F "Quay lại" rồi Forward, bấm đúp · G chạm ngoài khung đóng sheet rồi Back · H link sâu id lạ/mã hoá lỗi
# I gợi ý cài ở 390x640: không đè thanh tab, sheet "Thêm việc" vẫn thấy nút đóng + nút Thêm; install_* chỉ thêm platform/outcome.
# Chạy: cwd = repo tohong-front (như gate.py --cwd), hoặc đặt TOHONG_FRONT_REPO.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/adv_nav.cjs" --repo "$REPO" "$@"
