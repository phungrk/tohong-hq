---
type: decision
id: ADR-038
date: 2026-11-07
decided_by: chief-of-staff
tasks: [T-098]
---
# INV-003 vendor/images dọn thư mục tạm; thêm INV-003, INV-004 planner

**Bối cảnh:** Lúc rút bất biến sau T-098, adversary thấy `eval/invariants/planner/vendor/images/inv-003-rewrite-check-khong-xanh-gia.py` mỗi lần chạy để lại một thư mục `/tmp/inv003-*`. Hiện đã sót khoảng 60 thư mục.

**Quyết định:**
1. Thêm `atexit.register(shutil.rmtree, tmp, True)` ngay sau `mkdtemp`. Đây chỉ là sửa vệ sinh, phép đo và kết luận không đổi. Đã chạy: PASS, không còn thư mục mới bị sót.
2. Adversary thêm hai bất biến planner, theo đề xuất ở ADR-037 mục 3:
   - `inv-003-helper-dung-config-vite-chon.py`: helper bọc đúng file config mà vite tự chọn.
   - `inv-004-vite-dev-khong-config-van-cache-rieng.py`: khi không có `vite.config`, mỗi lần chạy vẫn có cache riêng.
   Cả hai PASS trên helper hiện tại và FAIL trên các bản helper lỗi.

**Hệ quả:** không bất biến nào bị nới. Lưu ý: các thư mục `/tmp/inv003-*` cũ không tự xoá, chúng chỉ là rác tạm của máy chạy.
