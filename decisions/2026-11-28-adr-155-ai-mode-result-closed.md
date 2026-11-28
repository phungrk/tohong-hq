# ADR-155: `ai_mode_result: "closed"` là giá trị thứ năm, loại khỏi pool như `not_found`; uỷ quyền merge

- Ngày: 2026-11-28
- Người quyết: Capu ("cách 1, merge luôn khi xong")
- Thay một phần ADR-152 (đóng cửa vĩnh viễn không còn phải ghi là `not_found`) và mở rộng spec 008/T-232

## Quyết định

- Giá trị hợp lệ: `found`, `not_found`, `closed`, `address_mismatch`, `wrong_category`.
- `closed` = doanh nghiệp đóng cửa vĩnh viễn/ngừng hoạt động; vắng pool ở bước Sync như `not_found`. Dữ liệu cũ ghi đóng cửa là `not_found` (PR #124) vẫn hợp lệ, không cần đổi.
- Báo cáo gộp nhiều bản ghi: `not_found` > `closed` > `wrong_category` > `address_mismatch` > `found`.
- `schema.py` trên main dùng đúng dòng của các nhánh PR dữ liệu để hết xung đột.
- Chief merge PR code của việc này ngay khi adversary accept, gate GREEN, PR không xung đột và chỉ chứa thay đổi của việc.
