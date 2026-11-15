#!/usr/bin/env bash
# Nguồn: T-169 (spec products/T-169-ho-so-mot-nguon-su-that.md v3, H1, H2, H5, H6; "Bất biến đề xuất" INV-A); spec-critic rút khi spec qua Spec Gate 2026-11-15.
# Nằm ở eval/T-169/bat-bien-cho-merge/ cho tới khi PR back T-169 merge (đỏ trên main 1519d44). Sau merge Chief of Staff đưa vào eval/invariants/planner/profile/ và đặt số.
# INV-A · MỘT THÔNG TIN MỘT GIÁ TRỊ Ở MỌI BỀ MẶT. Với hồ sơ cặp đôi lệch (một thông tin nằm ở nhiều trường hoặc bảng ngân sách / danh sách khách với giá trị khác nhau):
#   ngày cưới, số khách, ngân sách tổng, thành phố, phong cách hiện/dùng CÙNG một giá trị ở GET /api/couples/:id, summary, GET /guests, GET /budget,
#   tab Vendor (profileSnapshot, chip, lọc thành phố) và chat (khối hồ sơ, số bàn, ứng viên); mọi cách viết của một thành phố cho cùng tập vendor ở tab và chat.
#   Ngoại lệ chỉ-hiển-thị đã chốt ở spec: `capacity` đã lưu (chỉ Khách mời + summary) và `total_tr` của bảng khi hồ sơ không có `budget` (không vào ghép, không vào khối chat).
# Nội dung chạy: eval T-169 tiêu chí 1-4 (khung eval/T-169/_lib.mjs, R2 giả, không mạng, chỉ handler công khai). Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
# Tìm gốc HQ bằng cách dò ngược tới scripts/gate.py (ADR-070), không đếm cấp; chạy được từ mọi cwd.
set -u
d="$(cd "$(dirname "$0")" && pwd)"
while [ "$d" != "/" ] && [ ! -f "$d/scripts/gate.py" ]; do d="$(dirname "$d")"; done
[ -f "$d/scripts/gate.py" ] || { echo "FAIL không tìm thấy gốc tohong-hq"; exit 1; }
cd "$d" || exit 1
export TOHONG_BACK_REPO="${TOHONG_BACK_REPO:-$d/../tohong-back}"
bad=""
for f in check_1_ngay_cuoi_mot_gia_tri check_2_so_khach_mot_gia_tri check_3_ngan_sach_tong_mot_gia_tri check_4_thanh_pho_va_gu_mot_gia_tri; do
  out="$(node "eval/T-169/$f.mjs" 2>&1)"; rc=$?
  [ $rc -ne 0 ] && bad="$bad [$f: $(printf '%s' "$out" | tail -1 | cut -c1-300)]"
done
if [ -n "$bad" ]; then echo "FAIL$bad"; exit 1; fi
echo "PASS ngày, số khách, ngân sách, thành phố, gu: một giá trị ở mọi bề mặt"
