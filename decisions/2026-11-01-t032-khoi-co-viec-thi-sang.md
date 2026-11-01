---
type: decision
id: ADR-012
date: 2026-11-01
decided_by: chief-of-staff
tasks: [T-032, T-028, T-029]
---
# T-032: khối có việc thì sáng; cập nhật inv-004; thay S1, S4 của eval T-028

**Bối cảnh:** Capu báo khối Ý định ghi "1 việc product chờ viết spec" mà không sáng. Spec T-028 (dòng 77) loại `nd_intents` khỏi quy tắc A; code T-029 làm đúng spec nên hai cổng không bắt. Spec sửa đổi: `products/T-032-khoi-co-viec-thi-sang.md`.

**Quyết định:**
1. Chấp nhận nguyên tắc của T-032: khối có số đếm "việc đang ở khối" thì số > 0 sáng, về 0 tắt, màu theo loại; ngoại lệ E1–E6 như spec (khối tích luỹ hoặc theo cửa sổ thời gian không có quy tắc A).
2. `eval/invariants/dashboard/model/inv-004` (không kẹt sáng) được cập nhật: dữ liệu "rảnh" trong `lib/model_inv.cjs` đổi `T('T-3','new','product')` thành `T('T-3','new','engineering')` và thêm `T('T-5','new','insight')`; mô tả đổi thành "khối có số đếm việc bằng 0 thì không sáng; khối giữ dot nhận dot mà sổ cái không có việc thì tắt trong 10 giây". Bản chất bất biến giữ nguyên. Spec-critic thực hiện khi T-032 qua Spec Gate, kèm bất biến mới inv-009 (khối loại "sáng khi > 0" sáng khi và chỉ khi số đếm > 0, đúng màu).
3. Ca S1, S4 trong `eval/T-028/model-dots.cjs` mô tả hành vi cũ (Ý định không sáng với việc `new` của product) bị spec T-032 thay; chúng là eval cục bộ của việc đã xong, không chạy cho việc mới, không dùng để trả về.

**Sửa quy trình:** Spec Gate phải soát với mọi khối hiển thị số đếm: quy tắc sáng có khớp con số không (một khối "có số mà tối" là cách hiểu thứ hai nhìn thấy được).
