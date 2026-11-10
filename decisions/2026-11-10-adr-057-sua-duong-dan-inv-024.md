---
type: decision
id: ADR-057
date: 2026-11-10
decided_by: chief-of-staff
tasks: [T-119, T-120]
---
# Sửa cách INV-024 tìm repo (lỗi khi chuyển vào bể), không đổi điều nó đo

**Bối cảnh:** INV-024 viết ở `eval/T-119/bat-bien-cho-merge/` (3 cấp dưới gốc tohong-hq). Khi Chief of Staff chép nó vào `eval/invariants/planner/vendor/images/` (5 cấp), dòng `HQ = …/../../..` trỏ sai, nên khi không đặt `TOHONG_REPO` nó crash `FileNotFoundError` (spec-critic phát hiện ở Spec Gate T-120). Lúc chuyển vào bể tôi chạy kèm `TOHONG_REPO` nên không thấy.

**Quyết định:** đổi đúng dòng tính `HQ` sang dò ngược tới thư mục có `scripts/gate.py` (cách INV-005 front và các script khác đã dùng). Không đổi phép đo, ngưỡng hay phạm vi. Chạy lại không có `TOHONG_REPO`: PASS.

**Bài học:** khi chuyển bất biến chờ merge vào bể, chạy nó KHÔNG kèm biến môi trường, từ một cwd khác.
