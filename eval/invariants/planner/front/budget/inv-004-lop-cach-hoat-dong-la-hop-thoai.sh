#!/usr/bin/env bash
# Nguồn: T-048 (spec products/T-048-cach-hoat-dong-chi-tiet-hang-muc.md v2, qua Spec Gate 2026-11-03, spec-critic).
# INV-004 · Lớp "Cách hoạt động" mở từ chi tiết hạng mục ngân sách là role=dialog tên "Cách hoạt động", không đổi địa chỉ; đóng được bằng Escape, Back (chỉ đóng lớp), chạm vùng tối, chạm ngoài khung app (1280px); đóng bằng giao diện (Đóng, Escape, chạm vùng tối) không để lại bước Back chết; mở/đóng không gửi PUT/POST.
# Trước khi build có khối "Cách hoạt động" (T-048 chưa merge): in "PASS (chưa áp dụng ...)". Bắt buộc có khối = sửa bất biến, qua Chief of Staff.
# Đo bằng lib/dialog_inv.cjs (dữ liệu giả, tìm theo chữ và vai trò, không đọc mã nguồn).
# Chạy: bash eval/invariants/planner/front/budget/inv-004-lop-cach-hoat-dong-la-hop-thoai.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/dialog_inv.cjs" --repo "$REPO"
