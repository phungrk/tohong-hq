---
type: decision
id: ADR-063
date: 2026-11-11
decided_by: chief-of-staff
tasks: [T-126]
---
# T-126: ứng viên ít đánh giá (<2) thì không dùng làm căn cứ gỡ/ẩn vendor (tạm thời, chờ Capu)

**Bối cảnh:** spec T-126 điều kiện C-1: khi nơi Google có `userRatingCount` < 2, kết quả khớp coi là không đáng tin, nên báo `CLOSED_PERMANENTLY` / `CLOSED_TEMPORARILY` của nơi đó không được dùng để gỡ hay ẩn vendor. Điều này thu hẹp ADR-044 mục 1 và T-110 hành vi 6 (Capu: "không có trên Google Maps → remove"; "đóng cửa vĩnh viễn → gỡ") cho riêng ca ít đánh giá. Spec-critic yêu cầu ghi quyết định.

**Quyết định (Chief of Staff, tạm thời):** giữ C-1 như spec: thứ tự ưu tiên duyệt tay > few_reviews > đóng cửa tự động. Lý do: một nơi trùng tên mà gần như không ai đánh giá thường không phải đúng tiệm; gỡ vendor theo trạng thái của nơi đó là gỡ nhầm, không đảo ngược tự động được. C-1 viết thành một điều kiện tách riêng, đổi bằng một dòng; nêu trong Diff hành vi bậc C.

**Chờ Capu:** đã hỏi 2026-11-11, chưa trả lời. Capu chọn "đóng cửa vĩnh viễn thì vẫn gỡ" → đổi C-1, ghi ADR mới thay thế ADR này. Vendor đã gỡ trước đây (19 ở main, 6 ở tohong#83) không được khôi phục tự động.
