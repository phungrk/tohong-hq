---
type: decision
id: ADR-021
date: 2026-11-03
decided_by: capu
tasks: [T-051]
---
# Tự host ảnh vendor trên Cloudflare Pages (phương án A)

**Bối cảnh:** ảnh vendor trong app đang hotlink `www.marry.vn` (2.465 URL duy nhất trong `tohong-back/lib/vendorPool.generated.js`). Capu muốn tự host, miễn phí. Chief of Staff đề xuất Cloudflare Pages (không giới hạn băng thông/request ở gói free, 20.000 file/deploy) và nêu rủi ro bản quyền: ảnh thuộc vendor/marry.vn, tự host là sao chép và phát lại. Hai phương án: A (tự host toàn bộ ngay, sau xin phép hoặc thay ảnh vendor tự gửi), B (chỉ tự host ảnh vendor đã đồng ý).

**Quyết định (Capu, 2026-11-03):** "a chọn A, hướng cloudflare pages". Tự host toàn bộ ảnh vendor hiện có trên Cloudflare Pages.

**Ràng buộc:** việc bậc C. Capu tự tạo project Pages và token, tự merge. Agent không đặt secret, không chi tiền, không liên hệ vendor. Rủi ro bản quyền Capu đã được báo và chấp nhận; xin phép hoặc thay ảnh vendor là việc sau.

**Xét lại khi:** có vendor hoặc marry.vn yêu cầu gỡ ảnh, hoặc vượt giới hạn gói free.
