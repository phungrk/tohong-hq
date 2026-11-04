# Spec T-059: Safari iPhone không tô xám vùng thanh trên khi không có lớp nào mở

## Ý định
Capu (2026-11-04 15:22, `board/T-059.md`): trên Safari iPhone, vùng trên cùng (giờ, sóng, pin) xám nâu dù không lớp nào mở; mong muốn màu giấy của app. Ảnh: `eval/T-059/safari-ios-thanh-tren-xam.png`.

## Bằng chứng
- Ảnh Capu, đo điểm ảnh (600,40) của ảnh gốc 1179x2556: RGB (135,128,121); nền trang (600,400): (251,248,243) = `--paper` #FCF8F3. Dải xám cao ~138 điểm ảnh hiển thị (~ vùng an toàn trên). Thanh tab đúng màu. (đo trực tiếp)
- Mã `tohong-front` origin/main `67a33aa`, quét bằng eval (`bash eval/T-059/run.sh /home/user/tohong-front --only 1`): khi không lớp nào mở, ở cả 4 tab vẫn có phần tử nằm trong cây con của `.ov-fixed` (`position: fixed !important; top: 0`, `src/index.css:725`) phủ toàn vùng nhìn thấy, chạm y=0, nền `rgba(43,36,32,0.38)` (chat AI `AIChatModal.jsx:105-107`, và `Budget.jsx:152-158`, `Timeline.jsx:49/134`, `VendorFlowSheet.jsx:159-160`) và `rgba(43,36,32,0.52)` (Onboarding `Onboarding.jsx:736-737`), chỉ ẩn bằng `opacity: 0`. Có 2 lớp ở Trang chủ/Ngân sách/Khách mời, 4 lớp ở Kế hoạch. `.drawer-scrim` đóng có alpha 0: không phạm. (đo trực tiếp)
- Màu đo được (135,128,121) sẫm hơn một lớp 0.38 trên giấy (173,167,163) và nhạt hơn hai lớp (124,117,113): hợp với việc Safari trộn nhiều lớp, không chứng minh được cách trộn.
- Nguồn ngoài (WebSearch 2026-11-04, toàn bài cộng đồng, không có tài liệu WebKit chính thức): [benfrain.com](https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/) (Safari 26 tô theo `background-color` của phần tử fixed gần mép), [WebKit bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756) (theme-color bị bỏ, màu lấy từ html/body), [bleedblend README](https://github.com/CVERInc/bleedblend) (lấy mẫu cả phần tử không fixed ở mép; tô đúng/sai phụ thuộc opacity, display, độ gần mép). Chưa xác nhận trên iPhone thật.
- `index.html:7` có `theme-color #FCF8F3` nhưng Safari 26 được báo là không dùng. `body` nền `--linen` #F0E6D8 (`index.css:139`), khác giấy; khung `.app-frame` nền giấy. Nếu sau khi sửa dải vẫn không phải giấy thì nghi tiếp `body`/`html` (xem Luật quyết).

## Giả thuyết
Nếu khi đóng, mọi phần tử fixed chạm mép trên không có màu nền thì Safari lấy màu giấy cho vùng trên. Chỉ số bảo vệ: lớp tối, hiệu ứng mở/đóng, Back/cuộn T-054, thanh tab T-056.
Mức tự tin: nguyên nhân là phần tử fixed nền sẫm ở mép trên ~70% (nâng từ 65%: có nguồn cộng đồng và đo được phần tử, nhưng thiếu nguồn chính thức và chưa thử trên máy). Cách sửa này sẽ làm dải đổi màu ~60% lần đầu (còn rủi ro Safari không bỏ qua `opacity`/`visibility` như eval giả định, hay dùng màu `body`).

## Định nghĩa dùng chung
- **Phần tử chạm mép trên**: `getBoundingClientRect()` có `top <= 0.5`, `bottom >= 1`, rộng và cao >= 1px, giao vùng nhìn thấy theo chiều ngang, và `display` khác `none`, `visibility` khác `hidden`/`collapse`. Hộp tính cả `transform`.
- **Phần tử fixed**: chính nó hoặc một tổ tiên có computed `position` là `fixed` hoặc `sticky`. (Nền của phần tử con tuyệt đối bên trong khung fixed cũng là nền ở mép trên; sửa bằng cách đổi cha sang trong suốt không đủ nếu con còn nền.)
- **Nền chấp nhận được**: `background-color` computed có alpha 0, hoặc có rgb đúng (252,248,243) (mọi độ trong; header dính hiện dùng alpha 0.96) , và `background-image` là `none`. `opacity` của phần tử KHÔNG được tính (giả thuyết là Safari bỏ qua nó).
- **Lớp**: như T-054 (chat AI, ngăn kéo, sheet Mời, sheet "Thêm việc", sheet vendor, hộp thoại, Onboarding).
- **Độ đậm lớp tối hiệu dụng**: max trên phần tử fixed có rgb tối (r+g+b < 300) phủ >= 80% vùng nhìn thấy, của alpha nền nhân tích opacity các tổ tiên.

## Hành vi
1. Không lớp nào mở, ở cả bốn tab, đầu trang và giữa trang (trang ngắn không cuộn được thì giữa = đầu): không phần tử fixed nào chạm mép trên có nền khác mục "Nền chấp nhận được".
2. Sau khi mở rồi đóng từng lớp (chat AI, ngăn kéo, sheet Mời, sheet Thêm việc), quay lại đầu và giữa trang: như 1. Đóng xong là phải sạch, kể cả khi hiệu ứng đóng đã xong (eval chờ mọi chuyển động dừng).
3. Khi lớp đang mở: độ đậm lớp tối hiệu dụng >= 0.3 (hiện 0.34-0.38). Trước khi mở và sau khi đóng: < 0.05. Chat AI và ngăn kéo: lúc mở và lúc đóng độ đậm đi qua ít nhất một giá trị trong (0.03; đậm-0.03) (còn mờ dần). Sheet Mời và Thêm việc vốn không mờ dần trên `67a33aa`: không đòi.
4. `src/nav.js` không đổi so với `67a33aa`. Hành vi Back/lớp/vị trí cuộn không đổi (T-054, T-056 vẫn xanh).
5. Safari và Chrome iPhone thật: checklist.

## Hướng sửa gợi ý (không bắt buộc, eval không đo cách làm)
Khi lớp đóng, phần tử nền sẫm không có màu nền hoặc không được vẽ, rồi nền hiện lại khi mở mà vẫn mờ dần (ví dụ nền chỉ đặt khi `open`, với transition của `background-color`; hoặc `visibility: hidden` trễ bằng thời gian chuyển động; hoặc không render lớp khi chưa mở nếu không phá hiệu ứng trượt). Áp cho mọi lớp trong bằng chứng, không chỉ chat AI. `.drawer-scrim` đã làm đúng kiểu này (alpha 0 khi đóng).

## Luật quyết (sau khi Capu thử trên iPhone)
- Dải về màu giấy: xong.
- Dải vẫn xám/khác giấy mà eval xanh: giả thuyết sai ở "Safari bỏ qua opacity" hoặc màu đến từ chỗ khác. Bước kế: đặt `html` nền `--paper` (và `body`, kiểm tác động tới `--linen` hai bên ở màn rộng) rồi thử lại. Việc mới, không tính lỗi spec.

## Ràng buộc
- Repo: `phungrk/tohong-front` · Nhánh `t-059-…` · Vùng `planner/front/layout`.
- Bất biến đã đọc (layout 001-010, navigation 001-007, budget 001-004, `_shared`): không mâu thuẫn. Chạy trên main `67a33aa` bằng `bash eval/T-059/run.sh /home/user/tohong-front --only 7`: xem handoff.
- Không đổi `nav.js`. Không chạm payment, auth, DB, dữ liệu người dùng. Không đổi `theme-color` (vô hại).
- Bậc A: giữ (CSS/JSX nền, eval phủ).

## Tiêu chí chấp nhận và eval
Cách chạy: `cd /home/user/tohong-hq && bash eval/T-059/run.sh /home/user/tohong-front --only N`.
| # | Tiêu chí | Eval |
| --- | --- | --- |
| 1 | Không lớp nào mở, 4 tab, đầu và giữa trang: không nền màu lạ ở mép trên | `--only 1` |
| 2 | Sau mở/đóng từng lớp: như 1 | `--only 2` |
| 3 | Lớp tối còn khi mở; hiệu ứng mờ dần của chat AI, ngăn kéo còn | `--only 3` |
| 4 | `nav.js` không đổi | `--only 4` |
| 5 | Eval T-054 (UI + bất biến) xanh | `--only 5` |
| 6 | Eval T-056 xanh | `--only 6` |
| 7 | Bất biến layout/navigation/budget/_shared xanh | `--only 7` |
| 8 | iPhone Safari + Chrome iOS thật | `eval/T-059/checklist-iphone.md` (Chromium không có màu thanh trạng thái của Safari) |

Không có `--only`: chạy 1-4, rồi T-056 (đã gồm T-054 và bất biến); PASS khi cả ba xanh. Hiện đỏ ở 1 và 2 trên `67a33aa` (đã chạy: TC1 8/8 lần quét đỏ, TC2 đỏ cả bốn lớp; TC3 xanh trừ phần mờ dần của hai sheet, đã bỏ vì không có trên main).

## Bất biến đề xuất (tầng 2)
INV mới cho `planner/front/layout`: khi không lớp nào mở, không phần tử fixed/sticky chạm mép trên có nền khác trong suốt/giấy (cùng phép quét `--only 1` ở một tab, một lần, không cần cuộn). Spec critic rút vào bể nếu spec qua.

## Không làm
Không đổi `nav.js`, thanh tab, header, màu giấy, độ đậm lớp tối, thời gian chuyển động. Không làm sheet Mời/Thêm việc mờ dần.

## Câu hỏi mở
Không.
