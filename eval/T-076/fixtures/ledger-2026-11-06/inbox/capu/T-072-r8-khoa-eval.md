---
type: decision-request
task: T-072
from: chief-of-staff
to: capu
decide-by: 2026-11-10
reversible: yes
---
Cần quyết: T-072 bị Spec Gate trả lần ba nên tự leo thang. Anh chỉ cần duyệt cho Product sửa câu chữ, hay muốn đảo hướng ADR-026?

**Chuyện gì xảy ra:** ADR-026 đã chọn gu là tín hiệu cộng điểm (không ưu tiên tuyệt đối). Luật R8 cho đường chat viết "giữa một vendor khớp và một vendor không khớp trong kết quả cuối, vendor điểm cao hơn đứng trên", nên cách cài "chia nhóm, vendor khớp lên trước" vẫn qua eval: top 5 toàn vendor khớp thì không có cặp nào để so. Spec critic đã cài thử và xác nhận (handoffs/T-072-D3.md). Lỗi là câu chữ và eval, không phải hướng.

Phương án 1: Product sửa R8 thêm vế "kể cả vendor bị loại khỏi top_k", `check_2` nhận danh sách ứng viên sau boost; kiểm chéo cách chia nhóm phải FAIL. → giữ ADR-026, thêm một vòng spec.
Phương án 2: Đảo ADR-026 sang gu ưu tiên tuyệt đối (cách A). → bỏ R8, tiêu chí 3 về dạng cũ; vendor vượt ngân sách có thể đứng trên vendor đúng ngân sách.
Khuyến nghị: **1**, một câu "theo khuyến nghị" là đủ.
Nếu không quyết: T-072 đứng yên; T-075 (làm sạch tag) vẫn đi tiếp.
