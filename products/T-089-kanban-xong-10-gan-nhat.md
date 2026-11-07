# Spec T-089: Cột Xong của Kanban chỉ hiện 10 việc gần nhất, có nút Xem thêm

## Ý định
Capu 2026-11-07: "Kanban · hq hiện tại quá dài. Mong muốn chỉ hiển thị 10 task done gần nhất. Khi cần thì load thêm." Nguồn: `board/T-089.md`.

## Bằng chứng
- `board/*.md` hiện có 86 việc `state: done` (đếm `grep -l "state: done" board/*.md`); cột Xong là cột duy nhất tăng mãi, các cột khác là việc đang chạy. Mã đã đọc ở `origin/main` (fa46026) của `phungrk/tohong-hq-dashboard`: `drawBoard` xếp mỗi cột theo `updated` giảm dần và vẽ hết thẻ, hoà `updated` thì thứ tự không xác định; thẻ Xong ghi `fmtT(updated)` nên "gần nhất" người dùng thấy đã là `updated`; kênh live chỉ vá `updated` bằng `t` của sự kiện (`applyLive`), nên `updated` nhất quán giữa `dashboard.json` và live.
- Không có số liệu người dùng; giả thuyết là GIẢ ĐỊNH, tự tin ~85% (lời Capu rõ).

## Giả thuyết
Nếu cột Xong chỉ hiện 10 thẻ mới nhất thì Kanban ngắn lại (cột Xong từ 86 thẻ còn 10) mà Capu vẫn xem được việc cũ khi bấm. Chỉ số bảo vệ: số đếm tổng không đổi, các cột khác không đổi, Dòng thời gian vẫn mở được việc bất kỳ.

## Hành vi (người dùng thấy gì)

**Định nghĩa**
- *Tập xong* là các việc `state = done` sau khi áp bộ chọn sản phẩm (T-041) và lớp vá live. Lúc này `total` là kích thước tập đó.
- *Thứ tự "gần nhất"*: theo `updated` của việc, **mới nhất trước**. Hai việc có cùng chuỗi `updated` thì việc có **số id lớn hơn** (số sau `T-`) đứng trước. Không dùng thời điểm `accepted` hay trường nào khác (quyết định 1 dưới đây).
- *Giới hạn hiện tại* `limit`: số nguyên, lúc đầu 10. *Thẻ hiện* là `min(total, limit)` việc đầu của thứ tự trên. *Số ẩn* `hidden = total - số thẻ hiện`.

**K1. Mặc định.** Cột Xong hiện tối đa 10 thẻ, đúng 10 việc đầu của thứ tự trên, ở mọi lựa chọn bộ chọn (Tất cả, planner, hq), sắp mới nhất ở trên. `total` ≤ 10 thì hiện hết và không có nút. `total` = 0 thì cột như hiện nay: "Trống", không nút.

**K2. Nút.** Khi `hidden > 0`, ngay dưới thẻ cuối của cột Xong có **đúng một** `button#done-more` với chữ chính xác `Xem thêm · còn N việc`, N = `hidden` (dấu "·" là U+00B7, như các chữ phụ khác của trang). Bấm một lần: `limit` tăng thêm 10, hiện thêm tối đa 10 thẻ kế tiếp theo thứ tự (lần cuối có thể ít hơn 10), các thẻ đã hiện giữ nguyên thứ tự và vị trí. Khi `hidden` về 0 thì nút biến mất; không có nút "Thu gọn". Không có nút nào khác cho cột Xong. Nút **không** mang class `tcard` (không phải thẻ việc). Sau khi bấm, focus bàn phím không rơi về `body`: nếu nút còn thì focus ở lại `#done-more`; nếu nút vừa biến mất thì focus ở thẻ đầu tiên trong số vừa hiện.

**K3. Số đếm và cột khác.** Số ở đầu cột Xong và thẻ KPI `#k-done` luôn là `total` (không phải số thẻ hiện). Sáu cột còn lại (Mới, Đang làm, Chờ review, Rework, Bị chặn, Chờ Capu): thẻ, thứ tự, số đếm không đổi so với trước, **không bị giới hạn**, kể cả khi hơn 10 thẻ. Bộ lọc sản phẩm và mọi thứ ngoài Kanban không đổi.

**K4. Đổi bộ chọn.** Mỗi lần giá trị `#product-filter` đổi, `limit` về 10 (kể cả khi trước đó đã bấm tới 30). Tải lại trang: `limit` = 10, không lưu `limit` ở đâu (không `localStorage`).

