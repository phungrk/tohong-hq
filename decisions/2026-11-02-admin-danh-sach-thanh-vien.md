---
type: decision
id: ADR-018
date: 2026-11-02
decided_by: capu
tasks: [T-041]
---
# Admin được xem danh sách thành viên kèm tên cô dâu, chú rể

**Bối cảnh:** spec 004 (T-018, `phungrk/tohong` `specs/004-admin-member-count/`) chỉ cho admin xem con số tổng, ghi rõ "không danh sách tên, email". Capu yêu cầu (phiên 2026-11-02): "ở màn hình admin, trong danh sách thành viên tôi muốn có tên của cô dâu & chú rể đi theo tài khoản thành viên đó".

**Quyết định:** thay giới hạn của spec 004: tab Thành viên được có danh sách tài khoản (email) kèm tên cô dâu, chú rể của cặp đôi gắn với tài khoản. Chỉ admin xem; chỉ đọc; không số điện thoại; không đưa tên/email vào analytics hay log.

**Bậc:** C (dữ liệu người dùng). Chief of Staff không merge; Capu đọc Diff hành vi và tự merge.
