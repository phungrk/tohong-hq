---
type: decision
id: ADR-099
date: 2026-11-15
decided_by: capu
tasks: [T-164, T-170]
---
# Bỏ hiển thị nhãn nguồn giá trên mọi màn app cặp đôi (đảo một phần T-164 H4)

Capu (2026-11-15): "hãy bỏ hiển thị nguồn giá. Ví dụ: Giá marry.vn · 06/2026"; khi được hỏi phạm vi, chọn "Mọi màn app cặp đôi" (admin vẫn thấy). Chief đã nêu rủi ro: nhãn "Ước tính theo hạng mục" là dấu duy nhất cho cặp đôi biết giá là giá đoán — Capu vẫn chọn bỏ.

Giữ nguyên:
- API vẫn trả `price_label`/`price_basis` (bất biến planner/vendor/inv-002 đo API, không đo màn — không đổi).
- Ước tính vẫn không làm bằng chứng khẳng định ngân sách (planner/vendor/inv-003): không chip "Trong ngân sách"/"Rẻ hơn" cho giá ước tính; dòng phép so T-167 vẫn mở đầu "Giá ước tính:" (đó là phép so, không phải nhãn nguồn — nếu Capu muốn bỏ cả tiền tố này thì là quyết định riêng).
- Admin (bảng enrich, ngăn kéo, Vendor data) giữ nhãn.

Lỗi thời khi việc cài merge: các eval front của T-164 đo nhãn trên app cặp đôi (`eval/T-164/check_5a_nhan_app_cap_doi.cjs` và phần app cặp đôi của eval khác nếu có) — không chạy lại, không sửa. Việc T-170 (product) rà và liệt kê đủ.