**K5. Cập nhật live.** `limit` là một con số, không phải tập thẻ đã hiện; sau mỗi lần vẽ lại bảng (kênh live, làm tươi dữ liệu, đổi cỡ cửa sổ) cột Xong hiện lại `min(total, limit)` việc đầu của thứ tự mới.
- Việc mới xong (live hoặc dữ liệu mới) lên **đầu** cột; thẻ cuối trong số đang hiện bị đẩy xuống phần ẩn, `limit` giữ nguyên (nên vẫn 10 thẻ nếu chưa bấm), số đếm đầu cột +1, N trên nút +1.
- Việc rời khỏi `done` (vd rework): thẻ biến mất, việc ẩn kế tiếp vào thay nếu còn, số đếm -1.
- Đã bấm Xem thêm tới `limit` = 30 thì việc mới xong không làm `limit` đổi (vẫn tối đa 30 thẻ).
- Việc xong thuộc sản phẩm khác bộ chọn hiện tại không thay đổi gì ở cột Xong.
- Không reset `limit` vì bất kỳ lần vẽ lại nào ngoài K4.

**K6. Việc xong đang ẩn và Dòng thời gian.** Thẻ ẩn không có thẻ trên bảng nên không bấm được ở Kanban; nhưng mọi lối vào Dòng thời gian khác (hàng Hoạt động gần đây, hàng Cảnh báo) vẫn mở Dòng thời gian của chính việc đó (`#tl-title` = `Dòng thời gian · T-xxx`, có các dòng sự kiện), **không** tự tăng `limit`, không tự cuộn bảng. Khi việc đó chưa có thẻ, không thẻ nào ở `aria-pressed="true"`. Việc đang được chọn mà bị đẩy ra ẩn (K5) hoặc vốn ẩn thì Dòng thời gian vẫn giữ nó; khi thẻ của nó hiện ra lại (bấm Xem thêm) thì thẻ đó `aria-pressed="true"`. Việc mặc định của Dòng thời gian khi chưa chọn (quy tắc hiện có: cảnh báo đầu tiên, nếu không thì việc `updated` mới nhất) giữ nguyên.

**K7. Điện thoại và máy tính.** `#done-more` là phần tử `button`, nằm trọn trong 0..chiều rộng khung nhìn (390px và 1280px), cao ≥ 40px, rộng ≥ 120px, chữ ≥ 14px không bị cắt, sau khi cuộn tới thì giữa nút không bị phần tử khác che, nằm dưới thẻ cuối của cột (không chồng thẻ), chạm bằng cảm ứng được; trang không cuộn ngang ở 390px, kể cả khi đã hiện hết thẻ.

## Quyết định tự chốt (Spec Writer, đảo ngược được, bậc A)
1. "Gần nhất" = `updated`, không phải thời điểm `accepted`: thẻ vốn hiển thị và sắp theo `updated`, live cũng chỉ vá `updated`; `accepted` cần đọc sự kiện và sẽ cho thứ tự khác chữ giờ trên thẻ. Việc `done` bị sửa tay sau đó (chạm `updated`) có thể nhảy lên đầu: chấp nhận, giống hành vi sắp hiện có.
2. Bước thêm = 10 (bằng giới hạn đầu); chữ nút gồm số còn lại, không ghi "10".
3. Không có "Thu gọn" và không nhớ `limit` qua đổi bộ chọn hay tải lại (Capu không yêu cầu; thêm sau nếu cần).
4. Việc ẩn không bị kéo ra khi bấm từ Feed/Cảnh báo (K6): tránh nhảy bảng bất ngờ.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard`, một file `index.html` (làm trên `origin/main`) · Nhánh: `t-089-kanban-xong-10` · Vùng (`area`): `hq/dashboard`.
- Bất biến đã đọc: `eval/invariants/_shared/` và `eval/invariants/hq/dashboard/inv-001…014` + `model/inv-001…032`. Không vi phạm mô hình (vùng `#model` không đổi; không thêm hoạt ảnh). **Mâu thuẫn một bất biến: xem Câu hỏi mở.** Spec không tự sửa bất biến.
- Kiến trúc: dữ liệu vẫn từ `dashboard.json` và kênh live; không thêm thư viện; không đổi `export_dashboard.py`.
- Không chạm: payment, auth, DB, dữ liệu người dùng, dịch vụ trả phí.
- Bậc lưới lọc: **A** (UI dashboard, eval tự động phủ cả bảy tiêu chí), đúng bậc đã đặt.

