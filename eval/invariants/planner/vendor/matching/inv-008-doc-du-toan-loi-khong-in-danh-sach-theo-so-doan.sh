#!/usr/bin/env bash
# Nguồn: T-179 (spec products/T-179-danh-sach-vendor-moi-giu-danh-sach-cu.md v2, H1 bước 2 + H3; D1 B1), rút bởi spec-critic khi spec qua Spec Gate 2026-11-15.
# INV (planner/vendor/matching, front) · Luồng vendor KHÔNG BAO GIỜ in danh sách (hay nhãn) theo số đoán khi không đọc được dự toán đã lưu:
#   bấm Tìm vendor mà GET dự toán lỗi thì không in danh sách mới, không gọi match, danh sách đang có giữ nguyên, không có "Theo dự toán 0tr";
#   đọc lại được thì in theo đúng số đã lưu. Bổ sung cho bản thay inv-006 (cùng thư mục), vốn không có ca đọc lỗi.
#   Đo bằng eval/T-179/check_11_doc_du_toan_loi.cjs (App thật, API giả có trạng thái, Playwright; chữ người dùng thấy và số lần gọi, không đọc mã nguồn).
# ADR-028: đỏ trên front main tới khi PR front T-179 merge; nằm ở eval/T-179/bat-bien-cho-merge/ tới lúc đó; Chief of Staff chép vào
#   eval/invariants/planner/vendor/matching/ (đặt số), ghi decisions/.
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH. Gốc HQ tìm bằng dò ngược tới scripts/gate.py (không đếm cấp).
set -u
D="$(cd "$(dirname "$0")" && pwd)"; R="$D"; while [ "$R" != "/" ] && [ ! -f "$R/scripts/gate.py" ]; do R="$(dirname "$R")"; done
# ADR-112: thêm T-182 adv-01 (GET /budget 404 là lỗi đọc).
for f in T-179/check_11_doc_du_toan_loi T-182/adv-01-doc-du-toan-404-la-loi-doc; do
  out="$(node "$R/eval/$f.cjs" "$@" 2>&1 | tail -1)"; case "$out" in PASS) ;; *) echo "FAIL $f: $out"; exit 1;; esac
done
echo PASS
