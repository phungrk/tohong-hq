# Spec T-027: Nút Back trình duyệt và cài app ra màn hình chính

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-01, `board/T-027.md`): trên điện thoại, bấm Back từ trang B phải về trang A của app thay vì thoát app; và cho người dùng cài app ra màn hình chính để mở toàn màn hình, không còn thanh trình duyệt.

## Bằng chứng
- `phungrk/tohong-front` main `cafdefa` (đã gồm T-025, T-026). `src/App.jsx:129` `useState(0)` giữ tab, `:334` `setTab(i)`; `grep` không thấy `pushState`, `popstate`, `location.hash` trong `src/` (trừ trang admin riêng). Hệ quả: mọi Back hiện nay rời app.
- Các "lớp" hiện có (mỗi lớp là state cục bộ, không có địa chỉ): ngăn kéo `App.jsx` (`drawer`), chat AI `AIChatModal` (`aiOpen`), màn Mời `InviteSheet` (`Dashboard.jsx:185 inviteOpen`), sheet vendor ở Ngân sách `Budget.jsx:277 selectedVendorId`, sheet Kết nối `ConnectSheet` (`ConnectCtx.jsx target`), sheet Timeline (`Timeline.jsx:314-315`), chỉnh sửa hồ sơ ở Trang chủ (`Dashboard.jsx:32 editing`).
- Trang con duy nhất: danh mục ngân sách (`Budget.jsx:547 openCat`, nút `aria-label="Quay lại"` tại `:302`). Trạng thái nằm ở `App.jsx` (`budgetOpenCatId`).
- **Bẫy sẵn có** `Budget.jsx:524-526`: `if (openCatId && !bud.cats.find(...)) onOpenCat(null)` chạy cả lúc danh mục **chưa tải xong** (`cats` khởi tạo rỗng). Nếu khôi phục trang con từ địa chỉ mà không sửa chỗ này, link sâu vào danh mục sẽ bị đóng ngay. Spec dưới đây (mục 7) cấm điều đó.
- `public/manifest.json`: chỉ một icon `/favicon.svg` (`purpose: "any maskable"`). `index.html`: `apple-touch-icon` trỏ vào `/favicon.svg`. Đo trên main (bàn giao): Chromium của eval **không** báo lỗi đủ điều kiện cài với manifest hiện tại, nên phần "Chrome báo đủ điều kiện" của tiêu chí 5 là lưới bảo vệ (không được xấu đi), còn phần đỏ trên main là thiếu icon PNG 192/512 và `apple-touch-icon` 180; Android Chrome thật có thể đòi PNG (checklist 11). iOS không dùng SVG cho biểu tượng màn hình chính: GIẢ ĐỊNH, tự tin ~85%, dựa trên hiểu biết chung, chưa thử trên máy thật (checklist).
- Logo hiện có: `public/favicon.svg` (biểu tượng tím). Không có số liệu người dùng về tỷ lệ thoát app khi bấm Back hay tỷ lệ muốn cài app: GIẢ ĐỊNH, tự tin ~75%, chỉ dựa trên brief của Capu.
- Prototype của Spec Writer (không phải code giao, nằm ngoài repo) cho thấy toàn bộ eval ở đây chạy xanh với một cách cài đặt khả thi; vì vậy eval không đòi điều không làm được.

## Giả thuyết
Nếu Back đi đúng trang trước và có gợi ý cài thì người dùng điện thoại không còn "văng ra khỏi app" khi bấm Back và một phần cài app ra màn hình chính (mở không thanh trình duyệt). Chỉ số bảo vệ: không bẫy người dùng ở app (Back ở gốc vẫn rời app); T-025/T-026 không xấu đi (bất biến `front/layout`); BotMarkdown, build, lint không xấu đi.

## Hành vi (người dùng thấy gì)

