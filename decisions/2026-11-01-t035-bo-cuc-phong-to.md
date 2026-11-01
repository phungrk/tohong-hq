---
type: decision
id: ADR-015
date: 2026-11-01
decided_by: chief-of-staff
tasks: [T-035, T-031, T-034]
---
# T-035: nâng cỡ nhân vật trong eval T-031; phóng to trên điện thoại đọc được chữ

**Bối cảnh:** Capu yêu cầu nới bố cục bảng Mô hình, thêm chế độ phóng to, bot ở hai cổng nổi trên cùng. Spec `products/T-035-bo-cuc-phong-to.md` đòi nhân vật ≥68px ở 1280, ≥19px ở 390. Eval T-031 có trần 56px ở 1280 (S7) và sàn 9px ở 390 (C8 P2/P5) — mâu thuẫn trực tiếp.

**Quyết định:**
1. Chấp nhận sửa `eval/T-031/model-characters.cjs`: S7 20–56px → 68–114px ở 1280; C8 P2/P5 sàn 9 → 19px ở 390 (trần giữ). Đây là nâng chuẩn theo ý định mới của Capu, không phải nới cho khớp code. Spec T-031 mục 1 (cỡ hiển thị) và mục 6 (≥9px) được T-035 mục 1.1 thay.
2. Câu hỏi mở của Spec Writer (390px): chọn phương án đọc được. Ở chế độ phóng to trên điện thoại, bảng hiển thị ở cỡ chữ đọc được (svg khoảng 860px rộng) và kéo ngang/dọc **bên trong lớp phủ**; trang ngoài vẫn không cuộn ngang (inv-006 giữ). Lý do: mục đích của "phóng to riêng" là xem rõ nhân vật và chữ; phóng 15% không đạt ý định.
3. Phát hiện ngoài phạm vi: trên main `55e8e57` dot không bao giờ hiển thị (`.fx{display:none}` của T-019 ẩn `#fx_f`); eval cũ chỉ đọc thuộc tính nên không bắt. Sửa trong T-035 (spec mục 5) và rút bất biến "dot nhìn thấy được".
