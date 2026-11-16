#!/usr/bin/env bash
# Nguồn: T-194 (spec products/T-194-man-ngan-sach-so-phan-bo-rong.md v3, qua Spec Gate 2026-11-16, spec-critic; D1 handoffs/T-194-D1.md, D2 handoffs/T-194-D2.md).
# INV-012 (planner/front/budget) · Ghi dự toán không ép dữ liệu đã lưu của hạng mục người dùng KHÔNG chỉnh: "", "abc", "20", bỏ khuyết gửi lại nguyên văn,
#   ở cả ba lối ghi: chỉnh tay hạng mục khác; ghi tự động khi nhà hàng đã chốt và số khách đổi (INV-003); ghi lại sau lỗi (INV-005: giá trị server do lần ghi khác đặt được giữ).
#   Đo thân PUT; không khoá cách cài. (Luật rút Dự phòng khi chỉnh Tuần trăng mật không nằm trong bất biến này: đó là hạng mục bị đổi theo luật, spec T-194 H5.)
# Xanh trên tohong-front main 6b9ad94; đỏ với bản vá ép số ở lối ghi (spec-critic đã dựng). Để cùng INV-011, Chief chép khi PR T-194 merge.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/so_phan_bo_rong_inv.cjs" --which write "$@"
