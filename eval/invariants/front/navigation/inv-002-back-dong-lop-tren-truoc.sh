#!/usr/bin/env bash
# Nguồn: T-027 (spec products/T-027-back-va-cai-app.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: mọi lớp đang mở có đúng một bước lịch sử và không đổi địa chỉ; Back chỉ đóng lớp trên cùng, không đổi trang; đóng lớp bằng giao diện, Forward vào bước từng là lớp, hay tải lại khi mở lớp đều không để lại bước chết.
# Đo bằng lib/nav_check.cjs (bản chụp cố định của eval/T-027/check_t027.cjs) --only 2 --inv. Phủ 9 lớp eval mở được (ngăn kéo, chat AI, Paywall, màn Mời, sheet vendor, sheet Kết nối, Timeline Thêm mốc/Thêm việc, sửa ngày cưới); lớp mới phải thêm vào lib qua Chief of Staff.
# Chạy: bash eval/invariants/front/navigation/inv-002-back-dong-lop-tren-truoc.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/nav_check.cjs" --repo "$REPO" --only 2 --inv
