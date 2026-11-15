---
type: decision-request
task: T-174
from: chief-of-staff
to: capu
decide-by: 2026-11-17
reversible: yes
---
Cần quyết: khi lưu dự toán đang bị lỗi (mạng chập chờn) mà cặp đôi tự thêm/sửa/xoá khoản chi trên màn Ngân sách, rồi bấm "Thử lại" — giữ các khoản đó và ghi cùng, hay khoá không cho thêm/sửa khoản tới khi lưu được?
Phương án A: giữ lại và ghi cùng (ghép theo id khoản với bản trên server) → cặp đôi không mất việc vừa làm; code phức tạp hơn một chút.
Phương án B: khoá thêm/sửa khoản khi đang có câu báo "Chưa lưu được dự toán" → đơn giản, không mất dữ liệu, nhưng cặp đôi phải chờ lưu được mới sửa tiếp.
Khuyến nghị: A — đúng câu đầu spec "không làm mất việc vừa làm", Spec Gate cũng đề xuất A.
Nếu không quyết: T-174 dừng ở spec (lần trả spec thứ ba cho cùng ý định T-171).
Nguồn: handoffs/T-174-spec-gate-v3.md (lỗi chặn H5), spec products/T-171-the-vendor-theo-du-toan-hien-tai.md v3.
