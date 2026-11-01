# Spec T-025: App giãn theo bề ngang, tối đa 768px

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-01, `board/T-025.md`): app Tơ Hồng giãn theo bề ngang màn hình thay vì khung cố định 440px, tối đa bằng iPad dọc (768px).

## Bằng chứng
- `phungrk/tohong-front` main `76ff7e6`, `src/index.css`: `.app-frame { width: 100%; max-width: 440px; }` (dòng 179-187); viền và bóng khi viewport >= 461px bằng `@media (min-width: 461px)` (dòng 189-195). Số 440 và 461 là hai chỗ cứng độc lập nhau.
- `src/App.jsx:363-364`: `.app-page > .app-frame` bọc cả app; frame có `position: relative; overflow: hidden`, nhưng **không có `transform`**, nên phần tử `position: fixed` thoát khỏi khung và căn theo viewport.
- Rà `position: fixed` / `absolute` / `maxWidth 440` (grep trên `src/`, chỉ phần chạm bề ngang khung):

| Phần tử | Vị trí | Hiện nay | Lỗi khi frame giãn |
| --- | --- | --- | --- |
| Màn Mời: scrim | `InviteSheet.jsx:88` fixed `inset: 0` z1000 | phủ cả viewport | phủ cả vùng ngoài khung |
| Màn Mời: sheet | `InviteSheet.jsx:91` fixed `left: 50%`, `maxWidth: 440`, z1001 | 440 căn giữa | hẹp hơn khung 768 |
| Sheet Kết nối: scrim, sheet | `chat/ConnectSheet.jsx:73, 76` | như trên | như trên |
| Sheet vendor ở Ngân sách: scrim, sheet | `Budget.jsx:132, 144` fixed `inset: 0` / `left: 0; right: 0` z499-500 | phủ cả viewport | **đã lệch ngay hôm nay**: ở viewport > 440 sheet rộng bằng viewport, không bằng khung (ảnh chụp ở 1280, eval trên main) |
| Thông báo "Đã lưu vào Vendors" | `chat/VendorChatCards.jsx:71` fixed `left: 50%` + translate, bottom 90 | giữa viewport | đúng khi khung căn giữa; giữ nguyên, không tự động kiểm (checklist) |
| Hộp đăng nhập Clerk | `AuthGate.jsx:49` fixed `inset: 0` z9999 | phủ cả viewport | không trong phạm vi (không dựng được khi không có Clerk, ghi ở Không làm) |
| `.modal-overlay` | `index.css:500` fixed `inset: 0` | không thấy chỗ dùng trong `src/` | không phải xử lý |
| AI chat (AIChatModal), Timeline, VendorFlowSheet, Onboarding, Dashboard chỉnh sửa, Paywall, ngăn kéo (drawer, `index.css:318-345`) | `position: absolute` trong `.app-frame` | theo khung | đúng sẵn; eval vẫn đo AIChatModal và ngăn kéo; Timeline, VendorFlowSheet, Paywall, Onboarding ở checklist |
| Thanh tab dưới | `App.jsx:50`, nằm trong luồng flex của khung | theo khung | đúng sẵn; eval đo |
| Slider ngân sách (`BaselineSlider.jsx`) | `absolute` trong thành phần | theo cha | không chạm |

- Đo trên main bằng `eval/T-025/check_width.cjs` (xem "Kết quả trên main" trong bàn giao): ở viewport 1024 khung đo được 440px, lề trái 292px; scrim của sheet vendor trải 0..1024 trong khi khung là 292..732.
- Không có số liệu người dùng về tablet hay máy tính. Giả định "người dùng mở bằng iPad hoặc trình duyệt máy tính và thấy khung hẹp là điều không muốn" là **GIẢ ĐỊNH, tự tin ~70%**, chỉ dựa trên brief của Capu.

## Giả thuyết
Nếu khung giãn theo viewport tới 768px thì người dùng trên iPad và máy tính thấy app dùng hết bề ngang hợp lý thay vì một dải hẹp, mà người dùng điện thoại không thấy khác gì. Chỉ số bảo vệ: ở 320-767px không đổi gì nhìn thấy được (khung vẫn 100% bề ngang); BotMarkdown, build, lint không xấu đi.