**Định nghĩa dùng chung** (eval đo đúng theo đây):
- **Bước lịch sử**: một mục trong lịch sử của tab trình duyệt. Đo bằng `history.length` tăng 1. Back = nút Back trình duyệt, vuốt back iOS/Android, phím Back hệ thống Android, `history.back()`; chúng không khác nhau.
- **Tab**: bốn tab trên thanh dưới. Nút giữa "AI" (chỉ số 1) **không phải tab**, nó mở chat AI (là một lớp).
- **Trang con**: màn đầy trang nằm trong một tab, có địa chỉ riêng. Hiện chỉ có **một**: *Danh mục ngân sách* (mở khi chạm một hạng mục ở tab Ngân sách, ví dụ "Ảnh").
- **Lớp**: thứ phủ lên màn, đóng lại thì quay về màn bên dưới, **không có địa chỉ riêng**. Danh sách đóng: ngăn kéo; chat AI (gồm Paywall trong nó); màn Mời; sheet vendor ở Ngân sách; sheet Kết nối; sheet Timeline (thêm mốc, thêm việc); chỉnh sửa hồ sơ ở Trang chủ; VendorFlowSheet. **Không phải lớp**: Onboarding, hộp đăng nhập Clerk, `SaveBanner`, thông báo "Đã lưu vào Vendors", gợi ý cài app (mục 9). Sheet/modal mới thêm về sau là lớp, trừ khi spec khác nói ngược.
- **Gốc**: màn Trang chủ ở bước đầu tiên của tab trình duyệt, không có bước nào của app phía trước.

### 1. Địa chỉ (hash) của từng màn
| Màn | Địa chỉ |
| --- | --- |
| Trang chủ | `#/trang-chu` |
| Kế hoạch | `#/ke-hoach` |
| Ngân sách | `#/ngan-sach` |
| Khách mời | `#/khach-moi` |
| Danh mục ngân sách | `#/ngan-sach/<id>` với `<id>` là id hạng mục (ví dụ `#/ngan-sach/photography`), mã hóa bằng `encodeURIComponent` |

- Địa chỉ **chỉ** gồm các dạng trên (khớp `^#/(trang-chu|ke-hoach|ngan-sach(/[A-Za-z0-9_.~%-]+)?|khach-moi)$`). Không đưa email, tên, mã cặp đôi vào địa chỉ.
- Lớp **không** đổi địa chỉ.
- Phần `?query` giữ nguyên (ví dụ `?ob=1`). Trang admin (`/?admin`) không thuộc spec này, không đổi.
- Nút tab đang chọn có `aria-current="page"`; ba nút còn lại không có thuộc tính này. (Trình đọc màn hình và eval dùng nó để biết tab đang chọn.)

### 2. Chuyển tab và trang con
- Chạm tab **khác tab đang chọn**: địa chỉ đổi sang bảng trên (tab gốc, không có phần `/<id>`), thêm **đúng một** bước.
- Chạm tab **đang chọn** khi không ở trang con: không thêm bước.
- Chạm tab **Ngân sách** khi đang ở trang con: sang `#/ngan-sach`, thêm một bước, trang con đóng. (Hệ quả cố ý: đi tab khác rồi quay lại Ngân sách luôn thấy danh sách, không còn nhớ trang con.)
- Mở một danh mục: địa chỉ sang `#/ngan-sach/<id>`, thêm một bước.
- Nút "Quay lại" của trang con (và "Xoá hạng mục" sau khi xoá xong): nếu trước nó còn bước của app → hành xử như Back; nếu người dùng vào thẳng bằng link sâu (không còn bước nào của app phía trước) → **thay** địa chỉ bằng `#/ngan-sach`, không thêm bước, không rời app.
- Mọi chỗ khác trong app gọi chuyển tab (thẻ ở Trang chủ như "Ngân sách", "Khách mời", mục "Sắp tới") đi qua đúng luật này.

### 3. Back khi không có lớp mở
Back về **đúng màn của bước trước**: tab trước, hoặc trang con trước. Nhiều bước liên tiếp đi đúng thứ tự ngược. Forward đi lại đúng thứ tự xuôi. Ví dụ: Trang chủ → Ngân sách → danh mục Ảnh → Khách mời → Kế hoạch; Back 4 lần lần lượt: Khách mời, danh mục Ảnh, Ngân sách (danh sách), Trang chủ.

