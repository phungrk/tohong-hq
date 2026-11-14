#!/usr/bin/env bash
# Nguồn: T-156 (spec products/T-156-ghi-cong-anh-google-o-moi-be-mat.md, tiêu chí 3, 4, 5, 6). Bất biến ĐỀ XUẤT cho eval/invariants/planner/front/vendor-images/ (vùng này đã có INV-001..005; số do bể cấp).
# Bất biến: ở MỌI bề mặt app cặp đôi hiện ảnh vendor (thẻ danh sách, gallery chi tiết từng ảnh, chọn so sánh, bảng so sánh, hàng Vendors đã lưu, tờ Ngân sách) và ở admin (ngăn kéo, hộp kết nối):
#   ảnh Google hiện kèm TÊN TÁC GIẢ nhìn thấy được cạnh chính ảnh đó; ảnh không phải Google không ghi công; ảnh Google thiếu tên tác giả không hiện.
# Lý do: yêu cầu hiển thị tác giả ảnh của Google Places; ADR-041 điểm 4. Sau T-156 một bề mặt MỚI hiện ảnh vendor mà quên ghi công sẽ đỏ ở đây.
# CHƯA ÁP DỤNG cho tới khi T-156 merge: trước đó bất biến này ĐỎ trên front main (đúng như mong đợi); Chief of Staff chuyển vào bể sau khi PR front T-156 merge.
# Đo bằng eval/T-156/check_3, 4, 5, 6 (dữ liệu pool thật, Chromium 390px, chữ nhìn thấy + hình học, không đọc tên class/hàm). Chạy ~90 giây.
# Chạy: bash eval/T-156/bat-bien-cho-merge/inv-xxx-ghi-cong-hien-o-moi-be-mat.sh  (repo front: TOHONG_FRONT_REPO, rồi ../tohong-front cạnh tohong-hq)
set -u
HQ="$(cd "$(dirname "$0")/../../.." && pwd)"
for n in check_3_be_mat_chat check_4_be_mat_da_luu check_5_khong_phai_google_va_thieu_ghi_cong check_6_admin_ngan_keo_va_hop_ket_noi; do
  r="$(bash "$HQ/eval/T-156/$n.sh" 2>&1 | tail -1)"
  [ "$r" = "PASS" ] || { echo "FAIL $n: $r"; exit 1; }
done
echo PASS; exit 0
