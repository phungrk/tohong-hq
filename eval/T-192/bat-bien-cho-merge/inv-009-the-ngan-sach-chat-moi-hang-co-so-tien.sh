#!/usr/bin/env bash
# Nguồn: T-192 (spec products/T-192-the-ngan-sach-chat-so-tien-hang-muc.md v2, qua Spec Gate 2026-11-16, spec-critic; D1 handoffs/T-192-D1.md).
# INV-009 (planner/front/budget) · Thẻ ngân sách trong chat: mỗi hàng hạng mục ghi số tiền đã phân bổ của CHÍNH hạng mục đó, theo khuôn INV-008
#   (20 -> "20tr", 0 -> "0tr", chuỗi "60" -> "60tr", chuỗi "3.4" -> "3,4tr", 12.34 -> "12,3tr"); không hàng nào còn "tr" đứng riêng, "undefined", "NaN".
#   Không khoá cách tính, tên trường hay hàm; chỉ chữ nhìn thấy.
# CHỜ MERGE: đỏ trên tohong-front main 8751e87 (mọi hàng chỉ ghi "tr"). Chief chép file này cùng lib/gia_rong_va_the_ngan_sach_inv.cjs vào
#   eval/invariants/planner/front/budget/ (và lib/) khi PR T-192 merge.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/gia_rong_va_the_ngan_sach_inv.cjs" --which mini "$@"
