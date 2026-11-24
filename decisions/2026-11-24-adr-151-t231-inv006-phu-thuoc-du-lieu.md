# ADR-151: T-231 — dòng mới của vendor-enrich/inv-006 về `ai_mode_result` là đo phụ thuộc dữ liệu, không chặn

- Ngày: 2026-11-24
- Người quyết: Chief of Staff (phân xử mâu thuẫn spec T-230 tiêu chí 7 với bất biến `planner/admin/vendor-enrich/inv-006`)
- Tiền lệ: ADR-131 (bất biến apply phụ thuộc dữ liệu)

## Bối cảnh

Spec T-230 (tiêu chí 7, check_7) bắt buộc danh mục `pool-input-fields.json` có mục `ai_mode_result`. Trên nhánh T-231, `vendor-enrich/inv-006` (đã đỏ trên main vì `capacity_max` và các trường khác) thêm dòng "danh mục có `ai_mode_result` mà không bước nào đọc". Bộ đo `eval/lib/pool_reads.py` chỉ thử các trường có mặt trong dữ liệu thật; chưa vendor nào mang cờ nên không thấy `build_pool.py` đọc trường này. check_1..8 của T-230 chứng minh `build_pool.py` có đọc (bản sao tạm có cờ thì vendor vắng pool).

## Quyết định

- Dòng mới là dương tính giả do đo phụ thuộc dữ liệu; không chặn T-231. Không sửa inv-006 cho khớp code.
- inv-006 nằm ngoài vùng gate của T-231 (`planner/vendor`), vốn đã đỏ trên main; Code Gate xét theo gate của việc.
- Nợ quy trình: `pool_reads.py` nên thử cả trường có trong danh mục bằng giá trị giả (không chỉ trường có trong dữ liệu thật). Sửa bộ đo phải qua Chief + `decisions/`; ghi vào danh sách nợ cùng inv-006 `capacity_max` và inv-014.