### 4. Lớp
- Mở một lớp thêm **một** bước; địa chỉ giữ nguyên. Lớp mở trên lớp: mỗi lớp một bước.
- **Back khi có lớp mở**: chỉ đóng **lớp trên cùng**. Tab, trang con, địa chỉ không đổi. Back tiếp đóng lớp kế tiếp, hết lớp rồi mới đổi trang.
- **Đóng lớp bằng giao diện** (nút đóng, "Thôi", chạm lớp tối, chạm ngoài khung theo INV-005/006, xác nhận xong tự đóng) tương đương một Back: bước của lớp ấy không còn là bước chết. Sau đó bấm Back đi tới **trang trước đó**, không phải một lần Back "không đổi gì". `history.length` không bắt buộc giảm.
- **Chọn đích từ trong lớp** (chọn tab trong ngăn kéo; mở cuộc trò chuyện cũ từ ngăn kéo): lớp đóng và đích được ghi; so với lúc chưa mở lớp, tổng số bước mới là đúng **một** nếu đích có địa chỉ khác, **không** nếu đích cùng địa chỉ (chọn "Trang chủ" khi đang ở Trang chủ). Sau đó Back về trang đứng trước lúc mở lớp.
- **Forward vào bước từng là lớp**: lớp **không** mở lại; người dùng ở lại trang liền trước bước đó. Không lỗi, không vòng lặp.
- Đổi địa chỉ bằng tay (gõ vào thanh địa chỉ, sửa `location.hash`) đóng mọi lớp và đi tới màn đó như một bước bình thường.

### 5. Tải lại
- Tải lại giữ **tab và trang con** theo địa chỉ.
- Tải lại khi có lớp mở: mọi lớp đóng (nội dung nhập dở mất, chấp nhận), vẫn ở trang đó; Back kế tiếp đi tới **trang trước đó** (không có bước chết).

### 6. Gốc Tổng quan: không bẫy
- Mở app không thêm bước nào (`history.length` sau khi app dựng xong bằng lúc nạp trang). Cấm chèn bước giả, cấm bắt `popstate` để đẩy lại bước, cấm hộp thoại "rời trang?".
- Ở gốc, Back **rời app** như bình thường (về trang trước của trình duyệt; ở app đã cài thì thoát app). Ở gốc đang mở lớp: Back đầu đóng lớp, Back kế rời app.
- Trang chủ → Ngân sách → Back → Trang chủ; Back nữa rời app.

### 7. Link sâu
- Mở URL có hash hợp lệ trong tab mới: vào thẳng màn đó; **không** chèn bước Trang chủ phía trước; `history.length` bằng lúc nạp; Back rời app.
- Không hash (`/`) hoặc hash không thuộc bảng mục 1: hiển thị Trang chủ và **thay** (không thêm bước) địa chỉ bằng `#/trang-chu`.
- `#/ngan-sach/<id>`: mở thẳng danh mục khi dữ liệu danh mục đã về và có `<id>`. **Giữ nguyên địa chỉ và không đóng trang con trong lúc dữ liệu chưa về**; chỉ khi dữ liệu đã về mà không có `<id>` mới **thay** địa chỉ bằng `#/ngan-sach` (không thêm bước, không lùi). Nếu dữ liệu không tải được: không đổi địa chỉ, hiện danh sách Ngân sách như hiện nay.
- Người dùng mới đang ở Onboarding: Onboarding vẫn chặn như hiện nay; địa chỉ được giữ.

### 8. Icon và manifest (đủ điều kiện cài trên Android)
- `manifest.json`: giữ `display: standalone`, `name`, `short_name`, `start_url`; giữ icon SVG nhưng `purpose` chỉ là `any` (SVG không có vùng an toàn nên không được ghi `maskable`).
- Thêm icon PNG, mỗi cỡ **192x192 và 512x512** hai mục khai báo riêng: một mục `purpose: "any"`, một mục `purpose: "maskable"` (hai mục có thể trỏ cùng file hoặc hai file). Kích thước thật của file PNG phải đúng cỡ khai báo.
- Hình **sinh từ `public/favicon.svg`**, không vẽ hình mới, `favicon.svg` giữ nguyên từng byte. Nền đặc `#FCF8F3` (đúng `background_color` của manifest), logo ở giữa, tỉ lệ cạnh giữ nguyên.
- Icon maskable: nền `#FCF8F3` đặc tràn tới sát cạnh (bốn góc không trong suốt), logo nằm gọn trong vòng tròn tâm ở giữa bán kính 40% cạnh (vùng an toàn); mọi điểm ngoài vòng đó phải là màu nền.
- `index.html`: `<link rel="apple-touch-icon" sizes="180x180" href="…png">`; file PNG đúng 180x180, **đặc** (không trong suốt, không bo góc), có logo.
- Chrome không báo lỗi đủ điều kiện cài (`Page.getInstallabilityErrors` rỗng) và không báo lỗi nghiêm trọng khi phân tích manifest. Không dùng service worker (ngoài phạm vi).

