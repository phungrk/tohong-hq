---
type: decision
id: ADR-052
date: 2026-11-08
decided_by: chief-of-staff
tasks: [T-112, T-110]
---
# Kết quả chạy thật duyệt tay T-112; INV-020/021 vào bể; vượt hạn mức request của check_7

**Diễn biến:**
- **Lần chạy 1** (run 42467255563): link `share.google` chuyển về `www.google.com/share.google?q=…`, không đọc được place_id (`link_no_place_name`). `--suggest` tìm được ứng viên cho Én (`ChIJ_Q8PLiQvdTERNk66UVRKf8U`) và Thiskyhall (`ChIJYXnCmV8vdTERiGx61oHIb1E`). Capu xác nhận cả hai là đúng.
- Chief of Staff điền hai place_id vào `manual_overrides.json` trên PR tohong#74. Theo ADR-051, Chief of Staff merge #74, vì sổ đăng ký lần chạy đòi log của lần 1 phải có trên main.
- **Lần chạy 2** (run 42473153801) mở PR dữ liệu tohong#75. Pool tạo lại ở tohong-back#43. Cả hai do Chief of Staff merge theo ADR-051.

**Kiểm trước khi merge:**
- Pool đổi đúng 5 vendor: Én, Thiskyhall, Orange Studio đổi `photos`; Tự Do và Pergola bị gỡ hoặc ẩn khỏi pool.
- INV-012 đến INV-022, INV-020, INV-021 đều xanh.
- check_7 của T-110 chỉ đỏ đúng một vế: **vượt hạn mức request của chuỗi duyệt tay**. Thực tế 12 request (4 Text Search, 4 Place Details, 4 media), spec cho tối đa 9 (hoặc 11 nếu có `--suggest`). Lý do: chuỗi phải chạy hai lần (link không đọc được, rồi `--suggest`), và Pergola được thử lại ở mỗi lần.
- Mọi request đều trong hạn mức miễn phí, chi phí thật $0, và được tính vào trần $30 của ADR-049.
- Chief of Staff chấp nhận độ lệch này. Không sửa eval.

**Quyết định:**
1. Theo ADR-028, INV-020 và INV-021 chuyển vào `eval/invariants/planner/vendor/images/`. Cả hai xanh trên main sau khi merge.
2. Bài học cho T-111/T-113: link `share.google` không đọc được place_id. Muốn duyệt tay thì dùng `--suggest` hoặc Capu đưa thẳng place_id.