## Tiêu chí chấp nhận và eval
Dùng chung `eval/T-089/done-kanban.cjs` (Chromium, d3 cục bộ, dữ liệu và kênh live giả; thư viện `eval/T-076/lib.cjs`). Dữ liệu cố định: 40 việc xong (hq 25 với id lệch thứ tự `updated`, planner 12 gồm 3 việc cùng phút, 3 không sản phẩm), 12 việc đang làm, mỗi cột khác có việc; bộ biên (hq đúng 10, planner 11) và bộ không có việc xong. Kỳ vọng tính bằng công thức K trong chính eval, không đọc code. Mọi tiêu chí chạy ở 1280px và 390px, cuộn vào khung nhìn rồi mới bấm bằng chuột/chạm thật. Đặt `TOHONG_DASHBOARD_REPO` nếu repo dashboard không ở `/home/user/tohong-hq-dashboard`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | K1: tối đa 10 thẻ, đúng 10 việc `updated` mới nhất (hoà: id lớn trước), ở Tất cả/planner/hq; ≤10 thì đủ, không nút; không việc xong thì "Trống" | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 1` |
| 2 | K2: nút `Xem thêm · còn N việc`, mỗi bấm +10 thẻ kế tiếp, lần cuối ít hơn, hết thì nút mất, focus đúng | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 2` |
| 3 | K3: số đầu cột Xong và `#k-done` là tổng; sáu cột khác đủ thẻ và đếm đúng, trước và sau khi bấm | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 3` |
| 4 | K4: đổi bộ chọn về 10 thẻ; tải lại về 10 | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 4` |
| 5 | K5: live: việc mới xong lên đầu đẩy thẻ cũ ra, `limit` giữ, việc rời Xong kéo thẻ ẩn vào, lọc sản phẩm, vẽ lại không reset | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 5` |
| 6 | K6: mở việc ẩn từ Feed vẫn có Dòng thời gian, không tự mở rộng cột; chọn rồi bị ẩn vẫn giữ | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 6` |
| 7 | K7: nút dùng được ở 390px (và 1280px), không cuộn ngang. Bất biến `hq/dashboard` (gồm `model/`) xanh do Code Gate tầng 2 chạy | `cd /home/user/tohong-hq && bash eval/T-089/run.sh 7` |

Đã tự kiểm: trên `origin/main` hiện tại 1, 2, 4, 5, 6, 7 đỏ (3 xanh vì là eval bảo vệ "không đổi", chạy được sau khi cài); trên bản thử nhanh ngoài repo (scratchpad, đúng spec) cả 7 xanh và các bất biến `inv-001`, `inv-003`, `inv-007` xanh. Một đường mòn tự thấy khi thử: nút mang class `tcard` bị đếm là thẻ, nên K2 cấm.

## Bất biến đề xuất (tầng 2), vùng `hq/dashboard`
1. **"Cột Xong ngắn, số đếm là tổng"**: với mọi bộ dữ liệu, cột Xong có `min(total, limit)` thẻ (limit mặc định 10) và số đầu cột = tổng việc xong của bộ chọn; việc xong đứng trên bảng luôn là những việc `updated` mới nhất. Nguồn: tiêu chí 1, 3.
2. **"Việc ẩn vẫn tới được"**: mọi việc, kể cả việc xong đang ẩn, mở được Dòng thời gian qua Feed hoặc Cảnh báo. Nguồn: tiêu chí 6.

## Không làm
- Không thêm nút Thu gọn, không nhớ `limit`, không phân trang theo tuần, không tìm kiếm trong cột Xong.
- Không đổi `export_dashboard.py`, `dashboard.json`, mô hình `#model`, bộ chọn sản phẩm.
- Không giới hạn các cột khác.

## Câu hỏi mở
`eval/invariants/hq/dashboard/inv-001-tat-ca-luon-du.sh` (INV-P1 của T-041) viết "mọi việc ở bảy cột của `dashboard.json` có thẻ trên bảng", mâu thuẫn chữ với K1 khi `total` > 10 (sổ cái hôm nay có 86 việc xong). Eval của inv-001 hiện vẫn xanh vì fixture của nó chỉ có 2 việc xong, nên Code Gate không đỏ, nhưng câu bất biến sẽ sai. Đề xuất cho Chief of Staff phân xử và ghi `decisions/`: sửa lời INV-P1 thành "mọi việc ở sáu cột đầu có thẻ; riêng cột Xong có thẻ cho `min(total, limit)` việc `updated` mới nhất, số đếm là tổng; bộ chọn quyết tập việc theo `product`", và thêm một ca fixture >10 việc xong vào `lib/loc_inv.cjs` để bất biến thật sự phủ. Spec này không sửa bất biến nào.
