---
type: decision-request
task: T-156
from: chief-of-staff
to: capu
decide-by: 2026-11-21
reversible: yes
---
Cần quyết: ghi công ảnh Google đợt này chỉ hiện TÊN tác giả có đủ không, hay mở việc lưu và hiện LIÊN KẾT tác giả (và chữ "Google Maps")?
Phương án A: đợt này chỉ hiện tên (spec T-156 hiện tại) → làm ngay, bậc B; nếu Google bắt buộc liên kết thì app vẫn chưa tuân thủ đầy đủ.
Phương án B: A + mở việc bậc C lưu `uri` tác giả và thêm chữ "Google Maps" → đụng back, generator, overlay, schema pool; tuân thủ đầy đủ hơn.
Khuyến nghị: A ngay, rồi B sau khi có người đọc nguyên văn trang chính sách Places của Google (phiên cloud bị chặn developers.google.com). Spec Gate đoán ~75–80% là Google đòi cả liên kết.
Nếu không quyết: T-156 vẫn làm theo A; B không bắt đầu.