## Hành vi (người dùng thấy gì)

**Định nghĩa dùng chung** (eval đo theo đúng các định nghĩa này):
- "Khung" là phần tử `.app-frame` (tên lớp hiện có, **giữ nguyên**). Bề rộng khung là `getBoundingClientRect().width` (đã gồm viền nếu có).
- "Viewport" là `document.documentElement.clientWidth`.
- `--app-max` là custom property CSS khai báo trên `:root`, giá trị `768px`. Đây là nơi **duy nhất** chứa con số 768 quyết định bề rộng; mọi hành vi dưới đây đổi theo nó. Eval kiểm bằng cách đặt `--app-max` sang giá trị khác (600px) rồi đo lại, nên không được dùng một số 768 thứ hai (kể cả trong `@media`) cho viền, bóng hay sheet.
- "Phần tử phủ" là mọi phần tử đang hiện trong màn hình mà `position` là `fixed`, hoặc `absolute` có `z-index >= 50`, hoặc có `role="dialog"`. Thanh tab dưới không phải phần tử phủ; nó có điều kiện riêng ở mục 2.

1. **Bề rộng khung.** Khi viewport < `--app-max`: khung rộng đúng bằng viewport (100%). Khi viewport >= `--app-max`: khung rộng đúng `--app-max` (768px) và căn giữa theo chiều ngang (lề trái = lề phải, sai số 1px). Sai số bề rộng 0,6px. Chiều cao khung không đổi (đầy màn hình như cũ).
2. **Phần tử phủ và thanh tab nằm trong khung.** Ở mọi viewport 390, 768, 1024, 1280:
   - mọi phần tử phủ đang hiện có mép trái >= mép trái khung và mép phải <= mép phải khung (sai số 2px). Scrim (lớp tối phía sau sheet) cũng là phần tử phủ: nó chỉ phủ khung, **không** phủ vùng ngoài khung;
   - phần tử phủ có bề rộng >= 300px (sheet, scrim, hộp chat) rộng đúng bằng khung (sai số 2px). Nghĩa là sheet Mời và sheet Kết nối **không còn giữ 440px**, mà rộng bằng khung. Phần tử nhỏ hơn 300px (ngăn kéo rộng `min(290px, 82vw)`, thông báo nhỏ) chỉ cần nằm trong khung;
   - bốn nút thanh tab (Trang chủ, Kế hoạch, Ngân sách, Khách mời): mép trái nút ngoài cùng = mép trái khung, mép phải nút ngoài cùng = mép phải khung (sai số 2px), và đáy nút không vượt đáy màn hình.
