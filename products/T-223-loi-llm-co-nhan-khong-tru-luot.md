# Spec T-223: Lỗi thanh toán/khoá của provider LLM có nhãn riêng, không thử lại, không trừ lượt dùng thử

## Ý định
Capu (ADR-145, ống hồi `insights/2026-11-23-su-co-gemini-402.md`): khi nhà cung cấp LLM trả 402/401/403 thì gắn nhãn riêng và không gọi lại; tin nhắn mà LLM lỗi thì không trừ lượt dùng thử; cặp đôi thấy thông điệp rõ ràng, không lộ chi tiết kỹ thuật.

## Bằng chứng
- Code `tohong-back` origin/main ad873eb (đọc bằng `git show`): `providers/base.js` `_categorizeError` gán 402 là `unknown`; `unknown` có `shouldFallback=true` nên `lib/orchestrator.js` thử lại (PROVIDER_RETRIES=1, mỗi tin nhắn 2 request); `api/coupleChat.js` gọi `checkAndGate` (tăng `trial_messages_used`) trước LLM và không hoàn lại. Đã dựng lại bằng eval offline: c1, c3, c4 đỏ trên main.
- Gemini trả 402 gần như mỗi ngày 03/11..22/11: từ ảnh Capu gửi, tự tin ~90% (insight). Chat production có hỏng thật không: chưa kiểm được, tự tin ~60%.
- Số cặp đôi bị trừ lượt oan: GIẢ ĐỊNH, không đo được (PostHog 0 sự kiện chat).

## Giả thuyết
Nếu làm đúng thì mỗi tin nhắn lỗi 402 chỉ tốn 1 request thay vì 2, cặp đôi dùng thử không mất lượt oan, và T-224 có nhãn lỗi để cảnh báo. Chỉ số bảo vệ: lỗi tạm thời (429, 5xx, mạng, timeout) vẫn được thử lại như cũ; người trả phí và cổng hết lượt không đổi.

## Hành vi (người dùng thấy gì)
Định nghĩa. "Đã trả nội dung" = có ít nhất một ký tự không phải khoảng trắng của AI đã tới cặp đôi (không tính khối debug của `DEBUG_MATCHING`), HOẶC ít nhất một hành động (action) do AI sinh ra đã chạy và gửi sự kiện `action`. Chunk chỉ có khoảng trắng không phải nội dung. "Lỗi trước nội dung" = lỗi mà tới lúc đó chưa "đã trả nội dung". "Tin được cổng tính lượt" = tin mà `checkAndGate` đã tăng `trial_messages_used` (người có gói đang hiệu lực lúc cổng thì không được tính lượt).

1. **Nhãn.** Nhãn tính theo mã HTTP mà Worker nhận được, kể cả khi mọi cú gọi đi qua `LLM_RELAY_URL` (production luôn qua relay; relay chuyển nguyên mã của provider, tự trả 403 khi sai bí mật và 502 khi không gọi được provider; hai mã sau được gán nhãn theo đúng quy tắc này, không ngoại lệ). 402 -> `billing`; 401 và 403 -> `auth`.
2. **Không thử lại.** Với `billing` và `auth`, provider bị gọi đúng 1 lần cho mỗi tin nhắn, bất kể `PROVIDER_RETRIES`. Chuỗi provider dừng ngay (hành vi hiện có của `auth`, mở rộng cho `billing`); provider dự phòng không thuộc spec này.
3. **Điểm nối cho T-224 (chỉ phía server).** MỌI sự kiện `error` của orchestrator có `category` ở mức ngoài, theo bảng: `billing` (402), `auth` (401/403), `rate_limit` (429), `server` (5xx), `invalid_input` (400/422), `timeout`, `network` (fetch không nhận được phản hồi HTTP), `unknown` (mã khác), `mid_stream` (đứt sau khi AI đã bắt đầu trả, kể cả chỉ khoảng trắng). Khi chuỗi hết lần thử, `category` là nhãn của lần lỗi cuối. `errors[]` giữ nguyên nhãn cũ (`server_error`, `unknown` cho mạng…); sự kiện `mid_stream` không có `errors[]`. Với `billing`/`auth`: `recoverable:false`. Luồng SSE gửi cặp đôi KHÔNG mang `category`, `errors` hay `mid_stream`: chỉ có `message` và `recoverable`. T-223 không định nghĩa event analytics, không ghi log mới.
4. **Thông điệp cho cặp đôi.** Với `billing`/`auth`, luồng SSE gửi đúng một sự kiện `error` có đúng hai trường:
   - `message` nguyên văn: `Tơ Hồng chưa trả lời được lúc này, lỗi nằm ở phía chúng mình chứ không phải do bạn. Tin nhắn này không bị tính vào lượt dùng của bạn. Bạn vui lòng quay lại sau nhé.`
   - `recoverable: false`. Không có `chunk`, `meta`, `done` sau đó.
   - Không chỗ nào trong luồng chứa mã HTTP, tên nhà cung cấp, từ "billing/payment/quota/API key/provider/token/relay", khoá, URL/bí mật relay, hay nội dung thân phản hồi.
   Lỗi tạm thời giữ thông điệp cũ `Tơ Hồng đang gặp lỗi kết nối tạm thời. Vui lòng thử lại sau một chút.` với `recoverable: true`. Lỗi đứt giữa chừng (`mid_stream`, kể cả khi chưa có nội dung) dùng thông điệp mới `Kết nối AI bị gián đoạn giữa chừng. Bạn có thể gửi lại tin nhắn để Tơ Hồng trả lời lại.` với `recoverable: true` (bỏ chữ "phần trả lời đầy đủ" vì có thể chưa có phần nào).
