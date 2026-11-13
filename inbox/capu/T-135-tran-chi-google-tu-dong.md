---
type: decision-request
task: T-135
from: chief-of-staff
to: capu
decide-by: 2026-11-14
reversible: yes
---
Cần quyết: khi anh merge PR duyệt tay, workflow tự gọi Google — trần chi cho đường tự động là gì?
Phương án A: chỉ trong hạn mức miễn phí của Google mỗi tháng (Place Details 1000 lượt/tháng) → chi thật $0; lô vượt hạn mức thì dừng trước Google, PR ghi "cần anh duyệt chạy tay" kèm số tiền.
Phương án B: mỗi lô tối đa $2 chi thật, cộng dồn tháng tối đa $10; vượt thì dừng như A.
Khuyến nghị: A — lô duyệt tay thường vài chục vendor, nằm gọn trong hạn mức miễn phí; lô lớn vẫn qua anh như nay.
Nếu không quyết: Spec làm theo A; công tắc AUTO_RESOLVE_OVERRIDES mặc định tắt nên chưa tốn gì cho tới khi anh bật.

Bổ sung (2026-11-13, từ spec v2): tháng 11 đã dùng 1.010 lượt ảnh, vượt 1.000 miễn phí. Nếu chọn A, từ nay tới hết tháng 11 mọi lô cần Place Details sẽ dừng chờ anh duyệt chạy tay (lô chỉ gỡ/đóng cửa vẫn tự chạy); từ 1/12 hạn mức mới thì tự chạy lại. Hai số trần nằm ở một file tham số, đổi sang B là đổi hai số.
