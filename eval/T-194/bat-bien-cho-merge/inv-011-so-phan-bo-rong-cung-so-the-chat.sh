#!/usr/bin/env bash
# Nguồn: T-194 (spec products/T-194-man-ngan-sach-so-phan-bo-rong.md v3, qua Spec Gate 2026-11-16, spec-critic; D1 handoffs/T-194-D1.md, D2 handoffs/T-194-D2.md).
# INV-011 (planner/front/budget) · Số phân bổ hạng mục từ API là rỗng, null, chuỗi lạ ("abc", "20,5", "20tr") hay chuỗi số ("20", " 7 ", "3.4"):
#   màn Ngân sách và thẻ ngân sách chat ghi CÙNG một số cho mỗi hạng mục; "Đã phân bổ" là tổng cộng các số đó; màn không có "tr" đứng riêng, "abc", NaN, undefined, null.
#   Không khoá hàm, tên trường hay chữ khác; chỉ chữ nhìn thấy.
# CHỜ MERGE: đỏ trên tohong-front main 6b9ad94 ("Đã phân bổ tr", hàng "tr"). Chief chép file này + lib/so_phan_bo_rong_inv.cjs vào eval/invariants/planner/front/budget/ khi PR T-194 merge.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/so_phan_bo_rong_inv.cjs" --which show "$@"