5. **Lỗi tạm thời giữ nguyên.** 429, 5xx, lỗi mạng, timeout, mã lạ: thử lại tổng 1 + `PROVIDER_RETRIES` lần, `errors[]` như cũ, hết lần thì `recoverable: true`. 429 không phải lỗi thanh toán.
6. **Hoàn lượt.** Chỉ tin được cổng tính lượt mới được hoàn. Khi tin đó kết thúc bằng lỗi trước nội dung (mọi loại: 402/401/403/429 hết lần thử/400/5xx/mạng/timeout/200 rồi đứt trước chữ đầu/chỉ khoảng trắng rồi đứt), hoàn lượt = **trừ đúng 1 khỏi giá trị `trial_messages_used` hiện tại**, bằng ghi có điều kiện (`ifMatch`), xung đột thì đọc lại và thử lại (tối đa số lần của `incrementTrial` hiện có). Không ghi lại một số tuyệt đối, không bỏ hoàn vì bộ đếm đã bị tin khác đổi, không xuống dưới 0, không phụ thuộc gói: nếu gói được kích hoạt giữa lúc trừ và lúc hoàn thì vẫn trừ 1 khỏi bộ đếm thử (vô hại với người trả phí) và gói giữ nguyên. Việc hoàn xong **trước khi** sự kiện `error` được gửi. Ví dụ: 1/3, tin A lỗi 402 và tin B thành công chạy đồng thời -> sau cùng 2/3; 2/3, tin thứ 3 lỗi 402 -> vẫn 2/3, gửi lại thành công -> 3/3.
7. **Không hoàn khi đã trả nội dung.** Lỗi sau khi đã trả nội dung (kể cả chỉ có khối action đã chạy rồi mới đứt): không thử lại, không hoàn lượt, thông điệp `mid_stream` ở hành vi 4. Tin nhắn thành công trừ đúng 1 lượt.
8. **Người trả phí và cổng.** Gói đang hiệu lực: bộ đếm không đổi dù thành công hay lỗi (kể cả khi bộ đếm cũ còn > 0), gói không đổi. Hết lượt dùng thử (kể cả sau gia hạn): HTTP 402 `subscription_required`, không gọi LLM, bộ đếm không đổi.
9. **Hoàn lượt tự lỗi.** Nếu ghi kho khi hoàn thất bại (kể cả lỗi không phải 412): cặp đôi vẫn nhận đúng một sự kiện `error` với thông điệp như trên; lỗi hoàn lượt chỉ ghi phía server (`console.error`), không vào luồng SSE.

## Ràng buộc (vòi)
- Repo: `tohong-back` · Nhánh: `t-223-loi-llm-nhan-rieng` · Vùng: `planner/back/chat`
- Bất biến đã đọc: `_shared/`, `planner/back/chat/inv-001` (spec làm nó xanh; nhãn `billing` nằm trong tập nó chấp nhận). Không mâu thuẫn bất biến nào.
- Chạm tới: `providers/base.js`, `lib/orchestrator.js` (thêm `category` cho mọi sự kiện error), `api/coupleChat.js`, `lib/subscriptionStore.js`. Hoàn lượt dùng cùng cơ chế ghi có điều kiện (`ifMatch`) như `incrementTrial`, để không ghi đè một lần kích hoạt gói chen giữa.
- Không chạm: `/api/chat` cũ, summarizer/briefing, secret/khoá, `wrangler.toml`, front, provider dự phòng.
- Bậc đề xuất: **C** (đổi bộ đếm lượt dùng của người dùng, đường tới paywall).

## Tiêu chí chấp nhận và eval
Chạy: `TOHONG_BACK_REPO=<repo back đã checkout nhánh> node <file>`; offline hoàn toàn (fetch giả, khoá giả, kho R2 giả, kể cả relay giả). `eval/T-223/_harness.mjs` là khung dùng chung, không phải eval.

