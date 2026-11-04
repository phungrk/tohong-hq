# Spec T-056: Thanh tab không bị thanh công cụ Chrome iOS che

## Ý định
Capu (2026-11-04, sau khi tự merge phungrk/tohong-front#59): "Chrome trên iphone ko work. Bottom bar bị che bởi navigation bar." Thanh tab của app phải luôn thấy trọn trên Chrome iPhone, mà Safari và Back/vị trí cuộn của T-054/T-055 giữ nguyên. Ảnh: `eval/T-056/chrome-ios-capu.png`.

## Bằng chứng
- Ảnh Capu: cuộn tới cuối Ngân sách, nội dung kết thúc ngay sát mép trên thanh công cụ dưới của Chrome (← → + 8 …), không thấy thanh tab của app; dưới thanh Chrome còn một dải trắng (vùng thanh Home). Tức thanh tab nằm SAU thanh Chrome. (đọc trực tiếp từ ảnh)
- Mã hiện tại: khối dính `position: sticky; bottom: 0` chứa InstallHint + BottomTabBar (`tohong-front/src/App.jsx:390`, main 442e3f3); `viewport-fit=cover`; khung `min-height: 100dvh`. Trước T-054 khung cao `100dvh` và tự cuộn nên thanh tab nằm trong khung; sau T-054/T-055 document cuộn, `bottom: 0` tính theo viewport bố cục.
- Nguyên nhân (GIẢ ĐỊNH, tự tin ~55%): trên Chrome iOS, vùng bố cục (innerHeight, nơi `bottom: 0` neo vào) kéo dài tới sau thanh công cụ dưới của Chrome, còn `visualViewport` thì chỉ gồm phần nhìn thấy. Tài liệu chưa xác nhận: tra WebSearch (2026-11-04) không có báo lỗi WebKit/Chromium nào nói riêng về Chrome iOS; chỉ có (a) hướng dẫn cộng đồng dùng `innerHeight - visualViewport.height` làm chiều cao thanh công cụ rồi đặt `bottom` theo nó (https://jb-private-dashboard.pages.dev/ios-pwa-tab-bar-guide), (b) báo cáo thanh Chrome mobile che footer cố định mà `dvh`, `viewport-fit=cover`, `env(safe-area-inset-bottom)` đều không cứu hết (https://forum.bricksbuilder.io/t/no-bug-chrome-mobile-url-bar-impacting-sticky-fixed-footer-section/38714), (c) WebKit bug 281071, thanh địa chỉ đè thanh nav cố định, đã không tái hiện ở iOS 18.0.1 (https://bugs.webkit.org/show_bug.cgi?id=281071). Chrome iOS chạy trên WKWebView nên cùng bộ máy với Safari; chỗ khác nhau (thanh Chrome là view riêng của ứng dụng) là suy luận, chưa có nguồn.
- Rủi ro của giả định: nếu Chrome iOS báo `visualViewport.height + offsetTop == innerHeight` mà thanh tab vẫn bị che, cách bù dưới đây không đủ. Vì vậy có tiêu chí 6 (số đo trên máy thật) để lần thử đầu của Capu cho ra dữ liệu dù cách sửa đúng hay sai.

## Giả thuyết
Nếu bù khoảng dưới của khối dính bằng phần cửa sổ bố cục mà vùng nhìn thấy không có, thì thanh tab thấy trọn trên Chrome iOS. Chỉ số bảo vệ: Safari iOS (không có phần chênh) hành vi không đổi, bằng không.

## Hành vi (người dùng thấy gì)
Gọi: `chênh = max(0, innerHeight − visualViewport.height − visualViewport.offsetTop)`, đo theo từng sự kiện `resize` và `scroll` của visualViewport.
1. Mép dưới của khối dính (thanh tab, và khối gợi ý cài nằm ngay trên nó) cách mép dưới cửa sổ bố cục đúng `chênh` px, tức đáy thanh tab trùng đáy vùng nhìn thấy (`offsetTop + height`), ở đầu, giữa, cuối trang, cả bốn tab và trang con.
2. Khi `chênh` đổi lúc đang xem (thanh Chrome hiện/thu, 83 → 30 → 0 → 83), thanh tab đi theo, không cần cuộn hay chạm.
3. Khi `chênh` bằng 0 (Safari, desktop, Chrome đã thu hết thanh): thanh tab sát đáy cửa sổ như T-055, không đổi một điểm ảnh.
4. Khi đang zoom (`visualViewport.scale` khác 1): coi `chênh` bằng 0 (zoom làm height nhỏ đi, không phải thanh công cụ).
5. Chênh lệch dưới 1px coi là 0 (tránh rung vì số lẻ 0,5 của iOS).
6. Cờ chẩn đoán: mở địa chỉ có `?vvdebug=1` thì góc màn hình hiện một dòng `innerHeight=<số> vv.height=<số> vv.offsetTop=<số>`, cập nhật theo sự kiện. Không có cờ thì không hiện gì. Mục đích: Capu chụp ảnh để biết cách bù có đúng với Chrome iOS thật không.
7. Không đổi: Back/Forward, vị trí cuộn từng trang, khoá cuộn nền khi có lớp mở, header dính, chat, ngăn kéo, ngưỡng ẩn/hiện khối gợi ý 8px (mọi thứ T-054/T-055).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-056-chrome-ios-thanh-tab` (commit gắn `[T-056]`) · Vùng: `planner/front/layout`
- Bất biến của vùng đã đọc: `eval/invariants/planner/front/layout/` inv-001..009 và `navigation/`. Spec không vi phạm: inv-008 (thanh tab dính đáy "vùng nhìn thấy": khi `chênh` = 0 giống hệt). Không đề nghị đổi bất biến nào.
- Không đổi: `nav.js`, `docScroll.js` (nếu cần đọc visualViewport thì viết hook riêng, không sửa logic cuộn), `viewport-fit=cover`, chiều cao khung.
- Không chạm: auth, payment, DB, dữ liệu người dùng.
- Bậc đề xuất: B (UI layout, không chạm ranh giới cứng; eval tự động phủ cơ chế, máy thật chỉ có checklist).

### Cách sửa chọn (Engineering có thể đổi cơ chế, miễn qua eval)
Chọn: bù theo `visualViewport` (hành vi 1-5), đặt thành một biến CSS gốc rồi dùng làm `bottom` của khối dính. Lý do: (a) giữ nguyên mọi thứ Safari khi `chênh` = 0; (b) `100svh`/`dvh` không giúp vì vấn đề là NEO `bottom: 0` của khối sticky, không phải chiều cao khung, và Capu đã thử `min-height: 100dvh` rồi; (c) đổi sticky sang fixed hay thêm `padding-bottom` mất tính chất cuộn cấp trang cần cho Safari (ADR-022); (d) hướng cộng đồng khuyên (nguồn trên). Rủi ro đã nêu ở mục Bằng chứng; cách dự phòng nếu số đo cho thấy `chênh` = 0 trên Chrome iOS: nhận biết UA `CriOS` và đệm cố định, nhưng không làm trước khi có số đo.

## Tiêu chí chấp nhận và eval
Chạy trong `/home/user/tohong-hq`; `<front>` = `/home/user/tohong-front`. Eval giả lập visualViewport (đối tượng thay `window.visualViewport`, `innerHeight` giữ nguyên), vì Chromium không có thanh Chrome iOS.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Thanh Chrome 83px: đáy thanh tab trùng đáy vùng nhìn thấy ở đầu/giữa/cuối, cả 4 tab (hành vi 1) | `bash eval/T-056/run.sh <front> --only 1` |
| 2 | Thanh Chrome đổi 83→30→0→83 và offsetTop 12: thanh tab đi theo; khi 0 thì sát đáy cửa sổ như T-055 (hành vi 2, 3, 5) | `bash eval/T-056/run.sh <front> --only 2` |
| 3 | Đang zoom: không bù; hết zoom: bù lại (hành vi 4) | `bash eval/T-056/run.sh <front> --only 3` |
| 4 | Thanh Chrome 83px: khối gợi ý nằm trên thanh tab, cả hai trong vùng nhìn thấy; chữ cuối trang ở Kế hoạch, Khách mời không bị che | `bash eval/T-056/run.sh <front> --only 4` |
| 5 | Safari và mọi thứ T-054/T-055 không đổi: eval T-054 (1-8) và toàn bộ bất biến layout/navigation/budget xanh (hành vi 7) | `bash eval/T-056/run.sh <front> --only 5` |
| 6 | `?vvdebug=1` hiện đúng ba số đo, đổi theo sự kiện; không cờ thì không hiện (hành vi 6) | `bash eval/T-056/run.sh <front> --only 6` |
| 7 | iPhone thật, Chrome iOS và Safari (dòng 0 chụp số đo; A1-A9 Chrome; B10-B12 Safari) | `eval/T-056/checklist-iphone.md`: Chromium không có thanh Chrome/Safari iOS, máy thật là nguồn duy nhất |

Chạy tất cả: `bash eval/T-056/run.sh <front>` (check_vv + T-054). Trước khi viết code, 1-4 và 6 ĐỎ (đã chạy trên main 442e3f3: 1,2,3,4,6 đỏ, 5 là eval cũ). Đã chứng minh eval thoả được: một bản thử ngoài repo (hook ~10 dòng, `bottom: var(--vv-bottom, 0px)`) cho `check_vv.cjs` PASS toàn bộ và `T-054 --only 3` PASS. Bản thử không phải code giao.

## Bất biến đề xuất (tầng 2)
1. `layout inv-010` (spec-critic rút vào bể khi spec qua): thanh tab nằm trọn trong vùng nhìn thấy khi `visualViewport` nhỏ hơn `innerHeight` (thân eval = tiêu chí 1 và 2 của `check_vv.cjs`, bật khi lịch sử front có commit `[T-056]`, như cách inv-007..009 gắn `[T-054]`).
2. Quy tắc quy trình cho mọi việc layout (chạm sticky/fixed/100vh/dvh/safe-area/khung): bàn giao phải có dòng "Chrome iOS: đã thử trên máy thật, có/không" và dùng `eval/T-056/checklist-iphone.md` mục A. Đề xuất thêm một dòng vào `templates/spec.md` mục Ràng buộc và vào `templates/handoff.md`; sửa template phải qua Capu (PR), em không tự sửa.

## Không làm
- Không xử lý bàn phím ảo (chỉ ghi nhận ở checklist dòng 7; nếu T-055 vốn đã như vậy thì không tính lỗi).
- Không đổi đệm `env(safe-area-inset-bottom)` của thanh tab: chưa có số đo trên máy thật, ghi ở checklist dòng 8.
- Không nhận diện UA, không tách mã theo trình duyệt, không đổi Safari.
- Không đưa lại khung con cuộn, không đổi `viewport-fit`.
- Không hỗ trợ Chrome Android (chưa có báo cáo; cơ chế chung có thể giúp nhưng không cam kết, không eval).

## Câu hỏi mở
Không. (Một lưu ý cho Capu khi thử lần đầu: mở `?vvdebug=1`, chụp ảnh khi thanh Chrome hiện; số đo quyết định cách bù có đúng không.)
