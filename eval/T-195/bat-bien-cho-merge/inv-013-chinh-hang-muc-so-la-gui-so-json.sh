#!/usr/bin/env bash
# Nguồn: T-195 adv-01 (adversary, Code Gate 2026-11-16); spec products/T-194-man-ngan-sach-so-phan-bo-rong.md v3 H0 + H5(i).
# INV-013 (planner/front/budget) · Hạng mục mà lần ghi đổi số phân bổ (hạng mục vừa chỉnh; Dự phòng khi Tuần trăng mật rút/trả) gửi allocated_tr là số JSON >= 0
#   tính từ Number(số đã lưu) || 0, kể cả khi đã lưu rỗng/"abc"/chuỗi số. Không gửi null, chuỗi, NaN. Không khoá hàm hay tên trường; chỉ thân PUT.
# CHỜ MERGE: đỏ trên tohong-front main 6b9ad94 (gửi null). Chief chép file này + lib/chinh_hang_muc_la_gui_so_inv.cjs vào eval/invariants/planner/front/budget/ khi PR T-195 merge.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/chinh_hang_muc_la_gui_so_inv.cjs" "$@"
