# ADR-147: T-224 cảnh báo theo số tin lỗi, không theo tỉ lệ

- Ngày: 2026-11-23
- Người quyết: Chief of Staff (phân xử Spec Gate D1 của T-224, `handoffs/T-224-D1.md`)
- Liên quan: ADR-145 (ý định và uỷ quyền merge T-224)

## Bối cảnh

Ý định gốc ghi "cảnh báo khi tỉ lệ lỗi vượt ngưỡng". Spec Gate D1 chỉ ra production ở gói Workers Free, hạn mức ghi KV khoảng 1.000 lần/ngày, dùng chung với rate limit chat; đếm mọi tin để có mẫu số sẽ làm cạn hạn mức và sập chat.

## Quyết định

- Đường tin thành công không ghi KV. Vì không có mẫu số, bỏ điều kiện tỉ lệ khỏi luật cảnh báo.
- Cảnh báo khi số TIN lỗi trong khung 15 phút cố định hiện tại cộng khung liền trước ≥ 5 (khoá `floor(epoch/900)`); chống lặp 60 phút, hết 60 phút vẫn đạt ngưỡng thì báo lại.
- Tỉ lệ lỗi vẫn đo được từ dòng log `chat_llm_result` và PostHog để phân tích, không dùng làm điều kiện cảnh báo.
- Đây là lệch chữ so với ý định của Capu; nêu trong Diff hành vi khi merge.
