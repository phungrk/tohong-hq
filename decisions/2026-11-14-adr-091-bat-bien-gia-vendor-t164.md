---
type: decision
id: ADR-091
date: 2026-11-14
decided_by: chief-of-staff
tasks: [T-164]
---
# Bốn bất biến giá vendor của T-164 vào thẳng bể planner/vendor/ (khác tiền lệ ADR-028)

Spec Gate T-164 v3 rút bốn bất biến và đặt thẳng vào `eval/invariants/planner/vendor/` (cấp cha, chạy cho images, matching, pool):
- inv-001 pool có nguồn giá hợp lệ và khung N4 tính lại được từ chính pool;
- inv-002 giá hiện ra luôn có nhãn;
- inv-003 giá ước tính không làm bằng chứng khẳng định ngân sách (gồm chat);
- inv-004 venue so giá/bàn × số bàn với tổng ngân sách.

Cả bốn PASS "chưa áp dụng" trên main hiện tại (chỉ bật khi pool có `priceSource` hoặc mã đã có), nên không làm đỏ việc khác — Chief chấp nhận để thẳng trong bể thay vì gác ở `bat-bien-cho-merge/`. Spec Gate đã sửa INV-C/INV-D để bật theo dữ liệu pool (không chỉ theo chuỗi trong một file mã) — đã thử FAIL đúng trên pool đóng dấu giả.

Lỗi thời sau PR pool của T-164: `eval/T-136/check_a2` (ghi cứng "(giá ước tính)") — không chạy lại, không sửa.
