---
type: decision-request
task: T-074
from: chief-of-staff
to: capu
decide-by: 2026-11-10
reversible: no
---
Cần quyết: Bộ eval chấm mù đo cái gì, và "vendor phù hợp" nghĩa là gì? Phải chốt trước khi mời người chấm, vì đổi sau là chấm lại từ đầu.

**1. Cách đo (Spec Gate: handoffs/T-074-D1.md, lỗi 1)**
- Phương án A: người chấm tự chọn top 5 từ toàn bộ vendor hạng mục → đo trùng với máy. Đúng chữ "top 5 mong đợi" trong issue #21, nhưng mỗi ô người chấm phải xem 45–191 vendor; chi phí chấm lớn nhất.
- Phương án B (spec v1): người chấm chỉ chấm 5 vendor máy đưa lên + 3 đối chứng → precision@5. Rẻ nhất, nhưng mỗi lần đổi trọng số, vendor mới vào top 5 chưa có nhãn → lệnh báo "chưa chấm", không so được bản cũ với bản mới.
- Phương án C: người chấm chấm một tập ứng viên rộng hơn (đề xuất top 15 của máy + 5 ngẫu nhiên) → nhãn phủ được nhiều bản trọng số; chi phí ở giữa.
- Khuyến nghị: **C**, vì mục đích của anh là "biết matching tốt lên hay xấu đi" giữa các bản; A quá đắt, B không so sánh được.

**2. Định nghĩa "vendor phù hợp"**
- Spec đề xuất ba điều kiện: (A) qua tầng lọc với dữ liệu thật; (B) giá vừa ngân sách hạng mục; (C) đa số của 3 người chấm trả lời "có đủ để muốn liên hệ".
- Khuyến nghị: giữ (A)(B)(C); câu hỏi (C) viết thành "Với cặp đôi này, anh/chị có khuyên họ liên hệ vendor này không?", kèm ví dụ có/không trong gói chấm.

**3. Mốc giá ở điều kiện (B)**
- `priceMin` ≤ ngân sách ("có ít nhất một gói vừa túi"): makeup mức thấp còn 87 vendor đủ điều kiện.
- `priceMax` ≤ ngân sách (như matcher đang cộng điểm): makeup mức thấp chỉ còn 2 vendor.
- Khuyến nghị: **`priceMin`**, và hướng dẫn chấm nói rõ luật này để người chấm không tự áp `priceMax`.

**4. Ngưỡng đạt**
- 80% là số em phỏng đoán. Với 30 hồ sơ mỗi hạng mục, sai số khoảng ±14 điểm, nên 75–85% không kết luận được.
- Khuyến nghị: lần đầu chỉ đo lấy baseline, không đặt ngưỡng đạt/rớt; từ lần hai dùng luật "không tụt quá 10 điểm so với baseline".

**Ngoài quyết định này:** giá trong pool dồn cụm (84/98 vendor makeup ghi 3–8 triệu) và nhiều vendor đồng điểm, nên phần giá đang đo dữ liệu hơn là đo matching. Issue #22 (xác minh giá 50 vendor) là việc gỡ điều này.

Nếu không quyết: T-074 đứng yên; T-072 và T-073 vẫn đi tiếp, chỉ chưa có thước đo chung.
