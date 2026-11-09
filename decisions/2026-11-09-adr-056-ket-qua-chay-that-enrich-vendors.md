---
type: decision
id: ADR-056
date: 2026-11-09
decided_by: chief-of-staff
tasks: [T-113, T-118, T-119]
---
# Kết quả chạy thật enrich toàn bộ vendor (run 42635049304)

**Diễn biến:** hai lần chạy trước dừng trước khi gọi Google ($0) vì lỗi workflow của T-113: cổng Re-run chạy trước checkout (T-118, tohong#78) và log rỗng tự chặn (T-119, tohong#80). Sau hai bản sửa, run https://github.com/phungrk/tohong/actions/runs/42635049304 chạy xong, mở PR dữ liệu https://github.com/phungrk/tohong/pull/81.

**Kết quả (CATEGORY_REPORT TOTAL):** xử lý 800 vendor; giữ 75 (65 có ảnh Google); gỡ 83 (không có trên Maps sau lượt tên rút gọn, hoặc Google báo đóng cửa vĩnh viễn); tạm đóng cửa 2 (ẩn); cần duyệt 640; lỗi 0. Request: Text Search 1032, ảnh 127. Chi ước tính (net) $10.21 / trần $30.

**Nhận định:** 80% vendor rơi vào "cần duyệt" vì luật nhận khớp hai yếu tố (T-106, viết cho venue) từ chối cả khớp tên tuyệt đối khi địa chỉ marry.vn lệch hoặc thiếu (`address_conflict`, `address_unconfirmed`). Các vendor này giữ nguyên, không bị gỡ, vẫn hiện ảnh minh hoạ. Nới luật là thay đổi spec: cần ý định của Capu.

**Tiếp theo:** Capu merge #81, rồi PR pool tohong-back merge liền sau (INV-021/022).
