---
type: decision
id: ADR-024
date: 2026-11-05
decided_by: chief-of-staff
tasks: [T-053]
---
# Cho sửa phép đo của hai bất biến vendor-images sang helper vite dùng chung

**Bối cảnh:** Product (T-053, `products/T-053-sua-phep-do-vite.md`) tìm thấy `eval/invariants/planner/front/vendor-images/lib/vendor_img_inv.cjs` và `small_tile_tooltip.cjs` dùng cổng ngẫu nhiên và thăm dò nhận mọi 200, cùng lỗi gây FAIL giả như eval T-051 C9/C10. Sửa bất biến phải qua Chief of Staff và ghi `decisions/`.

**Quyết định:** cho phép T-053 đưa hai file này vào phạm vi: chuyển sang `eval/_lib/vite_dev.cjs` (cổng `listen(0)`, kill cả nhóm tiến trình, thăm dò kiểm nonce). Chỉ đổi phép đo; nội dung kiểm, ngưỡng và kết quả PASS/FAIL trên front hiện tại không đổi (eval T-053 phải chứng minh: PASS trên main, vẫn FAIL trên bản front bị phá có chủ đích).

**Hệ quả:** bất biến đề xuất "mọi eval front dựng vite dev dùng helper chung" bật được ngay khi T-053 qua Code Gate, không đỏ ở bể. Eval đã đóng khác không bị bắt sửa ngoài T-051 C9/C10, T-066, T-068 đã trong phạm vi.
