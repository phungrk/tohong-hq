#!/usr/bin/env bash
# Nguồn: T-189 Code Gate (adversary, eval tầng 3 adv-01..03), mở rộng INV-006 sang dữ liệu biên.
# Bất biến: quy tắc ghi công của INV-006 (ảnh Google hiện kèm tên tác giả nhìn thấy được, cách khung ảnh <= 32px, 390px) vẫn giữ khi:
#   (1) hàng Vendors đã lưu có tên vendor THẬT dài nhất pool và/hoặc dòng "giá đã cập nhật" (dòng phụ nhiều dòng);
#   (2) chi tiết vendor về 2xx không có điểm ("Chưa có điểm") rồi so sánh, và bảng so sánh có vendor không có điểm (các nhánh sao chép vendor);
#   (3) chat (4 bề mặt) và tờ Ngân sách với vendor tên dài nhất pool.
# Lý do: INV-006 chỉ thử tên ngắn, giá không đổi, mọi vendor có điểm; T-189 tìm ra hàng Đã lưu tên dài làm ghi công cách ảnh 34-51px (đỏ cả ở 0221a5c,
#   tức lỗi có từ T-156) và các chỗ `{...vendor}` làm rơi photoCredits (T-174/T-182). Dữ liệu là pool thật nên khi pool đổi, ca thử tự chọn lại vendor dài nhất.
# Đo bằng eval/T-189/adv-01..03 (Chromium 390px, chữ nhìn thấy + hình học). Chạy ~3 phút. Repo: TOHONG_FRONT_REPO, TOHONG_BACK_REPO.
set -u
HQ="$(cd "$(dirname "$0")" && pwd)"; while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
for n in adv-01-da-luu-gia-doi-ten-dai adv-02-chat-khong-diem-ten-dai adv-03-ngan-sach-ten-dai; do
  r="$(bash "$HQ/eval/T-189/$n.sh" 2>&1 | head -1)"
  [ "$r" = "PASS" ] || { echo "FAIL $n: $r"; exit 1; }
done
echo PASS; exit 0
