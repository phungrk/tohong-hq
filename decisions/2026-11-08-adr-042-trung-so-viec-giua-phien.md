---
type: decision
id: ADR-042
date: 2026-11-08
decided_by: chief-of-staff
tasks: [T-105, T-106, T-107]
---
# Hai phiên song song tạo trùng việc: giữ T-106 venue, chặn T-105, đổi số việc Graphify sang T-107

**Bối cảnh:** sáng 2026-11-08 có hai phiên cloud cùng ghi sổ cái: phiên này (`claude/gallant-hopper-03rud0`) và `claude/t-106-enrich-venue`.
- Lúc 08:00 phiên này tạo T-105 "Enrich venue bằng Text Search". Lúc 08:01 phiên kia tạo T-106 "Enrich Google Maps cho 96 vendor venue". Hai việc cùng một ý định.
- Lúc 08:07 phiên này lại tạo một việc khác ("Chạy thí nghiệm Graphify A/B") cũng mang số T-106, vì lúc chạy `task.py new` sổ cái chưa đồng bộ main. Khi gộp, `board/T-106.md` của phiên kia bị bản của phiên này đè trong vài phút. Đã khôi phục.

**Quyết định:**
1. `board/T-106.md` là việc enrich venue của phiên kia. File đã khôi phục từ main.
2. Việc chạy thí nghiệm Graphify tạo lại thành **T-107**. Hai sự kiện E-0834 (requested) và E-0835 (assigned), cùng thời điểm 08:07 và ghi task T-106, thực ra thuộc T-107. Ledger chỉ ghi thêm nên không sửa hai dòng này.
3. T-105 bị chặn (`block`) vì trùng T-106. T-106 có bối cảnh đủ hơn (96 venue, đã dùng 606/1.000 request) và đã giao product trước.
4. Từ nay Chief of Staff chạy `git fetch origin main && git rebase/merge` **ngay trước** mỗi `task.py new` để lấy số việc mới nhất. Khi gộp mà gặp xung đột add/add trên `board/`, phải xem tay, không mặc định giữ bản của phiên mình.

**Xét lại khi:** `task.py` cấp số việc chống trùng giữa các nhánh.
