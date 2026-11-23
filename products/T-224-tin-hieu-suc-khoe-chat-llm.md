# Spec T-224: tín hiệu sức khoẻ chat LLM và cảnh báo khi tỉ lệ lỗi cao

## Ý định
Capu: mỗi lỗi provider LLM ở production phát ra một tín hiệu đo được, và Capu được cảnh báo khi tỉ lệ lỗi vượt ngưỡng trong một cửa sổ thời gian, để một sự cố như đợt 402 từ 3/11 đến 22/11 không còn im lặng. Ủy quyền merge: `decisions/2026-11-23-adr-145-uy-quyen-merge-t223-t224.md`. Nguồn: `insights/2026-11-23-su-co-gemini-402.md` (đề xuất 2).

## Bằng chứng
- Đợt 402 kéo dài ~20 ngày mà không có tín hiệu nào chạm tới Capu hay sổ cái; Capu chỉ biết khi mở trang Gemini (`insights/2026-11-23-su-co-gemini-402.md`, kết luận 4). Tự tin ~90% về phía nhà cung cấp (chỉ dựa ảnh).
- Đọc `tohong-back` `origin/main` (ad873eb): `lib/orchestrator.js` `_log` chỉ in khi `verbose`, và `lib/factory.js` đặt `verbose = NODE_ENV !== 'production'` mà `wrangler.toml` đặt `NODE_ENV="production"`, nên lỗi provider không in gì ở production. `lib/notifyAdmin.js` chỉ có kiểu `connect`/`upgrade`. Trong back không có mã PostHog. PostHog 90 ngày: 0 sự kiện `chat_*` (insight trên).
- Đã có sẵn, dùng lại được: webhook Slack admin `ADMIN_SLACK_WEBHOOK_URL` (secret đặt một lần theo chú thích `wrangler.toml`; định dạng POST JSON `{"text": ...}`), KV `RATE_LIMIT` (binding sẵn, `lib/rateLimit.js`), `ADMIN_APP_URL`.
- Tuần 20/11 Insight đã đề xuất event chat (`chat_vendor_match`, `insights/2026-11-20-weekly.md`); spec này không làm event nội dung/vendor, chỉ sức khoẻ LLM. Spec 003 (`tohong/specs/003-journey-events`) là phía front và bỏ qua chat_error của back: không chồng lấn.
- GIẢ ĐỊNH, tự tin ~70%: Slack webhook admin đã được đặt ở production (không kiểm được secret). Xem Câu hỏi mở.

## Giả thuyết
Nếu mỗi lỗi provider phát tín hiệu và có cảnh báo khi có >= 5 tin chat lỗi trong khung 15 phút hiện tại cộng khung liền trước thì thời gian từ lúc chat hỏng tới lúc Capu biết giảm từ ~20 ngày xuống dưới 1 giờ (với điều kiện Slack webhook có đặt). Chỉ số bảo vệ: tin nhắn chat vẫn trả lời/lỗi y hệt như hiện nay; không tăng độ trễ cảm nhận được (không chờ kênh phụ trước khi gửi SSE).

## Hành vi (người dùng thấy gì)
Cặp đôi không thấy gì đổi: chat vẫn trả lời, hoặc hiện thông báo lỗi kết nối như cũ. Thay đổi chỉ ở phía vận hành. Mọi thứ dưới đây chỉ áp cho **đường chat trả lời của cặp đôi** (`POST /api/couples/:id/chat`); không áp cho `/api/chat` cũ không auth, summarizer hay lời gọi LLM nền khác.

Định nghĩa dùng chung:
- **Lần thử thất bại**: một lần gọi provider kết thúc bằng lỗi (HTTP không 2xx, lỗi mạng, timeout, hoặc đứt giữa luồng). Mỗi lần thử lại cũng là một lần thử riêng.
- **Kết quả chat**: kết cục của một tin nhắn đã tới bước gọi LLM: `ok=true` nếu cặp đôi nhận được trả lời trọn vẹn, `ok=false` nếu họ nhận sự kiện lỗi. Tin bị chặn trước LLM (hết lượt dùng thử, rate limit, JSON sai) không có kết quả chat và không tính vào tỉ lệ.
- Nhãn lỗi `category` là nhãn do provider gán ở thời điểm đó (giá trị do lớp provider quyết định, có thể đổi theo thời gian). Spec không phụ thuộc giá trị nhãn, chỉ yêu cầu nó là chuỗi không rỗng.

