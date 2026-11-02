#!/usr/bin/env bash
# Nguồn: T-043 (spec products/T-043-danh-sach-thanh-vien.md v2, qua Spec Gate 2026-11-02, spec-critic).
# Bất biến: màn Thành viên của admin không hiện số điện thoại hay mã, không đưa tên/email/từ khoá vào URL, console, storage, tiêu đề trang,
#           không gọi host nào ngoài máy chủ API (không analytics), từ khoá chỉ đi trong thân POST.
# Đo bằng lib/members_ui_inv.cjs (bản chụp cố định của eval/T-043/check_members_ui.cjs) --only 4. Repo front từ TOHONG_FRONT_REPO (mặc định /home/user/tohong-front).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
cd "$REPO" || exit 2
exec node "$HERE/lib/members_ui_inv.cjs" --repo "$REPO" --only 4
