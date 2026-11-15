---
type: decision
id: ADR-100
date: 2026-11-15
decided_by: chief-of-staff
tasks: [T-170, T-172]
---
# ADR-099 gồm cả chữ trong bong bóng chat AI; tách thành việc back riêng

Spec Gate T-170 D1: prompt back bắt AI kèm nhãn giá ("luôn kèm nhãn giá trong ngoặc đúng như trong danh sách trên", tohong-back lib/matchFormatter.js:143), và khối ứng viên ghi "(giá marry.vn · 06/2026)" — đúng chuỗi Capu lấy làm ví dụ khi quyết bỏ nhãn (ADR-099). Chief phân xử: "mọi màn app cặp đôi" gồm cả lời AI trong chat cặp đôi.

- T-170 giữ phạm vi front (10 chỗ PriceTag), ghi lời AI vào "Không làm" trỏ tới T-172.
- T-172 (product, bậc B): đổi prompt/khối ứng viên để lời AI không nêu nguồn giá với cặp đôi; vẫn giữ tính trung thực (không khẳng định ngân sách cho giá ước tính, inv-003). Đổi prompt/LLM path theo luật repo tohong là quy trình Spec Kit đủ — ở HQ đi qua spec + Spec Gate như mọi việc. Các phần eval T-164 check_4/check_6 đo dòng hướng dẫn nhãn trong prompt sẽ lỗi thời khi T-172 merge (ghi ADR lúc đó).
