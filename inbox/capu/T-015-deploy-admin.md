---
type: decision-request
task: T-015
from: chief-of-staff
to: capu
decide-by: 2026-10-31
reversible: yes
---
Cần quyết: anh làm 4 việc cấu hình dưới đây để em đưa màn hình admin lên production?

1. Tạo Cloudflare API token mới (quyền Workers Scripts: Edit cho account), cập nhật GitHub secret `CF_API_TOKEN` của repo `phungrk/tohong-back`. Token cũ báo "Invalid access token [code: 9109]".
2. Trong thư mục `tohong-back`: `npx wrangler secret put ADMIN_USER_IDS` (Clerk user id của anh, dạng `user_…`), `npx wrangler secret put CLERK_SECRET_KEY` (để thấy email cặp đôi), tuỳ chọn `npx wrangler secret put ADMIN_SLACK_WEBHOOK_URL`.
3. Cho em biết URL production của frontend (Vercel) để điền `ADMIN_APP_URL = "https://<front>/?admin"` trong `wrangler.toml` (link trong tin Slack).
4. Chạy lại workflow "Deploy to Cloudflare Workers" của `tohong-back` (hoặc báo em, em chạy lại).

Phương án A: anh làm 4 việc trên → em khôi phục frontend (revert phungrk/tohong-front#49), kiểm trên production, merge phungrk/tohong#51.
Phương án B: để sau → production giữ bản cũ (paywall cũ vẫn còn lỗ hổng tự kích hoạt gói; chưa có admin).
Khuyến nghị: A, vì lỗ hổng tự kích hoạt gói vẫn mở trên production cho tới khi backend mới được deploy.
Nếu không quyết: code đã merge nhưng không chạy; lần deploy tự động tiếp theo của tohong-back vẫn sẽ lỗi vì token.
