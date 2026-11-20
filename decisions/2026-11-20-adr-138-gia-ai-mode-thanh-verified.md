# ADR-138: Giá Google AI Mode của các venue PR #108 được ghi price_source = verified

Ngày: 2026-11-20 · Người quyết: Capu · Ghi bởi: Chief of Staff · Việc: T-217

## Bối cảnh
Theo hướng 2 (T-217), 84 venue có dữ liệu AI Mode được đánh dấu verified. Bước sinh pool lúc đó sẽ lấy mô tả và sức chứa từ nguồn, nhưng chỉ lấy giá khi `price_range.price_source == "verified"`.

Chief nêu ba cách xử lý giá:
1. Làm tiếp, để giá cho việc sau.
2. Gộp phần giá vào T-217.
3. Đổi nguồn giá thành verified.

Chief nói trước điều Capu sẽ chấp nhận ở cách 3: cặp đôi thấy giá như đã xác minh, trong khi nguồn ghi "không rõ gồm VAT/phí phục vụ".

## Quyết định
Capu chọn cách 3: "Đổi nguồn giá thành verified".
- Với các venue trong tập S của T-217 có `price_range` từ AI Mode, đổi `price_source` từ `google_ai_mode` thành `verified`.
- Giữ nguyên `note`. Nguồn gốc AI Mode vẫn còn trong `enrichment_log` và `verification_notes`. Chief đề nghị Product ghi thêm vào `note` một dòng "nguồn: Google AI Mode" để lần ngược được.
- Đây là quyết định về dữ liệu, không đổi pipeline.
