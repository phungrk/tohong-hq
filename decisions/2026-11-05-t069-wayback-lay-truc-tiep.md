---
type: decision
id: ADR-023
date: 2026-11-05
decided_by: chief-of-staff (theo ý định Capu, T-069)
tasks: [T-069, T-070]
---
# Mirror ảnh: bỏ API availability của Wayback, tải thẳng `/web/<mốc>id_/`

**Bối cảnh:** run Actions 42043795998 (`--fallback wayback`) ra `wayback=0`, dừng sớm `mixed-50/50`. Capu kiểm tay 2026-11-05: `archive.org/wayback/available?...` trả 429 Too Many Requests, còn URL bản lưu trực tiếp (`web.archive.org/web/20240730154649/https://www.marry.vn/images/detailed/111/anh-cuoi-dinh-ha-thu-4.jpg`) mở ra ảnh. Spec T-069 (`products/T-069-wayback-lay-anh-truc-tiep.md`) qua Spec Gate v1.

**Quyết định:**
1. Công cụ mirror không gọi `/wayback/available` nữa; tải thẳng `<base>/web/20261101000000id_/<URL gốc>` và theo chuyển hướng (spec T-069 mục A). Thay T-065 mục 3, 8, 9, 10, 13, 18, 25.
2. INV-006 giữ nguyên hiệu lực và ngưỡng 0,9 giây, không đổi phép kiểm. Chỉ sửa chữ docstring (bỏ "mỗi URL một availability", nêu "mốc + bản lưu"); việc sửa chữ này làm cùng lúc rút INV-007.
3. Thêm INV-007 "`mirror` không bao giờ gửi yêu cầu tới `/wayback/available`" từ `eval/T-069/inv-proposed-khong-goi-availability.py`, **rút sau khi T-070 qua Code Gate** (trên main hiện đỏ). Số 007 để trống tới lúc đó; spec-critic đã thêm INV-008 (sàn tốc độ) và INV-009 (429 không gõ cửa mãi), cả hai xanh trên main 8074508.
4. Tốc độ Wayback mặc định 2 giây mỗi yêu cầu, sàn 1 giây không đổi. Capu có thể chọn 1 giây (đổi hằng số và `check_4`).
5. Eval T-065 `check_1`..`check_7` (mô hình availability) **superseded** bởi eval T-069; là eval của việc đã đóng (T-065/T-067), không chạy lại, không sửa.

**Hệ quả:** run thật đầu tiên sau merge là phép đo: đọc `retry-later` và `circuit=open` trong SUMMARY. Nếu `circuit=open` mà không có 429, nghi trước tiên bản lưu có mã gốc 5xx (minor spec-critic ghi ở `board/T-069.md`).

**Xét lại khi:** run thật cho thấy 2 giây vẫn bị chặn liên tục, hoặc `wayback=none` nhiều bất thường (khi đó xét CDX, hiện ở "Không làm").
