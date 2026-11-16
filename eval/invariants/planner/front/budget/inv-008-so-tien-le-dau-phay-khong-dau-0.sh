#!/usr/bin/env bash
# Nguồn: T-187 (spec products/T-187-dau-phay-so-tien-le-o-front.md v2, qua Spec Gate 2026-11-16, spec-critic; D1 handoffs/T-187-D1.md).
# INV-008 (planner/front/budget) · Mọi số tiền (triệu đồng) app cặp đôi tự định dạng, ở khung chat vendor (danh sách, chi tiết), màn Ngân sách
#   (tổng quan, hạng mục, sheet vendor, thanh trượt), "Vendor đã lưu", thẻ ngân sách chat, trang chủ: không dấu chấm thập phân ("4.6tr", "1.440tr"),
#   không quá 1 chữ số lẻ ("4,25tr"), không ",0" ("14,0tr"), không số thập phân dài, không NaN/undefined/null/Infinity, và không bao giờ "-0tr", "+0tr", "−0tr".
#   Đầu vào chuỗi "12.34" từ API cũng vậy. Không khoá con số cụ thể hay nhãn; chữ do back trả không có trong dữ liệu giả; trang admin ngoài phạm vi.
# CHỜ MERGE: đỏ trên tohong-front main 26c5758 (còn dấu chấm). Chief chép vào eval/invariants/planner/front/budget/ khi PR T-187 merge (lib/ đi kèm; gốc HQ dò ngược tới scripts/gate.py, không đếm cấp).
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO (mặc định $PWD nếu là repo front, không thì <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/so_tien_dau_phay_inv.cjs" "$@"
