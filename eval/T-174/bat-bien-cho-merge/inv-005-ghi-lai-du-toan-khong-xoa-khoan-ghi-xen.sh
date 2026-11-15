#!/usr/bin/env bash
# Nguồn: T-174 Code Gate (adversary: adv-02, adv-03, adv-11), spec products/T-171-the-vendor-theo-du-toan-hien-tai.md v3.1 H5, ADR-104 (Capu chọn A).
# INV (planner/front/budget, front) · Ghi lại dự toán (Thử lại hoặc tự lưu sau lỗi) KHÔNG xoá hay thay khoản do một lần ghi khác đã lưu (vd khoản vendor_<id> khi chốt vendor)
#   mà người dùng không đụng tới; và số người dùng vừa chỉnh không biến mất im lặng khi màn tải lại (hoặc đã lưu, hoặc còn trên màn kèm "Chưa lưu được dự toán").
#   Đo bằng lib/ghi_lai_du_toan_inv.cjs (màn Ngân sách thật + VendorProvider như App, server giả lưu nguyên tài liệu, Playwright; không đọc mã nguồn).
# Nằm ở eval/T-174/bat-bien-cho-merge/ tới khi PR front T-174 (#78) merge (ADR-028: đỏ trên main); Chief of Staff chép file này + lib/ghi_lai_du_toan_inv.cjs vào
#   eval/invariants/planner/front/budget/ (lib/ đã có ở đó) và đặt số (đề xuất inv-005).
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO (mặc định $PWD nếu là repo front, không thì <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/budget/useBudget.js" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/ghi_lai_du_toan_inv.cjs" "$@"