1. **Dòng log mỗi lần thử thất bại.** Ở production (`NODE_ENV=production`), mỗi lần thử thất bại ghi đúng một lần `console.log` một chuỗi JSON một dòng, có `event: "llm_provider_error"` và các trường: `provider` (vd `"gemini"`), `model`, `category`, `http_status` (số, hoặc `null` nếu không có phản hồi HTTP), `attempt` (1, 2, ... theo thứ tự trong cùng một tin nhắn). Số dòng bằng đúng số lần gọi provider thất bại, bất kể có thử lại hay không.
2. **Dòng log mỗi kết quả chat.** Mỗi kết quả chat ghi đúng một dòng JSON `event: "chat_llm_result"` với `ok` (true/false), `provider` (provider trả lời khi `ok`, hoặc provider thất bại cuối; có thể `null`), `attempts` (tổng số lần gọi provider của tin nhắn đó, tối thiểu 1), `error_category` và `http_status` (lấy từ lần thất bại cuối khi `ok=false`; `null` khi `ok=true`). Đây là mẫu số cho tỉ lệ lỗi.
3. **PostHog (tuỳ chọn).** Khi `env.POSTHOG_KEY` có giá trị, hai loại sự kiện trên cũng được gửi tới PostHog (tên sự kiện y hệt, thuộc tính y hệt dòng log) tới `env.POSTHOG_HOST` nếu có, mặc định `https://us.i.posthog.com`. Gửi ẩn danh: `distinct_id` là hằng số không liên quan người dùng/cặp đôi, `$process_person_profile=false`. Không có `POSTHOG_KEY` thì không gửi gì tới PostHog.
4. **Cảnh báo (quyết định của Chief, vòng 1, thay cho điều kiện tỉ lệ).** Chỉ **tin chat lỗi** (`ok=false`) được đếm; đếm theo **tin nhắn**, không theo lần thử (một tin lỗi bị thử lại 2 lần vẫn là 1). Dùng **khung cố định 15 phút**, khoá theo `floor(epoch_giây / 900)`. Sau mỗi tin lỗi, nếu (số tin lỗi trong khung hiện tại, tính cả tin này) cộng (số tin lỗi trong khung liền trước) **>= 5**, và chưa có cảnh báo trong 60 phút trước, thì gửi đúng một tin Slack: `POST` tới `env.ADMIN_SLACK_WEBHOOK_URL`, thân `{"text": "<...>"}`, cùng định dạng và kênh của `notifyAdmin`. Tin lỗi cũ hơn hai khung không được tính. Ví dụ bắt buộc: 3 lỗi lúc 03:14 và 3 lỗi lúc 03:16 (UTC) thì cảnh báo ở lỗi thứ 5. `text` có: provider, số tin lỗi đếm được (số nguyên), mã HTTP của lỗi hiện tại nếu biết (vd `402`), và link `ADMIN_APP_URL` nếu có. Không có `ADMIN_SLACK_WEBHOOK_URL` thì không cảnh báo, không gọi đâu khác và không ghi khoá chống lặp. Tỉ lệ lỗi **không** là điều kiện cảnh báo (tin thành công không ghi KV nên không có mẫu số); tỉ lệ vẫn đo được sau này từ `chat_llm_result` (log và PostHog). Trạng thái dùng chung giữa các instance qua KV `RATE_LIMIT` đã có, khoá tiền tố khác `rl:`, mọi lần ghi có TTL (bộ đếm khung ~1800 giây, khoá chống lặp 3600 giây). Không có KV thì bỏ qua cảnh báo (log/PostHog vẫn chạy).
4b. **Hạn mức ghi KV (gói Workers Free, ~1.000 lần ghi/ngày toàn tài khoản, dùng chung với giới hạn tốc độ chat).** Đường sức khoẻ: tin thành công không `put`, không `delete`, không `list` (đọc thì tránh). Mỗi tin lỗi tối đa 1 `put` (bộ đếm), cộng 1 `put` (khoá chống lặp) chỉ khi chính tin đó gửi cảnh báo và Slack trả 2xx (T-228). Không bao giờ `list` hay `delete`. Mọi lỗi KV trong đường này bị nuốt, không đổi phản hồi chat.
5. **Chống lặp.** *(Câu này được `products/T-228-canh-bao-slack-chi-khoa-khi-2xx.md` thay thế một phần: "cảnh báo" chỉ tính là đã gửi và chỉ khoá 60 phút khi Slack trả 2xx.)* Sau một cảnh báo **được Slack nhận (2xx)**, trong 60 phút kế tiếp không có cảnh báo nào nữa dù vẫn đạt ngưỡng. Sau 60 phút, nếu ngưỡng ở mục 4 vẫn đạt (tính lại trên hai khung hiện có) thì nhắc lại một lần, rồi lại chờ 60 phút.
6. **Không làm hỏng chat.** Thiếu `POSTHOG_KEY`, thiếu `ADMIN_SLACK_WEBHOOK_URL`, thiếu hay hỏng KV (mọi thao tác ném lỗi), Slack/PostHog trả 5xx hoặc ném lỗi mạng: tin nhắn chat vẫn trả đúng dãy sự kiện SSE như khi không có tính năng này (cùng thứ tự, HTTP 200), không ném lỗi ra ngoài. Slack, PostHog và mọi thao tác KV của đường sức khoẻ chạy sau, qua `ctx.waitUntil` (hoặc cách tương đương không `await` trước khi gửi sự kiện cuối và đóng luồng). Dù chúng treo hoặc chậm 30 giây, sự kiện cuối (`done` hoặc `error`) và việc đóng luồng SSE tới trong **< 3 giây**.
7. **Chỉ kênh đã duyệt.** Worker chỉ gọi ra: provider LLM (như cũ), webhook Slack admin đã cấu hình, PostHog (chỉ khi có `POSTHOG_KEY`). Không thêm dịch vụ, binding (D1, Queues, Durable Objects, Analytics Engine...) hay thư viện nào.
8. **Không rò dữ liệu.** Không dòng log, sự kiện PostHog hay tin Slack nào chứa: nội dung tin nhắn của cặp đôi, tên/SĐT/email, `userId`, `coupleId`, khoá API, hay thân/thông điệp lỗi nguyên văn của provider (thân lỗi và thông điệp lỗi mạng có thể lặp lại nội dung chat hoặc URL kèm khoá). Chỉ các trường đã liệt kê ở mục 1 đến 4.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-224-tin-hieu-suc-khoe-chat` · Vùng (`area`): `planner/back/chat`
- Bất biến đã đọc: `eval/invariants/_shared/` và `eval/invariants/planner/back/chat/` (inv-001..003 của T-223; inv-004..007 rút từ spec này, ADR-148). Spec này không đổi nhãn lỗi, thử lại hay lượt dùng thử; eval so với số lần gọi thực tế, không với hằng số.
- Kiến trúc: dùng lại `notifyAdmin` (kênh Slack) và KV `RATE_LIMIT`; code chạy được trên Cloudflare Workers (Web API, không Node API).
- Không chạm: logic thử lại, lượt dùng thử (`subscriptionStore`), nhãn lỗi 402/401/403 (T-223); thanh toán, auth, schema DB; không đặt secret hay khoá.
- Secret/cấu hình mới: `POSTHOG_KEY` (và tuỳ chọn `POSTHOG_HOST`) là việc của Capu (`wrangler secret put` hoặc biến dashboard); không đặt vào repo. `ADMIN_SLACK_WEBHOOK_URL` đã có theo thiết kế (Capu đặt).
- Bậc lưới lọc: B (đúng với ADR-145): logic nghiệp vụ trong back, không chạm ranh giới cứng, eval tự động phủ hết tiêu chí. Không chạm tiền, auth, dữ liệu người dùng; chỉ đọc trạng thái KV riêng của tính năng.
- Chạy eval: `TOHONG_BACK_REPO=<đường dẫn checkout nhánh PR của tohong-back> node eval/T-224/check_N.mjs` (không đặt biến thì dùng `../tohong-back` cạnh HQ). Eval chạy offline, mỗi tin nhắn một tiến trình con, fetch giả.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mỗi lần thử provider thất bại (402, 500, 429, lỗi mạng) ở production ghi đúng một dòng JSON `llm_provider_error` với `provider`, `model`, `category`, `http_status`, `attempt`; chat thành công không ghi dòng này | `node eval/T-224/check_1.mjs` |
| 2 | Mỗi tin nhắn chat có đúng một dòng JSON `chat_llm_result` (`ok`, `provider`, `attempts`, `error_category`, `http_status`), kể cả khi không có KV | `node eval/T-224/check_2.mjs` |
| 3 | Có `POSTHOG_KEY`: hai loại sự kiện được gửi ẩn danh tới PostHog (đúng host); không có khoá: 0 request tới PostHog | `node eval/T-224/check_3.mjs` |
| 4 | Cảnh báo Slack khi số tin lỗi (khung hiện tại + khung liền trước, khung cố định 15 phút) >= 5: 4 lỗi không, lỗi thứ 5 có; tin tốt không ảnh hưởng; 3 lỗi 03:14 + 3 lỗi 03:16 có; 5 lỗi cách nhau 20 phút không; lỗi cũ hơn hai khung không tính; 500 và 429 (bị thử lại, 2 lần gọi/tin) vẫn đếm theo tin; nội dung có provider, số 5, mã HTTP | `node eval/T-224/check_4.mjs` |
| 5 | Chống lặp, qua nhiều instance (tiến trình riêng, lỗi 500): 25 lỗi liền chỉ 1 cảnh báo; +20 phút còn trong 60 phút: không thêm; +75 phút vẫn lỗi: nhắc đúng 1 lần | `node eval/T-224/check_5.mjs` |
| 6 | Thiếu khoá/kênh hoặc kênh hỏng (không KV, KV ném lỗi, Slack/PostHog 500 hay ném lỗi, biến rỗng): dãy sự kiện SSE của chat lỗi và chat tốt giữ nguyên | `node eval/T-224/check_6.mjs` |
| 7 | Chỉ gọi ra Gemini, đúng URL webhook đã cấu hình (POST `{"text"}`), `*.posthog.com` khi có khoá; `wrangler.toml` không thêm binding, `package.json` không thêm dependency | `node eval/T-224/check_7.mjs` |
| 8 | Không rò nội dung chat, SĐT, email, tên, userId, coupleId, khoá API ra log, PostHog, Slack, kể cả khi thân lỗi provider và lỗi fetch lặp lại chúng | `node eval/T-224/check_8.mjs` |
| 9 | Hạn mức ghi KV: tin thành công 0 put/list/delete (kể cả khi đang có lỗi và đã cảnh báo); tin lỗi tối đa 1 put (+1 khi gửi cảnh báo), 0 list/delete, mọi put có TTL; không webhook thì không ghi khoá chống lặp | `node eval/T-224/check_9.mjs` |
| 10 | Slack, PostHog hay KV sức khoẻ treo/chậm 30 giây: sự kiện cuối và đóng luồng SSE tới < 3 giây, cả tin lỗi lẫn tin tốt | `node eval/T-224/check_10.mjs` |

Vì sao không có checklist: cả 10 tiêu chí chạy offline bằng fetch giả và KV giả; không cần người kiểm.

Ghi chú về chấp nhận: eval 6, 9, 10 xanh ngay trên main vì chúng là rào chắn chống cài đặt xấu (hồi quy chat, vượt hạn mức KV, chặn SSE), không phải tính năng mới; chúng đỏ trên các cài đặt xấu đã thử (xem handoff v2).

## Bất biến đề xuất (tầng 2)
1. `planner/back/chat`: "Mọi tín hiệu sức khoẻ LLM (log, PostHog, Slack) không chứa nội dung chat, dữ liệu cá nhân, userId/coupleId, khoá API" (chính là `check_8.mjs`; Spec critic rút vào bể, tham số hoá được).
2. `planner/back/chat`: "Hỏng kênh quan sát (Slack, PostHog, KV) không làm đổi dãy sự kiện SSE của chat" (chính là `check_6.mjs`).
3. `planner/back/chat`: "Đường chat không thêm thao tác ghi KV cho tin thành công; tin lỗi tối đa 1 put" (`check_9.mjs`), vì KV gói Free dùng chung với giới hạn tốc độ.
4. `planner/back/chat`: "Slack/PostHog/KV phụ treo 30 giây không làm chậm sự kiện cuối của SSE" (`check_10.mjs`).
Không đề xuất bất biến về ngưỡng 15 phút/5 tin/50%/60 phút: chúng là tham số vận hành, có thể chỉnh.

## Không làm
- Sửa logic thử lại, hoàn lượt dùng thử, đặt nhãn riêng cho 402/401/403 (T-223).
- Provider dự phòng; dashboard/biểu đồ; thông báo "đã khôi phục"; cảnh báo theo email.
- Event nội dung chat/vendor (`chat_vendor_match` tuần 20/11) và phía front; `/api/chat` cũ, summarizer.
- Bật Cloudflare Workers Logs/observability (nếu cần, là quyết định của Capu).
- Chính xác tuyệt đối của bộ đếm: KV Cloudflare nhất quán cuối (có thể trễ ~60 giây giữa các PoP) và đọc-sửa-ghi không nguyên tử, nên có thể mất đếm (cảnh báo trễ) hoặc trùng cảnh báo trong khoảng 60 giây. Chấp nhận được với kênh vận hành; không có eval.
- Điều kiện tỉ lệ lỗi cho cảnh báo (bị bỏ vì không có mẫu số mà không ghi KV cho tin thành công).

## Câu hỏi mở
Production đã đặt `ADMIN_SLACK_WEBHOOK_URL` chưa, và Capu có đặt `POSTHOG_KEY` (kèm bật Cloudflare Workers Logs để đọc dòng log sau này) không? Việc code vẫn ship khi chưa có: khi đó chỉ có dòng log (xem bằng `wrangler tail`) và chưa có cảnh báo/PostHog cho tới khi Capu đặt.
