#!/usr/bin/env bash
# Nguồn: T-179 (spec products/T-179-danh-sach-vendor-moi-giu-danh-sach-cu.md, ADR-106). BẢN THAY ĐỀ XUẤT cho eval/invariants/planner/vendor/matching/inv-006-the-ghep-khong-hien-diem-cu.sh (Chief quyết, không tự thay).
# INV (planner/vendor/matching, front) · (a) danh sách vendor MỚI NHẤT của hạng mục, sau khi bấm Tìm vendor, theo dự toán/số khách đã lưu (không điểm hay nhãn theo số cũ hơn bản đã lưu);
#   (b) danh sách đã in giữ nguyên nội dung và ghi rõ "Theo dự toán Xtr · N khách" (đúng số nó đã dùng); (c) số không đổi so với danh sách gần nhất thì không in trùng, không gọi lại điểm.
#   Đo bằng sáu eval của T-179: check_1 (in mới), check_2 (cũ giữ nguyên), check_3 (không trùng), check_5 (bấm ngay sau khi kéo: đọc số sau lần lưu), check_7 (chi tiết mở theo số đã lưu), check_10 (nhãn đúng các dạng số). Nằm ở eval/T-179/bat-bien-cho-merge/ tới khi PR front T-179 merge (ADR-028: đỏ trên main);
#   Chief of Staff chép vào eval/invariants/planner/vendor/matching/ (thay inv-006 cũ, lib/ dùng lại eval/T-179/_lib.cjs + eval/T-171/_lib.cjs), ghi decisions/.
# Chạy: bash <file> [--repo <tohong-front>]
set -u
D="$(cd "$(dirname "$0")" && pwd)"; R="$D"; while [ "$R" != "/" ] && [ ! -f "$R/scripts/gate.py" ]; do R="$(dirname "$R")"; done
fail=0
for c in check_1_doi_du_toan_in_danh_sach_moi check_2_danh_sach_cu_giu_nguyen check_3_khong_in_trung check_5_bam_ngay_sau_khi_keo check_7_chi_tiet_tu_danh_sach_cu check_10_nhan_cac_dang_so; do
  out="$(node "$R/eval/T-179/$c.cjs" "$@" 2>&1 | tail -1)"; case "$out" in PASS) ;; *) echo "FAIL $c: $out"; fail=1;; esac
done
# ADR-112: thêm T-182 adv-02 (bảng so sánh tạo từ chi tiết không trộn hai mức dự toán).
out="$(node "$R/eval/T-182/adv-02-bang-so-sanh-khong-tron-hai-so.cjs" "$@" 2>&1 | tail -1)"; case "$out" in PASS) ;; *) echo "FAIL T-182 adv-02: $out"; fail=1;; esac
[ "$fail" = 0 ] && echo PASS; exit "$fail"
