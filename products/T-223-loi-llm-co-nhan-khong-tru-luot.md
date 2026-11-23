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
Định nghĩa. "Chữ của AI đã tới cặp đôi" = đã gửi ít nhất một sự kiện `chunk` mang nội dung do LLM sinh ra (không tính khối debug của `DEBUG_MATCHING`). "Lỗi trước nội dung" = lỗi mà tới lúc đó chưa có chữ của AI nào.

1. **Nhãn.** Provider trả HTTP 402 thì lỗi mang nhãn `billing`. 401 và 403 mang nhãn `auth` (như cũ). Cả hai không phải `unknown`, `server_error` hay `timeout`.
2. **Không thử lại.** Với `billing` và `auth`, provider bị gọi đúng 1 lần cho mỗi tin nhắn, bất kể `PROVIDER_RETRIES`. Chuỗi provider dừng ngay (hành vi hiện có của `auth`, mở rộng cho `billing`); việc chuyển sang provider dự phòng không thuộc spec này.
3. **Điểm nối cho T-224.** Sự kiện `error` của orchestrator, với `billing`/`auth`, có `category` ở mức ngoài (`"billing"` hoặc `"auth"`), `errors[0].category` cùng giá trị, và `recoverable: false`. T-223 không định nghĩa event analytics, không ghi log mới; T-224 đọc các trường này.
4. **Thông điệp cho cặp đôi.** Với `billing`/`auth`, luồng SSE của chat gửi đúng một sự kiện `error` có đúng hai trường `message` và `recoverable`:
   - `message` nguyên văn: `Tơ Hồng chưa trả lời được lúc này, lỗi nằm ở phía chúng mình chứ không phải do bạn. Tin nhắn này không bị tính vào lượt dùng của bạn. Bạn vui lòng quay lại sau nhé.`
   - `recoverable: false`. Không có `chunk`, `meta`, `done` sau đó.
   - Không chỗ nào trong luồng chứa mã HTTP, tên nhà cung cấp, từ "billing/payment/quota/API key/provider/token/relay", khoá, hay nội dung thân phản hồi của provider.
   Lỗi tạm thời giữ thông điệp cũ: `Tơ Hồng đang gặp lỗi kết nối tạm thời. Vui lòng thử lại sau một chút.` với `recoverable: true`.
5. **Lỗi tạm thời giữ nguyên.** 429, 5xx, lỗi mạng, timeout: thử lại tổng 1 + `PROVIDER_RETRIES` lần, nhãn lần lượt `rate_limit`, `server_error`, `unknown`, `timeout`; hết lần thì `recoverable: true`. 429 không được coi là lỗi thanh toán.
6. **Hoàn lượt.** Cặp đôi đang dùng thử, tin nhắn kết thúc bằng lỗi trước nội dung (mọi loại: 402/401/403/429 hết lần thử/400/5xx/mạng/timeout/200 rồi đứt trước chữ đầu) thì `trial_messages_used` về đúng số trước tin nhắn đó. Việc hoàn lượt xong **trước khi** sự kiện `error` được gửi, để bấm gửi lại ngay không bị cổng `subscription_required` chặn. Ví dụ: 2/3 lượt, tin nhắn thứ 3 lỗi 402 -> vẫn 2/3, gửi lại thành công -> 3/3.
7. **Không hoàn khi đã trả nội dung.** Lỗi sau khi chữ của AI đã tới cặp đôi (stream đứt giữa chừng): không thử lại, không hoàn lượt (cặp đôi đã nhận một phần giá trị), thông điệp cũ `Kết nối AI bị gián đoạn. Bạn có thể thử lại để nhận phần trả lời đầy đủ.`, phần chữ đã lưu như cũ. Tin nhắn thành công trừ đúng 1 lượt.
8. **Người trả phí và cổng.** Gói đang hiệu lực: bộ đếm `trial_messages_used` không đổi dù thành công hay lỗi (kể cả khi bộ đếm cũ còn > 0), gói không đổi. Hết lượt dùng thử (kể cả sau gia hạn): HTTP 402 `subscription_required`, không gọi LLM, bộ đếm không đổi. Bộ đếm không bao giờ âm.
9. Nếu việc hoàn lượt tự nó lỗi (ghi kho thất bại): cặp đôi vẫn nhận sự kiện `error` đúng như trên, không có lỗi thứ hai.

