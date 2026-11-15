#!/usr/bin/env bash
# Nguồn: T-171 (spec products/T-171-the-vendor-theo-du-toan-hien-tai.md v2, qua Spec Gate 2026-11-15, spec-critic).
# INV (planner/vendor/matching, front) · Thẻ ghép vendor trong chat (danh sách, chi tiết, bảng so sánh) không hiện điểm hay dòng phép so tính trên dự toán/số khách
#   cũ hơn bản đã lưu của cặp đôi trong cùng phiên: sau khi lưu thành công, không còn số cũ và mọi thẻ theo số mới; phản hồi trễ không đè số mới hơn;
#   không có gì đổi thì không gọi lại điểm. Đo bằng lib/the_ghep_inv.cjs (API giả có trạng thái, Playwright, chữ người dùng thấy, không đọc mã nguồn).
# Nằm ở eval/T-171/bat-bien-cho-merge/ tới khi PR front T-171 merge (ADR-028: đỏ trên main); Chief of Staff chép cả thư mục lib/ vào eval/invariants/planner/vendor/matching/ và đặt số.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO (mặc định <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH. Gốc HQ tìm bằng dò ngược tới scripts/gate.py (không đếm cấp).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/the_ghep_inv.cjs" "$@"
