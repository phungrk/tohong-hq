# Spec T-228: cảnh báo chat chỉ khoá chống lặp khi Slack nhận (2xx)

## Ý định
Capu (ADR-149): chỉ ghi khoá chống lặp khi Slack trả 2xx. Slack lỗi (500/429, treo quá timeout, ném lỗi) thì không ghi khoá; tin lỗi kế tiếp, nếu vẫn đạt ngưỡng ADR-147, gửi lại. Nguồn: ADR-148 (adversary T-227: cảnh báo mất, nhắc kế tiếp chậm tới 60 phút), `eval/T-227/adv-03-bien-khac.mjs` ca b.

## Bằng chứng
- `tohong-back` main 322d855 `lib/chatHealth.js` `countAndMaybeAlert`: `kv.put(LOCK_KEY)` chạy trước `timedFetch(hook)`; `NET_TIMEOUT_MS = 10_000`. adv-03 ca b in "tin lỗi thứ 6 gửi lại cảnh báo? ... (khoá chống lặp đặt trước khi POST)": sau webhook 500/429, tin lỗi thứ 6 không gửi lại.
- Đã dựng lại bằng eval T-228 trên 322d855: Slack 500/429/404/ném lỗi ở tin thứ 5 thì tin thứ 6 gửi 0 POST (cần 1).
- Hệ quả thật: nếu webhook hỏng đúng lúc chat sập thì Capu mất cảnh báo đầu; tự tin cao (đã tái hiện offline).

## Giả thuyết
Nếu khoá chỉ ghi sau 2xx thì thời gian từ lúc đạt ngưỡng tới lúc cảnh báo thật sự tới Slack khi Slack chập chờn giảm từ tới 60 phút xuống một tin lỗi kế tiếp. Chỉ số bảo vệ: SSE của chat không đổi, hạn mức ghi KV (tin thành công 0 put, tin lỗi tối đa 1 put), ngưỡng và nội dung cảnh báo như ADR-147.

## Hành vi (người dùng thấy gì)
Cặp đôi không thấy gì đổi. Phía vận hành, thay cho một phần mục 5 của `products/T-224-tin-hieu-suc-khoe-chat-llm.md`:

