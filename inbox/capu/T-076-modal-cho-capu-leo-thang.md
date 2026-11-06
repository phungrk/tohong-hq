---
type: decision-request
task: T-076
from: chief-of-staff
to: capu
decide-by: 2026-11-07
reversible: yes
---
Cần quyết: cho em sửa một dòng trong bộ đo của T-076 rồi chạy Spec Gate lại không?

Bối cảnh: T-076 (modal liệt kê việc chờ anh duyệt trên dashboard) bị Spec Gate trả lần thứ ba, nên luật tự chuyển lên anh. Ý định của anh không có hai cách hiểu. Hai lần trả trước đã được em phân xử và Product sửa xong (danh sách 4 loại việc, sự kiện "đã merge" thay token, thứ tự và nhãn). Lần thứ ba là lỗi bộ đo: hàm bấm vào ô Capu trong eval không cuộn ô vào màn hình trước khi bấm (ô nằm dưới mép, y≈1949px), nên code làm đúng vẫn đỏ. Sửa đúng một dòng `scrollIntoViewIfNeeded()` ở `eval/T-076/lib.cjs`; Spec Gate đã thử: bản cài đặt giả đúng spec xanh ngay sau khi sửa. Chi tiết: `handoffs/T-076-D3.md`.

Phương án A: Product sửa dòng đó, Spec Gate chạy lại một lần nữa, qua thì giao Engineering (bậc B vì sửa `scripts/task.py`; phần script sẽ có PR anh duyệt). Modal hôm nay sẽ hiện: T-072, T-074, T-016, T-070.
Phương án B: dừng T-076, dashboard giữ số đếm cũ (đếm cả việc đã merge).
Khuyến nghị: A — lỗi nằm ở bộ đo, không ở ý định; sửa một dòng.
Nếu không quyết: T-076 đứng ở trạng thái leo thang; dashboard vẫn hiện số sai.

Ghi chú: hôm nay inbox có 4 Decision Request (T-070, T-072, T-074, T-076), vượt mức 3/ngày. T-072 và T-074 do một phiên khác tạo. Em sẽ xem lại ngưỡng leo thang tự động khi spec bị trả lần 3 vì lỗi bộ đo (không phải ý định mơ hồ) — đề xuất sau.
