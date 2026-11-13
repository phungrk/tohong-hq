---
type: decision
id: ADR-086
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-153, T-043]
---
# planner/admin/members inv-006: điều hướng bằng cách bấm tab "Thành viên" (phân xử Spec Gate T-153 D1)

**Bối cảnh:** Capu muốn admin mở thẳng tab Dữ liệu vendor (T-153). Spec Gate T-153 D1: mọi cách cài đúng ý đó làm đỏ `planner/admin/members/inv-006` — không phải vì lộ dữ liệu cá nhân, mà vì `lib/members_ui_inv.cjs` mở `/?admin` rồi gõ ngay vào ô tìm thành viên, ngầm giả định "Thành viên" là tab mặc định.

**Phân xử:** bất biến lỗi thời ở phần điều hướng, không phải spec sai. Sửa `members_ui_inv.cjs`: sau `page.goto` bấm tab có tên bắt đầu "Thành viên" (nếu có) rồi mới đo. Mọi check tính chất (TC4: không mang từ khoá trên URL, không lưu tên/email/từ khoá vào storage, tiêu đề không đổi…) giữ nguyên. Đã chạy trên main: PASS.

`eval/T-043/check_members_ui.cjs` (eval tầng 1 của việc đã xong) có thể đỏ theo cùng cách sau T-153 — lỗi thời theo ADR này, không chạy lại, không sửa.
