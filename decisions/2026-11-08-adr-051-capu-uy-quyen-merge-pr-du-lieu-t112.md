---
type: decision
id: ADR-051
date: 2026-11-08
decided_by: capu
tasks: [T-112]
---
# Capu uỷ quyền Chief of Staff tự merge PR dữ liệu và PR pool của lần chạy duyệt tay (T-112)

**Bối cảnh:** Capu đã merge phungrk/tohong#73, phần code duyệt tay của T-112. Việc này thuộc bậc C, nên bình thường Capu tự merge mọi PR đi kèm.

**Quyết định (Capu, 2026-11-08):** "Sau khi em chạy thật, tạo PR thì anh cho em tự merge luôn."

**Phạm vi:**
- Áp dụng cho các PR sinh ra từ lần chạy thật workflow `Resolve overrides` của T-112 (ADR-048): PR dữ liệu ở phungrk/tohong (nhánh `resolve-overrides/*`) và PR pool tương ứng ở phungrk/tohong-back.
- Không áp dụng cho T-113 (enrich toàn bộ vendor) hay việc khác. Muốn mở rộng thì hỏi lại Capu.

**Điều kiện trước khi merge:**
- check_7 của T-110 xanh với mốc trước khi chạy: pool chỉ đổi đúng 5 vendor.
- INV-012..022 xanh trên nhánh PR.
- PR chỉ chứa dữ liệu, log và pool của lần chạy này.

Thiếu bất kỳ điều kiện nào thì dừng lại và báo Capu.
