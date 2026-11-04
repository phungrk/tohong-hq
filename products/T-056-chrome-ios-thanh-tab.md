# Spec T-056: Thanh tab không bị thanh công cụ Chrome iOS che

## Ý định
Capu (2026-11-04, sau khi tự merge phungrk/tohong-front#59): "Chrome trên iphone ko work. Bottom bar bị che bởi navigation bar." Thanh tab của app phải luôn thấy trọn trên Chrome iPhone, mà Safari và Back/vị trí cuộn của T-054/T-055 giữ nguyên. Ảnh: `eval/T-056/chrome-ios-capu.png`.

## Bằng chứng
- Ảnh Capu: cuộn tới cuối Ngân sách, nội dung kết thúc ngay sát mép trên thanh công cụ dưới của Chrome (← → + 8 …), không thấy thanh tab của app; dưới thanh Chrome còn một dải trắng (vùng thanh Home). Tức thanh tab nằm SAU thanh Chrome. (đọc trực tiếp từ ảnh)
- Mã hiện tại: khối dính `position: sticky; bottom: 0` chứa InstallHint + BottomTabBar (`tohong-front/src/App.jsx:390`, main 442e3f3); `viewport-fit=cover`; khung `min-height: 100dvh`. Trước T-054 khung cao `100dvh` và tự cuộn nên thanh tab nằm trong khung; sau T-054/T-055 document cuộn, `bottom: 0` tính theo viewport bố cục.
- Nguyên nhân (GIẢ ĐỊNH, tự tin ~55%): trên Chrome iOS, vùng bố cục (innerHeight, nơi `bottom: 0` neo vào) kéo dài tới sau thanh công cụ dưới của Chrome, còn `visualViewport` thì chỉ gồm phần nhìn thấy. Tài liệu chưa xác nhận: tra WebSearch (2026-11-04) không có báo lỗi WebKit/Chromium nào nói riêng về Chrome iOS; chỉ có (a) hướng dẫn cộng đồng dùng `innerHeight - visualViewport.height` làm chiều cao thanh công cụ rồi đặt `bottom` theo nó (https://jb-private-dashboard.pages.dev/ios-pwa-tab-bar-guide), (b) báo cáo thanh Chrome mobile che footer cố định mà `dvh`, `viewport-fit=cover`, `env(safe-area-inset-bottom)` đều không cứu hết (https://forum.bricksbuilder.io/t/no-bug-chrome-mobile-url-bar-impacting-sticky-fixed-footer-section/38714), (c) WebKit bug 281071, thanh địa chỉ đè thanh nav cố định, đã không tái hiện ở iOS 18.0.1 (https://bugs.webkit.org/show_bug.cgi?id=281071). Chrome iOS chạy trên WKWebView nên cùng bộ máy với Safari; chỗ khác nhau (thanh Chrome là view riêng của ứng dụng) là suy luận, chưa có nguồn.
- Rủi ro của giả định: nếu Chrome iOS báo `visualViewport.height + offsetTop == innerHeight` mà thanh tab vẫn bị che, cách bù dưới đây không đủ. Phản biện của Spec critic (D1, tự tin ~55-60%): trong WebKit `innerHeight` và `visualViewport.height` cùng tính từ vùng không bị che; nếu Chrome không khai báo thanh công cụ là vùng bị che thì cả hai gồm luôn phần sau thanh, chênh = 0. Nên nhánh chênh = 0 là kết quả thường gặp, không phải ngoại lệ. Spec có tiêu chí 6 (số đo đủ để chọn bước sau) và bảng luật quyết bên dưới để lần thử máy thật đầu tiên của Capu luôn cho ra quyết định.

## Giả thuyết
Nếu bù khoảng dưới của khối dính bằng phần cửa sổ bố cục mà vùng nhìn thấy không có, thì thanh tab thấy trọn trên Chrome iOS. Chỉ số bảo vệ: Safari iOS (không có phần chênh) hành vi không đổi, bằng không.

## Hành vi (người dùng thấy gì)
Gọi: `chênh = max(0, innerHeight − visualViewport.height − visualViewport.offsetTop)`, đo theo từng sự kiện `resize` và `scroll` của visualViewport.
1. Mép dưới của khối dính (thanh tab, và khối gợi ý cài nằm ngay trên nó) cách mép dưới cửa sổ bố cục đúng `chênh` px, tức đáy thanh tab trùng đáy vùng nhìn thấy (`offsetTop + height`), ở đầu, giữa, cuối trang, cả bốn tab và trang con.
2. Khi `chênh` đổi lúc đang xem (thanh Chrome hiện/thu, 83 → 30 → 0 → 83), thanh tab đi theo, không cần cuộn hay chạm.
3. Khi `chênh` bằng 0 (Safari khi không có ô nhập đang focus, desktop, Chrome đã thu hết thanh): thanh tab sát đáy cửa sổ như T-055, không đổi một điểm ảnh. Khi bàn phím ảo mở thì xem hành vi 8.
4. Khi đang zoom (`visualViewport.scale` khác 1): coi `chênh` bằng 0 (zoom làm height nhỏ đi, không phải thanh công cụ).
5. Chênh lệch dưới 1px coi là 0 (tránh rung vì số lẻ 0,5 của iOS).
6. Cờ chẩn đoán: mở địa chỉ có `?vvdebug=1` thì mép trên màn hình (không đè thanh tab) hiện một dòng `nhãn=giá trị` cách nhau bằng khoảng trắng, cập nhật theo sự kiện visualViewport, cuộn, focus: `innerHeight`, `vv.height`, `vv.offsetTop`, `vv.scale`, `100svh`, `100lvh`, `100dvh` (px đo được), `safe-bottom` (px của `env(safe-area-inset-bottom)`), `bù` (px đang áp, theo hành vi 1-5, 8), `dpr`, `scrollY`, `maxScroll`, `tab.top`, `tab.bottom` (hộp bao thanh tab, toạ độ cửa sổ, đo thật), `ua` (đoạn `CriOS/<số>` hoặc `Version/<số>`). Không có cờ thì không hiện gì. Mục đích: một lần Capu chụp đủ để chọn bước sau (xem "Luật quyết").
7. Không đổi: Back/Forward, vị trí cuộn từng trang, khoá cuộn nền khi có lớp mở, header dính, chat, ngăn kéo, ngưỡng ẩn/hiện khối gợi ý 8px (mọi thứ T-054/T-055).
8. Bàn phím ảo (Spec critic D1/B2, Chief of Staff chọn cách b): khi phần tử đang focus là ô nhập chữ (`input` trừ checkbox, radio, button, submit, reset, range, file, color, image), `textarea` hoặc phần tử `contenteditable`, thì `bù` = 0 bất kể `visualViewport` thế nào; thanh tab nằm sát đáy cửa sổ như T-055 (sau bàn phím). Hết focus thì tính lại theo hành vi 1-5. Focus nút hay checkbox thì vẫn bù. Cài đặt phải tính lại khi focus đổi, không chờ sự kiện visualViewport.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-056-chrome-ios-thanh-tab` (commit gắn `[T-056]`) · Vùng: `planner/front/layout`
- Bất biến của vùng đã đọc: `eval/invariants/planner/front/layout/` inv-001..009 và `navigation/`. Spec không vi phạm: inv-008 (thanh tab dính đáy "vùng nhìn thấy": khi `chênh` = 0 giống hệt, kể cả lúc bàn phím mở nhờ hành vi 8). Không đề nghị đổi bất biến nào.
- Không đổi: `nav.js`, `docScroll.js` (nếu cần đọc visualViewport thì viết hook riêng, không sửa logic cuộn), `viewport-fit=cover`, chiều cao khung.
- Không chạm: auth, payment, DB, dữ liệu người dùng.
- Bậc đề xuất: B (UI layout, không chạm ranh giới cứng; eval tự động phủ cơ chế, máy thật chỉ có checklist).

### Cách sửa chọn (Engineering có thể đổi cơ chế, miễn qua eval)
Chọn: bù theo `visualViewport` (hành vi 1-5), đặt thành một biến CSS gốc rồi dùng làm `bottom` của khối dính. Lý do: (a) giữ nguyên mọi thứ Safari khi `chênh` = 0; (b) `100svh`/`dvh` không giúp vì vấn đề là NEO `bottom: 0` của khối sticky, không phải chiều cao khung, và Capu đã thử `min-height: 100dvh` rồi; (c) đổi sticky sang fixed hay thêm `padding-bottom` mất tính chất cuộn cấp trang cần cho Safari (ADR-022); (d) hướng cộng đồng khuyên (nguồn trên). Rủi ro đã nêu ở mục Bằng chứng; bước sau nếu chênh = 0 trên Chrome iOS nằm ở "Luật quyết".

## Tiêu chí chấp nhận và eval
Chạy trong `/home/user/tohong-hq`; `<front>` = `/home/user/tohong-front`. Eval giả lập visualViewport (đối tượng thay `window.visualViewport`, `innerHeight` giữ nguyên), vì Chromium không có thanh Chrome iOS.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Thanh Chrome 83px: đáy thanh tab trùng đáy vùng nhìn thấy ở đầu/giữa/cuối, cả 4 tab (hành vi 1) | `bash eval/T-056/run.sh <front> --only 1` |
| 2 | Thanh Chrome đổi 83→30→0→83 và offsetTop 12: thanh tab đi theo; khi 0 thì sát đáy cửa sổ như T-055 (hành vi 2, 3, 5) | `bash eval/T-056/run.sh <front> --only 2` |
| 3 | Đang zoom: không bù; hết zoom: bù lại (hành vi 4) | `bash eval/T-056/run.sh <front> --only 3` |
| 4 | Thanh Chrome 83px: khối gợi ý nằm trên thanh tab, cả hai trong vùng nhìn thấy; chữ cuối trang ở Kế hoạch, Khách mời không bị che | `bash eval/T-056/run.sh <front> --only 4` |
| 5 | Safari và mọi thứ T-054/T-055 không đổi: eval T-054 (1-8) và toàn bộ bất biến layout/navigation/budget xanh (hành vi 7) | `bash eval/T-056/run.sh <front> --only 5` |
| 6 | `?vvdebug=1` hiện đủ 15 nhãn; số đúng (vv 557/offsetTop 12 → bù 71); `tab.top/bottom`, `scrollY` khớp thật trong 1px; không đè thanh tab; không cờ thì không hiện (hành vi 6) | `bash eval/T-056/run.sh <front> --only 6` |
| 8 | Ô nhập (input chữ, search, textarea, contenteditable) đang focus: thanh tab không bù, kể cả khi vv nhỏ đi 300px; hết focus thì bù lại; focus nút/checkbox vẫn bù; thử với UA Safari và Chrome (hành vi 8) | `bash eval/T-056/run.sh <front> --only 8` |
| 7 | iPhone thật, Chrome iOS và Safari (dòng 0 chụp số đo ở đầu và cuối trang; A1-A9 Chrome; B10-B12 Safari) | `eval/T-056/checklist-iphone.md`: Chromium không có thanh Chrome/Safari iOS, máy thật là nguồn duy nhất |

Chạy tất cả: `bash eval/T-056/run.sh <front>` (check_vv 1,2,3,4,6,8 + T-054). Trước khi viết code, 1-4, 6, 8 ĐỎ (đã chạy trên main 442e3f3: 18 dòng đỏ ở 6 và 8, 21 dòng ở 1-4; 5 là eval cũ). Đã chứng minh eval thoả được: một bản thử ngoài repo (hook ~20 dòng, `bottom: var(--vv-bottom, 0px)`, bù = 0 khi focus ô nhập) cho `check_vv.cjs` PASS toàn bộ (1-4, 6, 8); lần chạy v1 (chưa có hành vi 8) cho `T-054 --only 3` PASS và Spec critic đã chạy đủ T-054 + bất biến xanh trên bản thử v1. Bản thử không phải code giao.

## Luật quyết sau lần thử máy thật (Chief of Staff, D1/B1)
Capu mở `?vvdebug=1`, chụp hai ảnh khi thanh Chrome hiện: một ở đầu trang, một ở cuối Ngân sách (checklist dòng 0; đổi pixel ảnh sang CSS px: `y_css = y_px_ảnh / dpr`; ví dụ ảnh hiện có 1179x2556, dpr 3, mép trên thanh Chrome y_px ~2325, tức ~775 CSS px). Gọi `M` = mép trên thanh Chrome (CSS px) và `d = tab.bottom − M`.
| Số đo | Kết luận | Làm gì |
| --- | --- | --- |
| `bù` > 0 và thanh tab thấy trọn ở cả đầu và cuối trang | đạt | Đóng việc |
| `bù` > 0 mà thanh tab vẫn bị che, thiếu `d` | công thức thiếu | Spec rework với `d` |
| `bù` = 0, `tab.bottom` ≈ `innerHeight` > `M` | Chrome iOS không khai báo thanh công cụ; bản này vô hại nhưng không đủ | Vẫn merge được vì `bù` = 0 thì không đổi gì. Chief of Staff mở việc tiếp, chọn cách theo số đo: `100lvh − 100svh` nếu khác 0, hoặc `safe-bottom`, hoặc nhận diện UA `CriOS` đệm `innerHeight − M`. Nếu là nhận diện UA thì ghi `decisions/` (cấm UA chỉ áp cho việc này). Không tính lỗi Engineering |
| Chỉ che ở cuối trang, đầu trang trọn | nguyên nhân là phạm vi cuộn, không phải chỗ neo | Spec rework |

## Bất biến đề xuất (tầng 2)
1. `layout inv-010` (spec-critic rút vào bể khi spec qua): thanh tab nằm trọn trong vùng nhìn thấy khi `visualViewport` nhỏ hơn `innerHeight`, trừ hai trường hợp: `visualViewport.scale` khác 1 và đang focus ô nhập chữ/textarea/contenteditable. Thân eval = TC1 và TC2 của `check_vv.cjs` (kể cả các dòng chênh = 0), chạy từ bản chụp đặt ở `eval/invariants/planner/front/layout/lib/t056/` (như inv-008 dùng `lib/t054`), không trỏ thẳng `eval/T-056/`; không gồm TC6 (cờ chẩn đoán có thể gỡ). Bật khi lịch sử front có commit `[T-056]`, như inv-007..009 gắn `[T-054]`.
2. Quy tắc quy trình cho mọi việc layout (chạm sticky/fixed/100vh/dvh/safe-area/khung): bàn giao phải có dòng "Chrome iOS: đã thử trên máy thật, có/không" và dùng `eval/T-056/checklist-iphone.md` mục A. Đề xuất thêm một dòng vào `templates/spec.md` mục Ràng buộc và vào `templates/handoff.md`; sửa template phải qua Capu (PR), em không tự sửa.

## Không làm
- Không đổi đệm `env(safe-area-inset-bottom)` của thanh tab: chưa có số đo máy thật (cờ `?vvdebug=1` in `safe-bottom` để quyết sau, xem Luật quyết).
- Không nhận diện UA, không tách mã theo trình duyệt trong việc này. Đây là cấm trong phạm vi T-056, không cấm vĩnh viễn: nếu số đo dẫn tới nhận diện UA thì làm ở việc sau và ghi `decisions/` (Luật quyết).
- Không đổi Safari ngoài hành vi 1-5 và 8 (chênh = 0 thì không đổi).
- Không đưa lại khung con cuộn, không đổi `viewport-fit`.
- Không hỗ trợ Chrome Android (chưa có báo cáo; cơ chế chung có thể giúp nhưng không cam kết, không eval).

## Câu hỏi mở
Không. (Lưu ý cho Capu khi thử lần đầu: mở `?vvdebug=1`, chụp hai ảnh khi thanh Chrome hiện, ở đầu trang và cuối Ngân sách.)
