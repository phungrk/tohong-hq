---
type: decision
id: ADR-030
date: 2026-11-07
decided_by: capu
tasks: [T-070, T-051]
---
# Từ bỏ lấy ảnh vendor từ marry.vn

**Bối cảnh:** marry.vn chết từ 2026-11-03 (522; workflow "Check marry.vn" đỏ mọi lần chạy tới 2026-11-06). Mirror qua Wayback (T-065/T-069/T-070) lấy được 0 ảnh: 11/16 ảnh hỏi được Wayback báo không có bản lưu, phần còn lại bị ngắt mạch vì lỗi mạng; Capu mở tay 2 link mẫu trên web.archive.org cũng không có ảnh. Capu đã chọn T-070 phương án C (giữ ảnh minh hoạ tự tạo, T-068).

**Quyết định (Capu, 2026-11-07):** "hãy bỏ lịch chạy hàng ngày đi. từ bỏ cách lấy hình từ marry.vn".
1. Xoá lịch kiểm marry.vn hằng ngày của Chief of Staff và workflow `.github/workflows/check-marry.yml`.
2. Không chạy mirror từ marry.vn hay Wayback nữa. Ảnh vendor hỏng hiển thị ảnh minh hoạ tự tạo (T-068).
3. Code mirror (`tohong-back` scripts/vendor-images) giữ nguyên, không xoá; ảnh đã tự host trên Cloudflare Pages (nếu có) giữ nguyên.

**Xét lại khi:** có nguồn ảnh vendor mới (vd vendor tự gửi ảnh — T-070 phương án B).
