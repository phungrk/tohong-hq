---
type: decision-request
task: T-070
from: chief-of-staff
to: capu
decide-by: 2026-11-10
reversible: yes
---
Cần quyết: marry.vn đã chết từ 2026-11-03 (522; workflow "Check marry.vn" đỏ cả hai lần chạy 2026-11-05). Nếu bản lưu Wayback không đủ, mình lấy ảnh vendor từ đâu?

Bối cảnh: công cụ mirror đã có `--fallback wayback` tải thẳng bản lưu (T-070, tohong-back#37 đã merge). Chưa có lần chạy thật nào sau khi merge. App đã có ảnh minh hoạ tự tạo khi ảnh hỏng (T-068), nên người dùng không thấy ô vỡ.

Phương án A: chạy mirror với wayback trước, đọc SUMMARY rồi mới quyết tiếp. Mất 1 lần chạy (khoảng 3-4 giờ). Nếu `wayback=` cao thì xong, không cần thêm gì.
Phương án B: mở việc cho vendor tự gửi ảnh (ô tải ảnh trong trang vendor hoặc qua form). Ảnh có quyền rõ ràng, giải quyết luôn rủi ro bản quyền ở ADR-021, nhưng chạm dữ liệu người dùng và liên hệ vendor thật, nên là việc bậc C, chậm.
Phương án C: giữ ảnh minh hoạ tự tạo lâu dài, không tìm nguồn ảnh khác.
Khuyến nghị: A ngay hôm nay, sau đó B cho những vendor Wayback không có ảnh. Wayback là đường rẻ nhất và đã có công cụ; B là đường bền vững về bản quyền.
Nếu không quyết: app tiếp tục hiện ảnh minh hoạ tự tạo cho mọi vendor có ảnh hỏng; không có lỗi hiển thị, chỉ thiếu ảnh thật.

Khi chạy A: workflow "Mirror vendor images" ở tohong-back, tick ô wayback, deploy=false trước. Gửi em SUMMARY.

---
**Capu quyết (chat 2026-11-06): A** — chạy mirror với wayback trước, đọc SUMMARY rồi quyết tiếp. Ghi ở đây vì `task.py decide` chưa nhận việc đã `done` (sửa ở T-083).
