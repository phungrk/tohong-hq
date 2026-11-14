---
type: decision
id: ADR-089
date: 2026-11-14
decided_by: capu
tasks: [T-160]
---
# Duyệt P0 đường ống giá vendor (tohong#99), trần $2

Capu (2026-11-14): "duyệt P0 trần $2, chạy đi".

P0 theo https://github.com/phungrk/tohong/issues/99: thử 30 vendor (15 có website, 15 không) trong pool hiện hành; đo tỉ lệ ra giá của N1 (website vendor) và N2 (bài bên thứ ba), tỉ lệ trượt cổng 5 kiểm, chi phí mỗi vendor. Trần chi $2 (ngoài token agent tự ghi qua hook). Không gọi Google. Tôn trọng robots.txt/điều khoản trang, trích dẫn ngắn. Không liên hệ vendor, không đăng/gửi gì ra ngoài. Không ghi `vendors.json` — P0 chỉ đo, kết quả vào `insights/`.

Điều kiện dừng (issue): N1 + N2 ra giá cho < 15% vendor thử → không xây crawler, chuyển N3 + N4.

Câu còn mở cho bước sau: tự merge giá theo bậc nào — Chief đề xuất bậc B (PR tự mở, 48 giờ không phản đối thì Chief merge); chưa quyết.

**Cập nhật 2026-11-14 — Capu: "bậc B ok".** Giá vendor qua đủ cổng 5 kiểm: workflow tự mở PR dữ liệu giá, xếp bậc B — 48 giờ không phản đối thì Chief of Staff merge; Capu không phải duyệt định kỳ, vẫn giữ quyền chặn; quay lại bằng revert. Áp cho P1–P2 (N1, N2, N4). N3 (cặp đôi báo giá) là dữ liệu người dùng — bậc C, việc riêng.
