---
type: decision
id: ADR-036
date: 2026-11-07
decided_by: chief-of-staff
tasks: [T-077, T-098]
---
# Bất biến chờ merge INV-002 planner tìm repo front qua `node_modules/vite/package.json`

**Bối cảnh:** Gate T-098 đỏ tầng 2 ở INV-001 planner (`inv-001-vite-dev-chi-qua-helper.py`). Nó bắt chính file chờ merge `eval/T-077/bat-bien-cho-merge/inv-002-vite-dev-cache-rieng-don-sach.py`, vì hàm `find_front()` kiểm `os.path.join(c, "node_modules", ".bin", "vite")`. Chuỗi này khớp mẫu `.bin', 'vite'` của INV-001. Thực ra hàm chỉ kiểm file có tồn tại, không chạy vite. Code T-098 không gây lỗi: tầng 1 xanh 4/4.

**Quyết định:**
1. Giữ nguyên INV-001: không thêm ngoại lệ, không nới mẫu.
2. Sửa đúng một dòng phát hiện repo front trong INV-002 chờ merge, đổi thành `os.path.isfile(os.path.join(c, "node_modules", "vite", "package.json"))`. Phần đo (cache riêng trong TMPDIR, cache chung không đổi, TMPDIR sạch) không đổi.
3. Đã kiểm: INV-001 PASS, INV-002 PASS trên helper T-098.

**Hệ quả:** gate T-098 không còn đỏ oan. Không bất biến nào trong bể bị sửa.
