---
type: decision
id: ADR-029
date: 2026-11-06
decided_by: chief-of-staff (theo ý định Capu, T-081)
tasks: [T-081]
---
# INV-009 hq/dashboard nhận link issue của repo sổ cái

**Bối cảnh:** T-081 (Capu chọn tách từ tiêu chí 5 T-079) thêm link `Issue #<n>` vào dòng modal việc chờ Capu. INV-009 (link Capu an toàn, công khai không rò) chỉ nhận URL `pull/<n>` và link Decision Request, nên sẽ đỏ với tính năng mới. Spec T-081 qua Spec Gate v1; spec-critic khuyên thắt chặt hơn bản nháp của Product (bản nháp nhận `issues/<n>` của mọi repo `phungrk/*`).

**Quyết định:** INV-009 (cả bản kiểm export `.sh` lẫn bản kiểm trang `lib/link_capu_inv.cjs`) nhận thêm đúng `https://github.com/phungrk/tohong-hq/issues/<n>` với `<n>` khớp `[1-9][0-9]*`. Mọi phép từ chối cũ giữ nguyên; issue của repo khác, số 0/007, `#issuecomment`, `http` vẫn bị từ chối. INV-013 (T-081) kiểm `<n>` khớp trường `issue` của việc.

**Hệ quả:** INV-009 vẫn xanh trên main hiện tại (chưa có link issue). Không bất biến nào khác đổi.