| # | Tiêu chí (có/không) | Eval | Trên main ad873eb |
| --- | --- | --- | --- |
| 1 | 402 -> `billing`, 401/403 -> `auth`, `recoverable:false`, 1 lần gọi (hành vi 1-2) | `eval/T-223/c1-nhan-rieng-va-khong-thu-lai.mjs` | ĐỎ |
| 2 | Lỗi tạm thời vẫn thử lại, `errors[]` và `recoverable` như cũ; RETRIES=0 được tôn trọng (hành vi 5) | `eval/T-223/c2-loi-tam-thoi-van-thu-lai.mjs` | xanh (chốt chặn) |
| 3 | Thông điệp 402/401/403 đúng nguyên văn, không lộ kỹ thuật; lỗi tạm thời giữ thông điệp cũ (hành vi 4) | `eval/T-223/c3-thong-diep-cho-cap-doi.mjs` | ĐỎ |
| 4 | Lỗi trước nội dung (9 loại) hoàn lượt trước khi tới `error`; gửi lại được (hành vi 6) | `eval/T-223/c4-hoan-luot-khi-loi-truoc-noi-dung.mjs` | ĐỎ |
| 5 | Thành công trừ 1; đứt sau chữ không thử lại, không hoàn, thông điệp gián đoạn mới (hành vi 7) | `eval/T-223/c5-khong-hoan-khi-da-tra-noi-dung.mjs` | ĐỎ (thông điệp) |
| 6 | Trả phí không đổi bộ đếm; hết lượt -> 402, 0 gọi LLM (hành vi 8) | `eval/T-223/c6-goi-tra-phi-va-het-luot.mjs` | xanh (chốt chặn) |
| 7 | Hoàn lượt = trừ 1 khỏi giá trị hiện tại: đồng thời 1/3 -> 2; hai tin cùng lỗi -> 1; gói kích hoạt chen giữa; không âm (hành vi 6) | `eval/T-223/c7-hoan-luot-dong-thoi.mjs` | ĐỎ |
| 8 | Hoàn lượt tự lỗi: vẫn đúng 1 `error` đúng thông điệp, không lộ (hành vi 9) | `eval/T-223/c8-hoan-luot-tu-loi.mjs` | ĐỎ |
| 9 | Chỉ khoảng trắng rồi đứt -> hoàn; chỉ khối action rồi đứt -> không hoàn; thông điệp gián đoạn mới (định nghĩa, hành vi 7) | `eval/T-223/c9-dinh-nghia-da-tra-noi-dung.mjs` | ĐỎ |
| 10 | Mọi `error` của orchestrator có `category` theo bảng; SSE cặp đôi không mang nó (hành vi 3) | `eval/T-223/c10-category-moi-su-kien-error.mjs` | ĐỎ |
| 11 | Qua `LLM_RELAY_URL`: 402/403 -> không thử lại, hoàn lượt, đúng thông điệp; 502 thử lại; không lộ relay (hành vi 1) | `eval/T-223/c11-qua-relay.mjs` | ĐỎ |

Bất biến `inv-001` (tầng 2) cũng phải xanh.

Kiểm chứng (bản v2): trên main ad873eb c1, c3, c4, c5, c7, c8, c9, c10, c11 đỏ; c2, c6 xanh (chốt chặn). Trên bản vá tham chiếu viết ngoài repo (đã xoá) cả 11 xanh. Đột biến, mỗi cái làm đỏ đúng eval nhắm tới: ghi lại số tuyệt đối "trước tin nhắn" -> c7 đỏ; chỉ hoàn khi bộ đếm chưa đổi -> c7 đỏ; bỏ bắt lỗi quanh hoàn -> c8 đỏ; hoàn cả người trả phí -> c6 đỏ; khoảng trắng tính là chữ -> c9 đỏ; action không tính là nội dung -> c9 đỏ; `category` chỉ có ở billing/auth -> c10 đỏ; hoàn sau khi gửi error -> c4 và c9 đỏ.

## Bất biến đề xuất (tầng 2)
1. `planner/back/chat`: tin nhắn kết thúc bằng lỗi trước nội dung không làm tăng `trial_messages_used` (bản rút gọn của c4, chạy cho mọi việc chạm chat).
2. `planner/back/chat`: luồng SSE của chat không chứa mã HTTP hay tên nhà cung cấp LLM (bản rút gọn của c3).

## Không làm
Provider dự phòng; tín hiệu sức khoẻ, cảnh báo, event analytics (T-224); đổi khoá/secret/`wrangler.toml`; sửa nội dung `meta` thành công (đang lộ tên provider; không thuộc việc này); xoá tin nhắn người dùng đã lưu khi LLM lỗi (hiện gửi lại sẽ lưu trùng, không đổi); đổi hành vi của relay.

## Đã sửa ở v2 (spec rework theo T-223-D1)
- Hành vi 6 cũ "về đúng số trước tin nhắn" có ba cách hiểu khi đồng thời; nay là "trừ đúng 1 khỏi giá trị hiện tại" (+ c7). Hành vi 9 thiếu eval (+ c8). Định nghĩa "chữ" mơ hồ với khoảng trắng và khối action (+ c9, thông điệp gián đoạn mới). `category` chỉ có ở billing/auth (nay mọi sự kiện, + c10). Relay chưa được phủ (+ c11).

## Câu hỏi mở
Khi sau này có provider dự phòng, 402/401/403 ở provider chính nên chuyển sang provider kế hay dừng chuỗi? Spec giữ hành vi hiện có của `auth` (dừng chuỗi) và không chặn việc nào; chỉ cần Capu quyết khi làm đề xuất 3 của ADR-145.
