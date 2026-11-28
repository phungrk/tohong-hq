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

## Phụ lục: eval/bất biến cũ bị thay (cách ADR-126/137)

ADR-155 thay quy tắc "closed là giá trị lạ". Các eval của việc cũ đã đóng sau đây đỏ trên code T-234 là có chủ ý, không sửa cho khớp code: T-232 check_1, check_3, check_4, đường lui check_5 (`PR120_LINE` 4 giá trị); T-233 adv-01 ca D. Bất biến chờ merge `eval/T-232/bat-bien-cho-merge/inv-014` (4 giá trị) bỏ, thay bằng `eval/T-234/bat-bien-cho-merge/inv-014-...` (5 giá trị); thêm `inv-011` (closed vắng pool) đích `planner/vendor/pool/`.

Spec Gate T-234 (2026-11-28): 97 bản ghi ở 6 nhánh PR dữ liệu (#120 30, #121 39, #127 10, #126 9, #123 7, #125 2) mang cờ mà dòng log `google_ai_mode` cuối không có `ai_mode_result` (28 closed, 69 giá trị khác) — vi phạm FR-003 spec 008. inv-014 chỉ thăng sau khi các PR bổ sung log hoặc có miễn trừ có lý do.
