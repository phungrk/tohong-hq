---
type: decision
id: ADR-049
date: 2026-11-08
decided_by: capu
tasks: [T-111]
---
# Enrich Google Maps cho toàn bộ vendor, trần $30, chạy ngay trong tháng 11

**Bối cảnh:** sau T-108, ảnh Google mới có ở venue (60/91), photography (60), makeup (7) và honeymoon (1). Khoảng 1.100 vendor của 13 hạng mục vẫn dùng ảnh marry.vn, mà marry.vn đã chết từ 2026-11-03 (ADR-030), nên đang hiện ảnh minh hoạ. Hạn mức miễn phí tháng 11 còn khoảng 900 lượt Text Search và khoảng 94 request ảnh.

**Quyết định (Capu, 2026-11-08):**
1. Chạy Text Search cho mọi vendor còn lại, rồi lấy ảnh Google Place Photos thay ảnh marry.vn. Chạy ngay, không chờ hạn mức tháng sau. **Trần chi: $30** cho cả đợt, cả Text Search lẫn ảnh. Workflow phải tự dừng khi chạm trần.
2. Luật theo kết quả Google Maps:
   - **Có trên Google Maps** (qua luật khớp sáu cổng, T-106 v4.1): giữ, lấy ảnh.
   - **Không có trên Google Maps:** thử lại **một lần** với tên rút gọn. Lần hai vẫn không có thì **remove**, lưu vào `removed_vendors.json` để khôi phục được.
   - **Tạm đóng cửa** (`CLOSED_TEMPORARILY`): gắn trạng thái tương ứng, **không hiển thị trên app**. Lần enrich sau kiểm lại.
   - Đóng cửa vĩnh viễn: gỡ như ADR-044.
   - Có kết quả nhưng luật khớp từ chối (`low_confidence`): đưa vào `review-needed.csv` để Capu duyệt. Không remove, vì đây không phải trường hợp "không có trên Maps".
3. Bậc C: Capu merge code, chạy thật trong phạm vi uỷ quyền này (≤ $30), Capu merge PR dữ liệu và PR pool.

**Liên quan:** T-110 (duyệt tay, trạng thái tạm đóng cửa), T-109 (dọn nợ: công cụ pool gỡ được vendor đã xoá, không ghi đè phone).
