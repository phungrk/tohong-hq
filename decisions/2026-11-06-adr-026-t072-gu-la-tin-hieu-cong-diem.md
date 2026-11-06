---
type: decision
id: ADR-026
date: 2026-11-06
decided_by: chief-of-staff (phân xử sau Spec Gate T-072; Capu có thể đảo)
tasks: [T-072]
---
# T-072: gu là tín hiệu cộng điểm, không phải ưu tiên tuyệt đối; sửa tiêu chí 3 của issue #16

**Bối cảnh:** Spec critic (`handoffs/T-072-D1.md`) chỉ ra tiêu chí 3 trong issue #16 ("top 10 chứa min(10, số vendor khớp) vendor khớp") mâu thuẫn với chính issue ("khớp 1,0, còn lại 0,5, giữ trọng số 35%; không đổi trọng số tín hiệu khác"). Khớp gu chỉ hơn 17,5 điểm, lịch + ngân sách chênh tới 45 điểm, nên tiêu chí 3 chỉ đạt được bằng luật R4 "vendor khớp luôn đứng trước", tức trọng số gu vô hạn. Mô phỏng 96 tổ hợp trên pool thật: cách cộng điểm đạt tiêu chí 3 ở 76/96; cách R4 có 20/96 tổ hợp đẩy vendor đúng ngân sách, chất lượng cao ra khỏi top 10 để nhường vendor khớp gu nhưng vượt ngân sách quá 20%.

Tiêu chí 3 do Chief of Staff viết khi chuyển ý định của Capu thành issue, không phải lời Capu. Thiết kế Capu đã đọc (tài liệu "Hướng đi thuật toán matching") đặt gu là một trong ba nhóm tín hiệu của tầng chấm điểm, và "không bịa giá / đúng ngân sách" đứng trên gu trong bảng ưu tiên `vision.md`.

**Quyết định:**
1. Chọn **cách B**: giữ luật 1,0 / 0,5, bỏ R4, không có luật dành chỗ. Gu không bao giờ đẩy vendor đúng ngân sách ra khỏi top 10.
2. Tiêu chí 3 của issue #16 và brief T-072 thay bằng: **3a** hai vendor chỉ khác nhau ở chỗ khớp gu thì vendor khớp xếp trên (đo thứ tự, không chỉ tổng điểm); **3b** trên pool thật, ở mỗi tổ hợp style × hạng mục, số vendor khớp trong top 10 không ít hơn bản hiện tại, và Product chạy thử để xác nhận.
3. Hai đường (thẻ vendor và chat) phải cho cùng thứ tự với cùng hồ sơ; Python áp luật ở stage 2 và stage 3 không được đảo lại thứ tự gu.
4. Mở rộng tag thực hiện ở bước chấm điểm (như spec), spec ghi rõ lý do lệch khỏi gợi ý "khi dựng profile" của issue.

**Hệ quả:** Product sửa spec + eval rồi `respec`. Issue #16 được cập nhật tiêu chí 3 kèm comment dẫn ADR này. Nếu Capu muốn gu ưu tiên tuyệt đối (cách A) hoặc dành chỗ (cách C), ghi `decided` và Product sửa lại.
