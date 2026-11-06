---
type: decision
id: ADR-027
date: 2026-11-06
decided_by: capu
tasks: [T-079]
---
# Capu quyết ngay trên issue bằng `/ok <...>` (một chiều ngược, sửa ADR-012)

**Bối cảnh:** Capu (2026-11-06) hỏi cách duyệt việc chờ quyết "trực tiếp trên task mà không cần thông qua chat". ADR-012 mục 2 cho issue là mặt kính một chiều ("Không có chiều ngược"), nên hiện chỉ quyết được qua chat. Chief of Staff đề xuất mở đúng một chiều ngược cho việc quyết; Capu: "Ok. Tuy nhiên thay vì /quyet <...> thì hãy thay bằng /ok <...>".

**Quyết định:**
1. Sửa ADR-012 mục 2: issue vẫn là mặt kính, **trừ** một lệnh: bình luận `/ok <nội dung>` của tài khoản `phungrk` trên issue của một việc đang chờ Capu quyết → workflow ghi `task.py decide` vào sổ cái (người quyết: capu, nội dung quyết: `<nội dung>`), rồi trả lời xác nhận trên issue.
2. Chỉ tài khoản `phungrk`; mọi tài khoản khác, bot, hay việc không ở trạng thái chờ quyết → không đổi gì sổ cái.
3. Việc chờ quyết có issue thì issue có bình luận tóm tắt phương án và link Decision Request. Việc không có issue vẫn quyết qua chat.
4. Mọi thứ khác của ADR-012 giữ nguyên (sổ cái là sự thật, `task.py` là cách duy nhất đổi trạng thái).

**Ràng buộc:** việc bậc C (bên ngoài ghi vào sổ cái, chạm workflow và quyền). Capu đọc diff và tự merge. Agent không đặt secret.

**Xét lại khi:** có lệnh `/ok` bị ghi sai, hoặc cần thêm lệnh khác ngoài `/ok`.