1. **Khi nào có POST Slack.** Như cũ (mục 4 spec T-224): sau một tin chat lỗi, nếu số tin lỗi khung 15 phút hiện tại cộng khung liền trước >= 5 và hiện không có khoá chống lặp còn hiệu lực thì POST đúng một lần tới `ADMIN_SLACK_WEBHOOK_URL`. Không thử lại bên trong cùng một tin.
2. **Khoá chống lặp chỉ sau 2xx.** Chỉ khi POST trả HTTP 2xx (200, 204...) mới ghi khoá 60 phút (TTL 3600). Mọi kết cục khác (mã không phải 2xx kể cả 4xx/5xx/429, ném lỗi mạng, hoặc treo tới timeout) tính là chưa gửi: không ghi khoá. Tin lỗi kế tiếp mà ngưỡng còn đạt thì POST lại.
3. **Timeout POST Slack: 10 giây.** POST chạy trong `ctx.waitUntil` và bị huỷ sau 10 giây (chấp nhận 9 đến 10,5 giây); huỷ tính là lỗi theo mục 2. Cặp đôi không phải chờ POST (sự kiện cuối và đóng luồng SSE < 3 giây, như T-224 mục 6).
4. **Hạn mức KV (giữ ADR-147).** Tin thành công: 0 put/list/delete. Tin lỗi: tối đa 1 put (bộ đếm khung). Put thứ hai (khoá) chỉ xảy ra ở đúng tin mà POST trả 2xx; tin có POST thất bại chỉ có put bộ đếm (đúng 1). Không list, không delete, mọi put có TTL.
5. **Slack lỗi kéo dài: chấp nhận, không đặt trần.** Trong lúc Slack lỗi, mỗi tin lỗi đạt ngưỡng POST thêm một lần (một POST mỗi tin, không hơn). Lý do chọn: (a) mọi trần phải nhớ trạng thái "đã thử lúc nào" ở KV (tốn thêm một ghi mỗi tin lỗi, đụng hạn mức Free ~1.000 ghi/ngày dùng chung với rate limit) hoặc ở bộ nhớ instance (không tin cậy được vì mỗi isolate riêng, và còn làm mất lần gửi lại là mục đích của việc này); (b) số POST bị chặn trên bởi số tin chat lỗi, vốn đã bị giới hạn 30 tin/5 phút/người và nhỏ ở quy mô hiện tại; (c) mỗi POST chạy nền, tối đa 10 giây, không ảnh hưởng chat. Giới hạn nêu rõ: bão tối đa bằng số tin lỗi đạt ngưỡng trong lúc Slack hỏng; khi Slack nhận lần đầu thì đúng một cảnh báo tới và im lặng 60 phút.
6. **Hai instance cùng gửi lúc Slack vừa hồi phục: chấp nhận.** Đọc-khoá-POST-ghi khoá không nguyên tử và KV nhất quán cuối (trễ tới ~60 giây giữa các PoP): hai tin lỗi xử lý gần đồng thời đều thấy chưa có khoá, đều POST, có thể trùng cảnh báo. Chặn trên: mỗi tin tối đa 1 POST, và chỉ trong khoảng ~60 giây sau lần 2xx đầu. Chấp nhận được cho kênh vận hành; không có eval (cần song song thật).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-228-khoa-canh-bao-sau-2xx` · Vùng: `planner/back/chat` · Sửa `lib/chatHealth.js` (chỉ thứ tự ghi khoá và điều kiện ghi).
- Bất biến đã đọc và không đổi: `eval/invariants/planner/back/chat/inv-001..007` (inv-004..007 phải vẫn xanh, kiểm bằng check_7). Không bất biến nào cần đổi: inv-006 cho phép tối đa 1 put cộng 1 khi có POST, T-228 chặt hơn (put thứ hai chỉ khi 2xx); inv-007 vẫn đúng. Câu "khoá ghi trước POST" không nằm trong bất biến nào.
- Không chạm: ngưỡng, khung, nội dung cảnh báo, kênh, secret, binding, thử lại chat, lượt dùng thử, `wrangler.toml`, `package.json`.
- Bậc: B (ADR-149): hành vi nội bộ kênh vận hành, không chạm tiền/auth/dữ liệu người dùng.
- Chạy eval: `TOHONG_BACK_REPO=<checkout nhánh PR> node eval/T-228/check_N.mjs`; offline, mỗi tin một tiến trình, fetch giả, KV giả.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Slack 500, 429, 404 hay ném lỗi ở lần gửi đầu: không khoá; tin lỗi kế tiếp POST lại; sau một lần 2xx thì im lặng (kể cả khi Slack lại hỏng); hỏng 3 tin liền rồi hồi phục: POST ở mỗi tin tới khi 2xx | `node eval/T-228/check_1.mjs` |
| 2 | Slack treo: POST bị huỷ sau 9 đến 10,5 giây, không khoá, SSE < 3 giây, tin kế tiếp gửi lại | `node eval/T-228/check_2.mjs` |
| 3 | Slack 200/204: chống lặp 60 phút như cũ, nhắc lại sau 75 phút đúng 1 lần, nội dung cảnh báo không đổi | `node eval/T-228/check_3.mjs` |
| 4 | KV: tin thành công 0 put; tin có POST thất bại đúng 1 put; tin có POST 2xx đúng 2 put; không list/delete; put có TTL | `node eval/T-228/check_4.mjs` |
| 5 | Slack lỗi kéo dài: mỗi tin lỗi đạt ngưỡng tối đa 1 POST và 1 put; hồi phục thì đúng 1 cảnh báo rồi im lặng | `node eval/T-228/check_5.mjs` |
| 6 | Slack lỗi không đổi dãy SSE (chat lỗi, chat tốt), HTTP 200 | `node eval/T-228/check_6.mjs` |
| 7 | inv-004..007 của `planner/back/chat` vẫn xanh | `node eval/T-228/check_7.mjs` |

Không dùng checklist: mọi tiêu chí chạy offline.
Ghi chú chấp nhận: check_3, 6, 7 xanh sẵn trên main (rào chắn hồi quy); 1, 2, 4, 5 đỏ trên main 322d855.

## Bất biến đề xuất (tầng 2)
`planner/back/chat`: "Cảnh báo không được tính là đã gửi (không ghi khoá chống lặp) khi Slack không trả 2xx" (check_1, ca 500/429/ném lỗi). Tham số 60 phút và 10 giây là tham số vận hành, không vào bất biến.

## Không làm
Đổi ngưỡng/khung; kênh mới; secret; trần số POST khi Slack hỏng; chống trùng tuyệt đối giữa instance; thử lại bên trong một tin; thông báo "Slack đã hồi phục".

## Câu hỏi mở
Không.