### 9. Gợi ý "Thêm Tơ Hồng vào màn hình chính"
**Khi nào hiện** (cả ba điều kiện): (a) không đang chạy standalone, (b) chưa bấm "Không nhắc lại", (c) một trong hai: trình duyệt đã bắn `beforeinstallprompt` (Android Chrome và mọi Chromium khác), hoặc UA có `iPhone`, `iPad` hoặc `iPod` (iOS). Thêm: không hiện khi Onboarding đang mở; hiện sau khi Onboarding xong nếu điều kiện còn đúng. iPad ở chế độ "trang web máy tính" (UA giống Mac) không được nhận là iOS: chấp nhận, ghi ở checklist.
- **Standalone** = `matchMedia('(display-mode: standalone)').matches` **hoặc** `navigator.standalone === true`. Đang standalone thì **không bao giờ** hiện, kể cả khi có `beforeinstallprompt` hay UA iOS.
- Sự kiện `beforeinstallprompt` được giữ lại dù nó đến trước hay sau khi app dựng xong, và được `preventDefault()` để Chrome không hiện thanh gợi ý riêng (eval chỉ kiểm phần "sau khi dựng xong"; "đến trước" ở checklist máy thật).
- Sự kiện `appinstalled`: gợi ý ẩn ngay.

**Hình dạng**: một khối `role="region"` có `aria-label="Thêm Tơ Hồng vào màn hình chính"`, chữ tiêu đề cùng câu đó, nằm **trong khung**, **trong luồng bố cục** ngay trên thanh tab (không `fixed`/`absolute`, không đè thanh tab, không gây cuộn ngang). Vì không phải phần tử phủ nên không vi phạm INV-003.
- Android/Chromium (có sự kiện): hai nút "Cài ứng dụng" và "Không nhắc lại"; không có chữ "Chia sẻ". Bấm "Cài ứng dụng" gọi `prompt()` của sự kiện đúng một lần và ẩn gợi ý. Kết quả trình duyệt (chấp nhận hay từ chối) không ghi "tắt mãi"; lần mở sau, nếu trình duyệt bắn lại sự kiện, gợi ý có thể hiện lại.
- iOS: chữ hướng dẫn chứa "Chia sẻ" và "Thêm vào MH chính" (ví dụ "Bấm nút Chia sẻ, rồi chọn Thêm vào MH chính."); một nút "Không nhắc lại"; **không** có nút "Cài ứng dụng".
- **Tắt**: "Không nhắc lại" ẩn gợi ý ngay và ghi `localStorage["th_install_hint_off"] = "1"`. Sau tải lại, kể cả khi trình duyệt bắn lại `beforeinstallprompt`, gợi ý không hiện lại. Chỉ lưu ở thiết bị này (localStorage); **không** gửi lựa chọn lên backend, không dùng cookie.
- **Analytics**: chỉ ba sự kiện `install_hint_shown`, `install_hint_dismissed`, `install_prompt_result`. Ngoài thuộc tính chung mà mọi sự kiện đã có, mỗi sự kiện chỉ được thêm `platform` (`android` | `ios` | `other`) và, riêng `install_prompt_result`, `outcome` (`accepted` | `dismissed`). Không email, tên, số điện thoại, nội dung nhập.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-027-back-va-cai-app` · Vùng (`area`): `front/navigation` (vùng mới, chưa có bất biến riêng).
- Bất biến của vùng đã đọc: `eval/invariants/front/layout/` (INV-001..006) — spec này không vi phạm: gợi ý cài nằm trong luồng nên không là phần tử phủ (INV-003); lớp đóng khi chạm ngoài khung vẫn đóng (INV-005/006) và nay đồng thời lùi một bước lịch sử (mục 4). Không đề nghị đổi bất biến nào. `eval/invariants/front/navigation/` chưa tồn tại.
- Quyết định liên quan đã đọc: ADR-006 (lint không thêm lỗi), `CLAUDE.md` của `tohong` (BotMarkdown/`.md` không được xoá).
- Kiến trúc: không thêm thư viện router; dùng History API của trình duyệt. Giữ tên lớp `.app-page`, `.app-frame`. Không đổi thiết kế các màn ngoài khối gợi ý mới, `aria-current`, và địa chỉ.
- Không chạm: auth, payment, schema, API/backend, dữ liệu người dùng (localStorage chỉ thêm một cờ tắt gợi ý, không gửi đi).
- Bậc lưới lọc: **A**, như Capu đặt. Lý do: UI/điều hướng, eval tự động phủ 8/8 tiêu chí, không chạm ranh giới cứng. Lưu ý cho Chief of Staff: chạm `history` và `localStorage` nhưng không chạm dữ liệu người dùng; analytics thêm 3 sự kiện không có dữ liệu cá nhân. Nếu Capu coi sự kiện analytics mới là "dữ liệu người dùng" thì nâng B.

## Tiêu chí chấp nhận và eval
Chạy với cwd là repo front (`tohong-front`), repo sổ cái ở `../tohong-hq`. Mọi eval tự build (ra thư mục tạm, không ghi vào repo), tự phục vụ bản build, giả mọi request tới backend `localhost:8787`, chặn mọi request ra ngoài; không cần backend hay Clerk. Eval chỉ đo hành vi nhìn thấy (URL, `history.length`, phần tử trên màn), không đọc mã nguồn.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Chuyển tab/trang con ghi đúng một bước; Back/Forward đúng thứ tự nhiều bước; "Quay lại" của trang con khớp (mục 2, 3) | `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 1` |
| 2 | Có lớp mở thì Back đóng lớp trên cùng trước, không đổi trang; đóng bằng giao diện không để bước chết; chọn đích từ ngăn kéo tổng một bước; tải lại khi mở lớp (mục 4, 5) | `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 2` |
| 3 | Gốc Tổng quan không bẫy: không bước giả, Back rời app, link sâu không chèn bước (mục 6, 7) | `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 3` |
| 4 | Hash đúng từng tab; tải lại giữ tab và trang con; link sâu; hash lạ và id không tồn tại; địa chỉ không chứa dữ liệu cá nhân (mục 1, 5, 7) | `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 4` |
| 5 | Manifest có PNG 192 và 512 (maskable và any, đúng cỡ, logo sinh từ favicon, `favicon.svg` không đổi), `apple-touch-icon` 180, Chrome báo đủ điều kiện cài (mục 8) | `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 5` |
| 6 | Gợi ý cài: Android (sự kiện), iOS (hướng dẫn), không hiện khi standalone / Onboarding / không có điều kiện; tắt nhớ lựa chọn sau tải lại; không gửi backend; analytics chỉ `platform`/`outcome` (mục 9) | `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 6` |
| 7 | BotMarkdown, `.md`, deps còn; build xanh; lint không tăng so với `origin/main` (ADR-006); bảng markdown trong chat vẫn render; bất biến `front/layout` INV-001..006 vẫn đạt | `python3 ../tohong-hq/eval/T-027/check_7_guard.py --repo .` **và** `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --only 7` **và** `bash ../tohong-hq/eval/T-027/check_7_inv.sh .` |
| 8 | Ảnh chụp **đã commit** vào `docs/screenshots/T-027/`: PNG rộng 390 gồm tên chứa `install-android`, `install-ios`, `budget-subpage`; ít nhất một PNG rộng 1280. Tạo bằng `node ../tohong-hq/eval/T-027/check_t027.cjs --repo . --shots docs/screenshots/T-027` | `python3 ../tohong-hq/eval/T-027/check_8_shots.py --repo .` |
| (bổ sung) | Phần chỉ thử được trên máy thật (vuốt back iOS, cài thật trên Android, iPad, lớp không dựng được) | `eval/T-027/checklist.md` (checklist, vì trình giả lập không thay được vuốt back iOS, hộp thoại cài thật, thanh tiêu đề độc lập; mọi tiêu chí đã có eval tự động ở trên) |

Tiêu chí 7 có ba lệnh vì một lệnh kiểm thành phần/build/lint, một lệnh kiểm render trong trình duyệt, một lệnh chạy bất biến của bể; cả ba phải đạt.

Màn eval tới được: Trang chủ, Ngân sách, danh mục Ảnh, sheet vendor, sheet Kết nối, chat AI, màn Mời, ngăn kéo, bốn tab, gợi ý cài. Không tới được (ở checklist): sheet Timeline, chỉnh sửa hồ sơ, VendorFlowSheet, Paywall, Onboarding đầy đủ, hộp đăng nhập Clerk. Luật mục 4 áp dụng cho chúng; eval chưa kiểm. Ai thêm lớp mới phải thêm bước mở nó vào `check_t027.cjs` (qua Chief of Staff).

## Bất biến đề xuất (tầng 2)
Vùng `front/navigation`. Spec critic rút vào `eval/invariants/front/navigation/` khi spec qua cổng. Viết được thành eval chạy được bằng đúng `check_t027.cjs` (cần trình bọc `.sh` đọc đường dẫn repo từ `TOHONG_FRONT_REPO`, như `front/layout`, và bản chụp cố định của script trong `lib/`):
1. **inv-nav-không-bẫy-gốc**: mở app ở bất kỳ địa chỉ hợp lệ không thêm bước; Back ở gốc rời app; không hộp thoại rời trang. (`--only 3`)
2. **inv-nav-back-đóng-lớp-trước**: có lớp mở thì Back chỉ đóng lớp trên cùng, không đổi trang; đóng bằng giao diện không để bước chết. (`--only 2`)
3. **inv-nav-hash-đúng-tab**: mỗi tab đúng một địa chỉ trong bảng; địa chỉ khớp mẫu cho phép, không dữ liệu cá nhân; tải lại và link sâu giữ đúng màn. (`--only 4`)
4. **inv-nav-thứ-tự-back**: nhiều bước liên tiếp quay lại đúng thứ tự, mỗi lần đổi màn đúng một bước. (`--only 1`)
5. **inv-nav-manifest-cài-được**: manifest có PNG 192 và 512 (any, maskable), `apple-touch-icon` 180, Chrome báo đủ điều kiện cài. (`--only 5`)
6. **inv-nav-gợi-ý-cài-tôn-trọng-lựa-chọn**: không hiện khi standalone; "Không nhắc lại" được nhớ qua tải lại và không rời thiết bị. (`--only 6`)

Lưu ý: các bất biến 1, 2 chỉ phủ lớp mà `check_t027.cjs` mở được (danh sách ở trên).

## Không làm
- Service worker, offline, push notification, app native (đúng "Không làm" của Capu); hộp thoại cài tự viết cho iOS ngoài khối hướng dẫn.
- Đổi thiết kế các màn; trang admin; hộp đăng nhập Clerk.
- Ghi nhớ trang con khi đổi tab (mục 2 cố ý bỏ).
- Khôi phục nội dung nhập dở của lớp sau tải lại; mở lại lớp khi Forward.
- Nhận diện iPad ở chế độ "trang web máy tính" là iOS.
- Sửa hay xoá eval để khớp code.

## Câu hỏi mở
Gợi ý cài hiện ngay từ lần mở đầu tiên (mặc định của spec này, sau Onboarding) hay chờ tới lần mở thứ hai trở đi? Mặc định: ngay, vì Capu muốn người dùng cài được; rủi ro là người mới thấy khối gợi ý trước khi biết app làm gì. Nếu chờ lần hai thì mục 9 cần thêm một bộ đếm lần mở (localStorage) và eval 6 thêm một ca. Tự tin vào mặc định ~55%.