3. **Không cuộn ngang.** Ở mọi viewport từ 320px tới 1440px: `scrollWidth` của `html`, của `body` và của khung đều không vượt bề rộng viewport (khung: không vượt bề rộng khung, sai số 0,5px).
4. **Viền và bóng.** Khi viewport > `--app-max`: nhìn thấy viền hoặc bóng quanh khung (cạnh trái khung và cạnh phải khung có đường viền > 0px, hoặc có `box-shadow` mà độ sáng điểm ảnh sát ngoài cạnh trái khung khác điểm ảnh cách đó 40px ít nhất 2 trên thang 0-255). Khi viewport <= `--app-max`: viền trái và viền phải của khung đều 0px. Ngưỡng này cũng đi theo `--app-max` (đặt `--app-max: 600px`: viewport 700 có viền/bóng, viewport 600 không có viền).
5. **Giữ nguyên thành phần được bảo vệ.** `BotMarkdown`, `import Markdown from 'react-markdown'`, `import remarkGfm from 'remark-gfm'` trong `AppChat.jsx`, các quy tắc `.md` trong `index.css` (không ít hơn ở main), hai dependency `react-markdown`, `remark-gfm`: còn nguyên. Trả lời của AI có bảng markdown vẫn hiện thành `<table>` trong `.md` ở 390 và 1280. `vite build` thành công. `npm run lint` không có thêm error hoặc warning so với main (ADR-006: main `76ff7e6` có 32 error, 3 warning) và file mới không có lỗi lint.
6. **Ảnh chụp.** Thư mục `docs/screenshots/T-025/` của `tohong-front`, **đã commit trong PR**, có ít nhất một ảnh PNG rộng đúng 390px, một rộng đúng 768px, một rộng đúng 1280px (devicePixelRatio 1). Tạo bằng `node eval/T-025/check_width.cjs --repo . --shots docs/screenshots/T-025`; đủ năm màn: Trang chủ, màn Mời, sheet vendor ở Ngân sách, sheet Kết nối, chat AI, ngăn kéo.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-025-responsive-width` · Vùng (`area`): `front/layout` (vùng mới; chưa có bất biến nào, `eval/invariants/` hiện chỉ có README).
- Bất biến của vùng đã đọc: `eval/invariants/README.md`; chưa có bất biến cụ thể nào cho `front/` nên không có gì để mâu thuẫn. Đề nghị bất biến mới ở mục dưới.
- Quyết định liên quan đã đọc: ADR-006 (`decisions/2026-10-28-t013-lint.md`, lint tính theo "không thêm lỗi so với main"); `CLAUDE.md` của `tohong` mục "Frontend: chức năng bắt buộc không được xoá" (BotMarkdown, `.md`).
- Kiến trúc: inline style React + `src/index.css`; không thêm thư viện. Giữ tên lớp `.app-page`, `.app-frame` (eval chọn khung bằng `.app-frame`).
- Không chạm: auth, payment, dữ liệu người dùng, API, backend. Không đổi nội dung chữ.
- Bậc lưới lọc đề xuất: **A**. Chỉ UI/CSS, không payment/auth/DB/dữ liệu người dùng, eval tự động phủ tiêu chí 1-6 (checklist chỉ bổ sung).

## Tiêu chí chấp nhận và eval
Lệnh chạy từ gốc sổ cái `/home/user/tohong-hq`, repo front đặt bằng `--repo`. Gate chạy với `--cwd` là repo front: dùng dạng `node ../tohong-hq/eval/T-025/check_width.cjs --repo . --only N`. Mọi eval tự build (`vite build` ra thư mục tạm, không ghi vào repo) và tự phục vụ bản build; mọi request tới backend (`localhost:8787`) được giả, mọi request ra ngoài (Clerk, font, analytics) bị chặn; không cần backend.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Khung rộng 100% khi viewport < 768, đúng 768 và căn giữa khi >= 768; 768 là biến `--app-max` duy nhất (đo ở 320, 390, 767, 768, 769, 1024, 1280, 1440; đổi biến sang 600 thì khung đổi theo) | `node eval/T-025/check_width.cjs --repo ../tohong-front --only 1` |
| 2 | Mọi phần tử phủ và thanh tab nằm trong khung và vừa bề ngang khung ở 390, 768, 1024, 1280 (màn chính, màn Mời, sheet vendor ở Ngân sách, sheet Kết nối, chat AI, ngăn kéo; và màn Mời khi `--app-max` = 600) | `node eval/T-025/check_width.cjs --repo ../tohong-front --only 2` |
| 3 | Không cuộn ngang ở 320, 390, 767, 768, 769, 1024, 1280, 1440 | `node eval/T-025/check_width.cjs --repo ../tohong-front --only 3` |
| 4 | Viền/bóng chỉ khi viewport > khung; ngưỡng đi theo `--app-max` | `node eval/T-025/check_width.cjs --repo ../tohong-front --only 4` |
| 5 | BotMarkdown + `.md` + deps còn; bảng markdown trong chat vẫn render; build xanh; lint không tăng so với `origin/main` | `python3 eval/T-025/check_5_guard.py --repo ../tohong-front` (gồm build, lint, thành phần được bảo vệ) và `node eval/T-025/check_width.cjs --repo ../tohong-front --only 5` (bảng markdown render ở 390 và 1280) |
| 6 | Ảnh PNG 390, 768, 1280 đã commit ở `docs/screenshots/T-025/` | `python3 eval/T-025/check_6_shots.py --repo ../tohong-front` |
| (bổ sung) | Phần nhìn và các màn eval không dựng được | `eval/T-025/checklist.md` (checklist, vì cảm nhận thị giác và Paywall/Timeline/VendorFlowSheet/Onboarding/SaveFlash cần dữ liệu mà eval tự động chưa dựng; mọi tiêu chí đã có eval tự động ở trên) |

Tiêu chí 5 có hai lệnh vì một lệnh kiểm thành phần/build/lint (không cần trình duyệt), một lệnh kiểm render (cần trình duyệt); cả hai thuộc cùng tiêu chí và đều phải đạt.

Màn eval tới được (dữ liệu giả, vai owner, hồ sơ đủ, không đăng nhập): Trang chủ + thanh tab, màn Mời, Ngân sách → sheet vendor → sheet Kết nối, chat AI (gửi tin, nhận bảng markdown), ngăn kéo. Không tới được: Paywall, sheet Timeline, VendorFlowSheet, Onboarding, hộp đăng nhập Clerk, thông báo SaveFlash; các màn này nằm ở `checklist.md` hoặc ở Không làm.

## Bất biến đề xuất (tầng 2)
Vùng `front/layout`. Spec critic rút vào `eval/invariants/front/layout/` khi spec qua cổng. Cả bốn viết được thành eval chạy được bằng đúng `check_width.cjs` (cần một trình bọc `.sh` đọc đường dẫn repo từ biến môi trường, vì gate chạy `.sh` không đối số):
1. **inv-khung-không-vượt-biến**: khung app có bề rộng đúng `min(viewport, --app-max)`, căn giữa, và không bao giờ vượt `--app-max`. (`--only 1`)
2. **inv-không-cuộn-ngang**: không cuộn ngang ở mọi viewport 320-1440. (`--only 3`)
3. **inv-phủ-nằm-trong-khung**: mọi phần tử cố định/phủ (sheet, modal, scrim, thanh tab) nằm trong khung ở 390, 768, 1024, 1280; sheet mới thêm sau này tự bị kiểm nếu được mở trong luồng eval. (`--only 2`)
4. **inv-viền-bóng-theo-khung**: viền/bóng chỉ hiện khi viewport rộng hơn khung. (`--only 4`)

Lưu ý cho bất biến 3: eval chỉ kiểm sheet mà nó mở được. Sheet mới ở màn eval chưa dựng được thì ai thêm sheet phải thêm bước mở nó vào `check_width.cjs`; không thêm thì bất biến không phủ sheet đó.

## Không làm
- Thiết kế lại bố cục cho tablet/desktop (nhiều cột), đổi cỡ chữ, đổi khoảng cách, đổi nội dung chữ.
- Trang admin (`/?admin`, có bố cục riêng rộng tối đa 1200px, `src/admin/admin.css`).
- Hộp đăng nhập Clerk (`AuthGate.jsx` `SignInOverlay`): không dựng được khi không có Clerk, không nằm trong tiêu chí.
- Đổi `--app-max` sang giá trị khác 768px; đổi chiều cao khung; thêm điểm gãy (breakpoint) thứ hai.
- Sửa hay xoá eval để khớp code.

## Câu hỏi mở
Sheet nhỏ (màn Mời, sheet Kết nối, vốn rộng tối đa 440px) khi khung là 768px: spec này chọn **rộng đúng bằng khung** (giống sheet vendor ở Ngân sách và chat AI, tiêu chí 2), vì brief nói sheet "căn theo khung". Nếu Capu muốn sheet nhỏ giữ 440px căn giữa trong khung 768px thì tiêu chí 2 và eval đổi (bỏ quy tắc "rộng bằng khung", giữ "nằm trong khung"). Mặc định: rộng bằng khung. Tự tin ~65%.