## Ràng buộc (vòi)
- Repo: `tohong-back` · Nhánh: `t-223-loi-llm-nhan-rieng` · Vùng: `planner/back/chat`
- Bất biến đã đọc: `_shared/`, `planner/back/chat/inv-001` (spec làm nó xanh; nhãn `billing` nằm trong tập nó chấp nhận). Không mâu thuẫn bất biến nào.
- Chạm tới: `providers/base.js`, `lib/orchestrator.js` (nếu cần), `api/coupleChat.js`, `lib/subscriptionStore.js`. Hoàn lượt dùng cùng cơ chế ghi có điều kiện (`ifMatch`) như `incrementTrial`, để không ghi đè một lần kích hoạt gói chen giữa.
- Không chạm: `/api/chat` cũ, summarizer/briefing, secret/khoá, `wrangler.toml`, front, provider dự phòng.
- Bậc đề xuất: **C** (đổi bộ đếm lượt dùng của người dùng, đường tới paywall).

## Tiêu chí chấp nhận và eval
Chạy: `TOHONG_BACK_REPO=<repo back đã checkout nhánh> node <file>`; offline hoàn toàn (fetch giả, khoá giả, kho R2 giả). `eval/T-223/_harness.mjs` là khung dùng chung, không phải eval.

| # | Tiêu chí (có/không) | Eval | Trên main ad873eb |
| --- | --- | --- | --- |
| 1 | 402 -> `billing`, 401/403 -> `auth`, `recoverable:false`, 1 lần gọi, `category` ở sự kiện lỗi (hành vi 1-3) | `eval/T-223/c1-nhan-rieng-va-khong-thu-lai.mjs` | ĐỎ |
| 2 | 429/5xx/mạng/timeout vẫn thử lại, nhãn và `recoverable` như cũ; RETRIES=0 được tôn trọng (hành vi 5) | `eval/T-223/c2-loi-tam-thoi-van-thu-lai.mjs` | xanh (chốt chặn hồi quy) |
| 3 | Thông điệp 402/401/403 đúng nguyên văn, không lộ kỹ thuật; lỗi tạm thời giữ thông điệp cũ (hành vi 4) | `eval/T-223/c3-thong-diep-cho-cap-doi.mjs` | ĐỎ |
| 4 | Lỗi trước nội dung (9 loại, kèm DEBUG_MATCHING, kèm tin cuối) hoàn lượt trước khi tới `error`; gửi lại được (hành vi 6) | `eval/T-223/c4-hoan-luot-khi-loi-truoc-noi-dung.mjs` | ĐỎ |
| 5 | Thành công trừ 1; đứt giữa chừng không thử lại, không hoàn, thông điệp cũ (hành vi 7) | `eval/T-223/c5-khong-hoan-khi-da-tra-noi-dung.mjs` | xanh (chốt chặn hồi quy) |
| 6 | Trả phí không đổi bộ đếm; hết lượt -> 402, 0 gọi LLM, bộ đếm giữ (hành vi 8) | `eval/T-223/c6-goi-tra-phi-va-het-luot.mjs` | xanh (chốt chặn hồi quy) |

Hành vi 9 (hoàn lượt tự lỗi) chưa có eval: máy chưa dựng được lỗi ghi kho đúng chỗ mà không nhắc cách cài đặt; để adversary thêm eval tầng 3 nếu thấy cần. Bất biến `inv-001` (tầng 2) cũng phải xanh.

Kiểm chứng eval: trên main c1, c3, c4 đỏ (4, 4, 23 điều kiện hỏng), c2, c5, c6 xanh; trên bản vá tham chiếu viết ngoài repo (4 thay đổi nhỏ: nhãn 402; `refundTrial`; hoàn trong `coupleChat` trước khi gửi `error`; thông điệp và `recoverable:false` cho `billing`/`auth`) cả 6 xanh, `inv-001` xanh, `test_fallback`, `test_admin`, `test_backend_routes` 38/38 xanh; bản vá đã xoá. Bản đột biến "hoàn sau khi gửi error" làm c4 đỏ 23 điều kiện; "hoàn cả khi đã có chữ" làm c5 đỏ.

## Bất biến đề xuất (tầng 2)
1. `planner/back/chat`: tin nhắn kết thúc bằng lỗi trước nội dung không làm tăng `trial_messages_used` (bản rút gọn của c4, chạy cho mọi việc chạm chat).
2. `planner/back/chat`: luồng SSE của chat không chứa mã HTTP hay tên nhà cung cấp LLM (bản rút gọn của c3).

## Không làm
Provider dự phòng; tín hiệu sức khoẻ, cảnh báo, event analytics (T-224); đổi khoá/secret/`wrangler.toml`; sửa nội dung `meta` thành công (đang lộ tên provider; không thuộc việc này); xoá tin nhắn người dùng đã lưu khi LLM lỗi (hiện gửi lại sẽ lưu trùng, không đổi); đổi hành vi của relay.

## Câu hỏi mở
Khi sau này có provider dự phòng, 402/401/403 ở provider chính nên chuyển sang provider kế hay dừng chuỗi? Spec giữ hành vi hiện có của `auth` (dừng chuỗi) và không chặn việc nào; chỉ cần Capu quyết khi làm đề xuất 3 của ADR-145.
