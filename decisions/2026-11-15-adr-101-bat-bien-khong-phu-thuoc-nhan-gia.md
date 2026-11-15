---
type: decision
id: ADR-101
date: 2026-11-15
decided_by: chief-of-staff
tasks: [T-172, T-170]
---
# Ba bất biến giá đo không phụ thuộc chữ nhãn; planner/vendor/inv-006 mới

ADR-099/ADR-100 (Capu bỏ nhãn nguồn giá với cặp đôi, gồm lời AI) đảo đúng những câu ba bất biến cũ đo bằng chữ nhãn. Spec Gate T-172 v2 đã soát các bản thay (handoffs/T-172-D1.md và báo cáo accept): ngoài phần chữ nhãn không phần nào bị nới. Đổi ngay (xanh cả trên main lẫn trên bản cài giả đúng spec T-172):
- `planner/vendor/inv-003` (ước tính không làm bằng chứng khẳng định ngân sách) → chạy `eval/T-172/check_7_inv003_ban_thay_the.mjs` (giữ A, B, D; phần F không phụ thuộc nhãn thay C, E). inv-003 phải đi cùng bất biến mới `planner/vendor/inv-006-uoc-tinh-co-tin-hieu-rieng-trong-prompt-ai.mjs` (Spec Gate rút): AI luôn nhận tín hiệu riêng cho vendor giá ước tính — khép lỗ check_7 không bắt được bản cài bỏ nhãn mà không thêm tín hiệu.
- `planner/vendor/inv-004` (venue so giá/bàn × số bàn) → chạy `eval/T-172/check_8_inv004_ban_thay_the.mjs` (dòng giá venue bắt đầu "Giá: a-btr/bàn", cho phép ngoặc theo sau).
- `planner/vendor/images/inv-038` (ứng viên chat đúng pool + overlay) → vế (iv) đo dòng giá admin `^7-9tr(?:\s|$)` (sửa tại chỗ, như check_9).
Kiểm từ /tmp trên main: inv-003, inv-004, images/inv-038, vendor/inv-006 PASS.

Lỗi thời khi T-172 merge (không chạy lại, không sửa): T-164 check_4 mục (d), check_6, check_9; T-140 check_1 và bat-bien-cho-merge/inv-B-*; T-143 lib/adv-03-overlay-bien.mjs. T-136 check_a2 đã lỗi thời theo ADR-093. Khi T-170 (front) merge: T-164 check_5a và check_5 (phần app cặp đôi) lỗi thời; H4 spec T-164 chỉ còn đúng cho API và admin.

Phân xử minor H9 (T-172): lọc chữ nguồn giá ở tin AI cũ, summary.md, memory.yaml khi dựng ngữ cảnh gửi LLM; KHÔNG sửa chữ cặp đôi gõ (kể cả câu hỏi hiện tại). Thứ tự lọc: cụm dài trước ("ước tính theo hạng mục" trước "giá ước tính").
