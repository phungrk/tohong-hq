#!/usr/bin/env bash
# Nguồn: T-192 (spec products/T-192-the-ngan-sach-chat-so-tien-hang-muc.md v2 H4, qua Spec Gate 2026-11-16, spec-critic; D1 handoffs/T-192-D1.md).
# INV-010 (planner/front/budget) · Giá vendor có một hoặc cả hai đầu rỗng ("", null, bỏ khuyết) không bao giờ hiện "tr" đứng riêng ("tr", "tr–5tr"),
#   hay "0tr" bịa cho đầu rỗng, ở chat (danh sách ảnh và nhà hàng, chi tiết, thẻ chọn so sánh) và màn Vendor đã lưu (kể cả câu "giá đã cập nhật (…)").
#   Không khoá chữ thay thế ("Đến 5tr", "Từ 4tr", "Chưa có giá" là của spec T-192, có thể đổi); dữ liệu giả không có vendor giá 0 thật.
#   Ngoài phạm vi: câu gợi ý "Nếu ưu tiên tiết kiệm…" của bảng so sánh (spec T-192 mục Không làm).
# CHỜ MERGE: đỏ trên tohong-front main 8751e87 ("tr–5tr", "0tr–6tr", "tr"). Chief chép file này cùng lib/gia_rong_va_the_ngan_sach_inv.cjs vào
#   eval/invariants/planner/front/budget/ (và lib/) khi PR T-192 merge.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/gia_rong_va_the_ngan_sach_inv.cjs" --which price "$@"
