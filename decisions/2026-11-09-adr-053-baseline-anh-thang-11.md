---
type: decision
id: ADR-053
date: 2026-11-09
decided_by: capu
tasks: [T-113, T-111]
---
# Baseline request ảnh Google tháng 11 = 1.010 (thay 606)

**Bối cảnh:** `tools/scraper/run-logs/usage-baseline.json` ghi `photos=606`, lấy từ console Google ngày 08/11. Khi duyệt code T-113, adversary đọc log Actions và thấy tháng 11, trước T-106, đã có 5 lần chạy refresh, mỗi lần 202 request:
- run 42385145662 với 4 attempt;
- run 42427615510 với 1 attempt.

Tổng là 1.010 request ảnh. Con số 606 đúng bằng 3 × 202, nên nhiều khả năng được đọc trước khi hai lần chạy cuối ngày 07/11 diễn ra. Đây là suy luận, tự tin khoảng 70%. Báo cáo chi phí Capu gửi (GMP_Reports tháng 11) không có dòng Maps nào, nên không dùng để đối chiếu được.

**Quyết định (Capu, 2026-11-09, "Ok" với đề xuất dùng 1010):** sửa baseline tháng 2026-11 thành `photos=1010`, `text_search=0`, `source="log Actions tháng 11: 5 lần refresh × 202 (ADR-053)"`, `decision` trỏ file này. Không thêm `runs_accounted`.

**Hệ quả:**
- Hạn mức ảnh miễn phí tháng 11 coi như đã hết. Trần $30 (ADR-049) tính chi thật theo con số này.
- Ước tính T-113: kỳ vọng khoảng $11,4, cận trên khoảng $20,7.
- Nếu thực tế dùng ít hơn 1.010, trần chỉ dừng sớm hơn, không bao giờ để chi vượt $30.
