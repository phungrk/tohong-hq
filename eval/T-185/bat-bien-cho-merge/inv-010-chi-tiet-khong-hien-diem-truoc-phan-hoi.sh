#!/usr/bin/env bash
# Nguồn: T-185 (spec products/T-185-skeleton-phan-tich-ai-chi-tiet-vendor.md v2, H1 + H7), rút bởi spec-critic khi spec qua Spec Gate 2026-11-16.
# INV (planner/vendor/matching, front) · Thẻ chi tiết vendor KHÔNG hiện trong khối "Phân tích AI" điểm, phần trăm, thanh có số hay dòng phép so nào trước khi phản hồi chi tiết về
#   (lúc chờ chỉ có chữ tĩnh: tiêu đề + ba nhãn, và skeleton); điểm hiện ra là của phản hồi chi tiết (số đã lưu hiện tại), không phải của hàng đã bấm trong danh sách; danh sách đã in giữ nguyên.
#   Đo bằng eval/T-185/check_1_cho_diem_hien_skeleton.cjs (mọi mẫu ~16ms trước khi có điểm) + check_7_chi_tiet_theo_so_hien_tai_danh_sach_giu_nguyen.cjs (App thật, API giả trễ, Playwright;
#   khối xác định bằng nội dung/hình học, không phụ thuộc cấu trúc DOM).
# ADR-028: đỏ trên front main 1bc6b54 tới khi PR front T-185 merge; nằm ở eval/T-185/bat-bien-cho-merge/ tới lúc đó; Chief of Staff chép vào
#   eval/invariants/planner/vendor/matching/ (đặt số nếu inv-010 đã có), ghi decisions/.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH. Gốc HQ tìm bằng dò ngược tới scripts/gate.py (không đếm cấp).
set -u
D="$(cd "$(dirname "$0")" && pwd)"; R="$D"; while [ "$R" != "/" ] && [ ! -f "$R/scripts/gate.py" ]; do R="$(dirname "$R")"; done
for f in check_1_cho_diem_hien_skeleton check_7_chi_tiet_theo_so_hien_tai_danh_sach_giu_nguyen; do
  out="$(node "$R/eval/T-185/$f.cjs" "$@" 2>&1 | tail -1)"; case "$out" in PASS) ;; *) echo "FAIL T-185 $f: $out"; exit 1;; esac
done
echo PASS
