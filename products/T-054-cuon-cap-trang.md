# Spec T-054: Cuộn ở cấp trang để Safari iPhone thu gọn thanh địa chỉ và ẩn thanh dưới

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-04, `board/T-054.md`): "Hiện tại khi scroll page lên, address bar và bottom bar trên safari vẫn hiển thị, khiến nội dung bên trong app bị ngắn đi. Mong muốn: khi scroll lên, theo mặc định của iphone thì bottom bar sẽ ẩn đi và address bar sẽ được thu gọn lại cho đến khi có thao tác scroll xuống… có thực hiện được ý mong muốn của tôi đồng thời vẫn giữ được việc fix browser back không?" Capu đã đồng ý hướng của Chief of Staff: chuyển phần cuộn ra cấp document, giữ nguyên hành vi Back của T-027/T-030.

## Bằng chứng
Mã đọc ở `/home/user/tohong-front` nhánh `main`, commit `3f11d8b`:
- `src/index.css:170-188`: `.app-page { min-height: 100dvh }`; `.app-frame { height: 100dvh; overflow: hidden; contain: layout }`. Khung cao đúng bằng màn hình và cắt mọi thứ vượt ra; `contain: layout` làm khung thành containing block của mọi `position: fixed` bên trong (sheet, scrim, toast).
- `src/App.jsx` (cuối file, `screens.map`): bốn màn (Trang chủ, Kế hoạch, Ngân sách, Khách mời) cùng mount sẵn, xếp chồng `position: absolute; inset: 0`, ẩn bằng `opacity: 0` + `pointerEvents: none`. Thanh tab (`BottomTabBar`) và khối gợi ý cài (`InstallHint`, `.install-hint`, `flex-shrink: 0`) là phần tử trong luồng flex, dưới ngăn xếp màn.
- Khung cuộn riêng của từng màn (`overflowY: 'auto'`): `Dashboard.jsx:278`, `Timeline.jsx:459`, `Budget.jsx:656` (danh sách) và `Budget.jsx:607` (trang con, cả header lẫn nội dung cùng cuộn), `Guests.jsx:160`, `Vendors.jsx:141`. Header của từng màn (`var(--header-pt)`) nằm ngoài khung cuộn nên đứng yên, riêng trang con ngân sách thì header cuộn đi theo nội dung.
- Lớp phủ: `AIChatModal.jsx` (luôn mount, `position: absolute; inset: 0; zIndex: 500`, bảng bắt đầu cách đỉnh 64px, có `Đóng`, danh sách tin nhắn `overflowY: auto`), `InviteSheet.jsx:91-94`, `ConnectSheet.jsx:75-78`, `Budget.jsx:157-173` (sheet và scrim `position: fixed`), `VendorFlowSheet` (`role="dialog"`, tên "Cách hoạt động"), ngăn kéo `Drawer` trong `App.jsx` (lớp lịch sử).
- `src/nav.js`: hash theo trang (`#/trang-chu`, `#/ke-hoach`, `#/ngan-sach`, `#/ngan-sach/<id>`, `#/khach-moi`), lớp = một bước lịch sử cùng địa chỉ (`useHistoryLayer`), `goTab` luôn đưa Ngân sách về danh sách. Không đụng tới `window.scrollTo` hay `scrollRestoration`.
- Chẩn đoán gốc (Chief of Staff, `board/T-054.md`): Safari chỉ thu gọn thanh địa chỉ và ẩn thanh dưới khi **document** cuộn; app hiện không bao giờ cuộn document. **Đây là hiểu biết về WebKit, không kiểm được bằng Chromium của eval: GIẢ ĐỊNH, tự tin ~85%.** Vì thế tiêu chí 9 là checklist trên iPhone thật.
- Đã chạy toàn bộ bất biến `_shared`, `planner/front/layout`, `navigation`, `budget` trên main `3f11d8b` bằng `bash eval/T-054/run_invariants.sh /home/user/tohong-front`: PASS (15 file, xanh trước khi làm).
- Đã đọc từng file `inv-*` và thư viện đo của `layout`, `navigation`, `budget`: **không bất biến nào đo chiều cao khung hay khung con cuộn** (không có `scrollTop`, `scrollHeight`, `overflow`, `100dvh`). Chúng đo bề rộng khung, phần tử phủ nằm trong khung, thanh tab nằm trong khung, và dùng toạ độ trong `innerHeight` để chạm. Rủi ro nằm ở chỗ khác, xem "Bất biến bị thay hay bị đe doạ".

## Giả thuyết
Nếu document là thứ cuộn (header dính trên, thanh tab dính dưới) thì trên Safari iPhone thanh địa chỉ thu gọn và thanh công cụ dưới ẩn khi người dùng vuốt nội dung lên, nên vùng nội dung cao hơn khi đọc danh sách dài. Chỉ số bảo vệ: Back/Forward theo T-027/T-030 không đổi một bước nào; mọi bất biến xanh; vị trí cuộn không bị mất khi đổi tab.

## Định nghĩa dùng chung (eval đo đúng theo đây)
- **Trang**: Trang chủ `#/trang-chu`, Kế hoạch `#/ke-hoach`, danh sách Ngân sách `#/ngan-sach`, Khách mời `#/khach-moi`, trang con danh mục ngân sách `#/ngan-sach/<id>`. Trang định danh bằng địa chỉ hash.
- **Document cuộn**: giá trị `window.scrollY` / `document.scrollingElement.scrollTop` thay đổi khi người dùng kéo hoặc lăn nội dung.
- **Vùng nhìn thấy**: phần màn hình mà trình duyệt đang cho app dùng (`window.innerHeight` x `document.documentElement.clientWidth`). Khi Safari thu gọn thanh, vùng này cao ra; mọi chỗ dưới đây tính theo vùng này, không theo số cố định.
- **Header**: hàng tiêu đề của trang chứa nút tên truy cập "Mở menu" (bốn màn chính) hoặc "Quay lại" (trang con).
- **Thanh tab**: bốn nút "Trang chủ", "Kế hoạch", "Ngân sách", "Khách mời".
- **Khối gợi ý cài**: vùng (`role=region`) tên "Thêm Tơ Hồng vào màn hình chính".
- **Lớp**: như T-027 mục "Lớp" (ngăn kéo; chat AI kể cả Paywall trong nó; sheet Mời; sheet vendor/kết nối ở Ngân sách; sheet Thêm việc/sửa ngày ở Kế hoạch; hộp thoại `role=dialog` như "Cách hoạt động"; Onboarding đang mở). Cộng thêm: **chat AI là lớp** dù không có `role=dialog`.
- **Khung**: phần tử `.app-frame`, cột rộng `min(vùng nhìn thấy, --app-max)` căn giữa. Tên `.app-frame` và biến `--app-max` (trên `:root`, 768px) **được giữ nguyên** vì bất biến `layout` đo bằng chúng.

## Hành vi (người dùng thấy gì)

### 1. Document cuộn, không còn khung con cuộn nội dung chính
1.1 Ở mỗi trang (bốn tab và trang con), khi nội dung dài hơn vùng nhìn thấy, kéo hoặc lăn nội dung làm `window.scrollY` tăng. Lăn ngược thì giảm về 0. Cuộn tới cuối được bằng document (`scrollY + innerHeight = scrollHeight`).
1.2 Sau khi cuộn trang, không **phần tử nằm ngoài mọi lớp** nào có `scrollTop > 0`, nghĩa là không còn khung con tự cuộn nội dung chính. **Phần tử nằm trong một lớp được miễn, dù lớp đang mở hay đang đóng (kể cả lớp luôn mount như chat AI và ngăn kéo)**: lớp giữ vị trí cuộn bên trong của nó như hiện nay, mở lại chat hay ngăn kéo thì danh sách ở chỗ cũ; **không đổi hành vi bên trong lớp** (quyết định của Chief of Staff, phân xử D1). Lớp nhận diện theo hành vi: cây con của `role=dialog`, hoặc cây con nhỏ nhất quanh nút "Đóng"/"Đóng menu" mà chưa chứa header của trang (nút "Mở menu"). (Cuộn **ngang** của dải chip, bảng so sánh có cột dính trái vẫn được phép.)
1.3 Kéo bằng cảm ứng và lăn bằng chuột đều làm document cuộn như nhau.

### 2. Chiều cao trang chỉ là nội dung của trang đang xem
2.1 Bốn màn vẫn mount sẵn (giữ state, không tải lại). Màn không xem **không chiếm chiều cao cuộn**, không hiện, không nhận chạm, **không nhận focus bàn phím** (bấm Tab không bao giờ rơi vào phần tử của màn đang ẩn). Với lớp đang đóng thì không quy định thêm (mục 1.2). Hệ quả đo được: trang ngắn (vd Trang chủ, hoặc Khách mời khi chưa có khách) ở màn 844px **không cuộn được** (`scrollHeight - innerHeight <= 1`) dù Kế hoạch đang dài hàng nghìn px.
2.2 Chuyển từ tab dài sang tab ngắn thì khoảng cuộn co lại theo tab ngắn ngay.
2.3 Trang ngắn hơn vùng nhìn thấy: thanh tab vẫn nằm sát đáy vùng nhìn thấy (khung kéo dài ít nhất bằng vùng nhìn thấy, nền giấy `--paper` phủ đầy).

### 3. Header và thanh tab luôn thấy, không che nội dung
3.1 **Header dính đầu** vùng nhìn thấy ở mọi vị trí cuộn, kể cả header của trang con (nút "Quay lại" không còn cuộn đi theo nội dung). Header không tự ẩn khi cuộn.
3.2 **Thanh tab dính đáy** vùng nhìn thấy ở mọi vị trí cuộn: **mép dưới thanh tab trùng đáy vùng nhìn thấy** (sai số 1,5px; trên iPhone thật mép dưới gồm đệm `env(safe-area-inset-bottom)`, trong Chromium safe-area = 0 nên đo là đáy bốn nút), rộng đúng bằng khung và căn giữa. Chạm tab khi đang cuộn tới cuối vẫn đổi trang.
3.3 **Vùng an toàn.** Thanh tab giữ `padding-bottom: env(safe-area-inset-bottom, 8px)` như hiện nay; header giữ `var(--header-pt)` (có `env(safe-area-inset-top)`). Giữ `viewport-fit=cover` trong `index.html`. Không thêm khoảng đệm cố định nào nhằm "bù" thanh Safari. Chromium không có safe-area thật nên mục này kiểm bằng checklist (B8, B12).
3.4 **Không che chữ**: ở **đầu** trang (`scrollY = 0`) không chữ nào của nội dung nằm dưới header; ở **cuối** trang (`scrollY` lớn nhất) không chữ nào của nội dung nằm dưới thanh tab hay dưới khối gợi ý cài. (Đo: điểm giữa của mỗi lá văn bản trong vùng 110px đầu/ vùng đáy mà `elementFromPoint` trả về chính nó hoặc tổ tiên/hậu duệ của nó.)
3.5 **Khối gợi ý cài** (đổi theo quyết định mới của Capu: "Ẩn khi cuộn lên"). Vẫn dính ngay trên thanh tab, cùng thanh tab, rộng bằng khung, không đổi chỗ trong DOM; ẩn khi có lớp mở (ADR-011); "Không nhắc lại" vẫn hoạt động. Khi **hiện**, nó chiếm chỗ như trước và không che nội dung cuối trang (3.4). Ẩn/hiện theo hướng cuộn xem mục 8.

### 4. Nhớ và khôi phục vị trí cuộn
4.1 **Nhớ theo trang (theo địa chỉ hash), không theo bước lịch sử.** Khi rời trang X, vị trí `scrollY` lúc rời được nhớ cho địa chỉ X. Ghi đè mỗi lần rời.
4.2 Trang X hiện lại bằng **chạm thanh tab, Back, Forward, nút "Quay lại" của trang con, hoặc chọn tab trong ngăn kéo**: về đúng vị trí đã nhớ (sai số 2px). **Khung hình đầu tiên có địa chỉ mới đã ở đúng vị trí đó và mọi khung hình sau giữ nguyên; không vẽ trang ở đầu rồi nhảy, không hoạt ảnh cuộn** (đo bằng `requestAnimationFrame` ghi `location.hash` và `scrollY` mỗi khung hình). Checklist C10 đã đúng ý này.
4.3 Hai bước lịch sử khác nhau cùng địa chỉ X dùng chung một vị trí nhớ (vị trí rời gần nhất của X), không phải mỗi bước một vị trí.
4.4 Trang **chưa từng xem** bắt đầu ở 0. Trang con mở bằng cách **chạm một hạng mục** trong danh sách cũng bắt đầu ở 0 (dù từng xem hạng mục đó rồi); danh sách phía dưới giữ vị trí nhớ của nó.
4.5 Chạm tab Ngân sách khi đang ở trang con vẫn sang danh sách `#/ngan-sach` (luật T-027 mục 2 không đổi) và danh sách về đúng vị trí nhớ của nó.
4.6 Mở hay đóng lớp **không** là rời trang: không ghi đè vị trí nhớ, không đổi `scrollY`.
4.7 Thời hạn nhớ: trong phiên của tab trình duyệt. Tải lại trang hoặc mở link mới: **không quy định** (0 hay vị trí do trình duyệt khôi phục đều được). Nội dung chưa đủ dài lúc khôi phục (đang tải): kẹp ở cuối trang, không báo lỗi.
4.8 **Chạm tab đang xem: đứng yên.** `scrollY` không đổi, không cuộn về đầu, không thêm bước lịch sử (khớp `goTab` cùng địa chỉ không làm gì).
4.9 Không thêm, không bớt một bước lịch sử nào so với T-030; cuộn không bao giờ tạo bước lịch sử và không đổi địa chỉ.

### 5. Lớp mở thì khoá cuộn nền
5.1 Khi có **ít nhất một lớp** mở: lăn, kéo, hay phím cuộn trên lớp tối, trên phần nền lộ ra, hoặc trên chính lớp **không làm `window.scrollY` đổi** và không làm nội dung nền dịch (mốc nội dung nền giữ nguyên toạ độ trong màn hình, sai số 1px) từ lúc mở tới lúc đóng. Lúc **vừa mở** nền cũng không nhảy (cùng sai số).
5.2 Đóng lớp bằng **bất kỳ cách nào** (Back, nút đóng, chạm lớp tối, chạm ngoài khung theo INV-005/006) → `scrollY` và mốc nền về đúng như trước khi mở (sai số 1px); lăn lại bình thường được; không có khung con **nằm ngoài lớp** nào bị kẹt `scrollTop > 0` (bên trong lớp được miễn, mục 1.2).
5.3 Lớp có nội dung dài (sheet, danh sách tin nhắn chat) vẫn **cuộn bên trong chính nó**; cuộn tới đầu/cuối lớp rồi tiếp tục lăn **không** chuyển sang cuộn nền.
5.4 **Đặt theo vùng nhìn thấy, không theo chiều cao trang**: sheet dính đáy vùng nhìn thấy; lớp tối (scrim) phủ cả vùng nhìn thấy trong bề rộng khung, nên chạm vào mép trên màn hình (vẫn trong khung) đóng sheet; mọi phần tử phủ rộng đúng bằng khung và căn giữa (INV-003). Không dựa vào việc khung là containing block của `position: fixed`.
5.5 Nhiều lớp chồng nhau (INV-006): khoá giữ tới khi lớp cuối cùng đóng.

### 6. Chat AI
6.1 Chat AI là lớp (mục 5). Hình dạng giữ như hiện nay: bảng trượt lên từ đáy, chừa dải lớp tối phía trên (khoảng 64px), có nút "Đóng" nằm trong vùng nhìn thấy ở nửa trên màn hình, **ô nhập tin nhắn thấy trọn trong vùng nhìn thấy, sát đáy**.
6.2 Danh sách tin nhắn cuộn **bên trong** bảng (được phép theo 1.2/5.3); mở chat không làm nền trôi (5.1) và đóng chat trả nền về đúng vị trí (5.2).
6.3 Chat đóng thì không chiếm chiều cao cuộn của trang, không nhận chạm (mục 2.1 áp dụng).
6.4 Bàn phím ảo của iOS: ô nhập vẫn thấy ngay trên bàn phím. Chromium không có bàn phím ảo iOS: kiểm bằng checklist (D15).

### 7. Khung và bề ngang
7.1 Khung rộng đúng `min(vùng nhìn thấy, --app-max)`, tối đa 768px, căn giữa ở 320-1280 (INV-001; thêm đo qua thanh tab ở 320/360/390/768/1024/1280).
7.2 Không cuộn ngang ở 320-1280 ở mọi trang, kể cả sau khi cuộn tới cuối và lăn ngang (`scrollWidth <= clientWidth`, `scrollX = 0`).
7.3 Ở viewport rộng hơn khung, lăn chuột trong khung cuộn document. Viền/bóng quanh khung vẫn theo INV-004.

### 8. Khối gợi ý cài ẩn khi kéo nội dung lên, hiện khi kéo xuống
(Quyết định của Capu: "Ẩn khi cuộn lên", giống thanh của Safari. "Kéo nội dung lên" = `scrollY` tăng.)
8.1 **Hiện** ở `scrollY = 0` và lúc mới tải/đổi trang.
8.2 **Ẩn** khi `scrollY` đã tăng **≥ 8px** kể từ điểm thấp nhất gần nhất (điểm mà hướng cuộn đổi từ xuống sang lên, hoặc đầu trang). Tăng dưới 8px thì giữ nguyên trạng thái (chống rung).
8.3 **Hiện lại** khi `scrollY` đã giảm **≥ 8px** kể từ điểm cao nhất gần nhất, hoặc khi về `scrollY = 0`. Giảm dưới 8px thì giữ nguyên.
8.4 Đổi trang (chạm tab, Back, Forward) đưa khối về **hiện**; việc khôi phục vị trí cuộn của mục 4 **không** tính là người dùng kéo nên không làm khối ẩn.
8.5 Khi **ẩn**: khối không thấy được trong vùng nhìn thấy, không nhận chạm, không nhận focus; thanh tab vẫn dính đáy; không chữ nào bị che (3.4). Ẩn hay hiện **không làm `scrollY` đổi và không làm nội dung dịch** (mốc nội dung nền sai số 1px), và không tạo vòng ẩn-hiện-ẩn ở cuối trang: ở cuối trang khối ẩn rồi đứng yên (không dao động). Cách đạt (ví dụ vẫn để chỗ trống dưới nội dung) do Engineering chọn.
8.6 Có lớp mở thì khối ẩn (ADR-011). Đóng hết lớp thì khối **trở về đúng trạng thái trước khi mở lớp** (đang ẩn thì vẫn ẩn, đang hiện thì hiện); lớp khoá cuộn nên trong lúc đó không đổi theo hướng cuộn.
8.7 "Không nhắc lại" bấm ở đầu trang vẫn tắt khối (và nhớ ở `localStorage`, không gửi đi) như T-027. Bất biến `navigation/inv-006` (gợi ý cài tôn trọng lựa chọn) **vẫn đúng**: nó chỉ đo khối ở đầu trang chưa cuộn (hiện, bấm "Không nhắc lại", biến mất, nhớ qua tải lại), đã đọc `lib/nav_check.cjs` mục 6; điều kiện là khối **phải hiện ở đầu trang chưa cuộn**.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-054-cuon-cap-trang` · Vùng (`area`): `planner/front/layout`
- Bất biến của vùng đã đọc: `eval/invariants/_shared`, `planner/front/layout`, `navigation`, `budget` (đều xanh trên main). Spec này **không vi phạm** INV nào theo cách đọc; xem "Bất biến bị thay hay bị đe doạ" cho những chỗ cài sai sẽ làm đỏ.
- Kiến trúc: giữ `.app-frame` làm cột 768px và `:root { --app-max: 768px }`; giữ `src/nav.js` (hash, bước lịch sử, lớp) **không đổi hành vi**. Việc nhớ vị trí cuộn là phần thêm, không được đổi `history.state` mà `nav.js` đang dùng (`{ th, layers, idx }`) theo cách làm hỏng T-030.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, trang admin (`/?admin`), backend, nội dung chữ/màu/biểu tượng.
- Bậc lưới lọc đề xuất: **B**. Lý do: đổi bố cục toàn app nhưng không chạm ranh giới cứng; eval tự động phủ tiêu chí 1-8; tiêu chí 9 (Safari thật) là checklist của Capu nên Capu đọc diff hành vi và tự chạy checklist trước 48 giờ.

## Tiêu chí chấp nhận và eval
Từ thư mục `/home/user/tohong-hq`. `<front>` = thư mục `tohong-front` (vd `/home/user/tohong-front`). Harness build bằng `node_modules/.bin/vite build` ra thư mục tạm, phục vụ bằng máy chủ tĩnh **trong tiến trình eval** (cổng `listen(0)`, kiểm nonce `/__nonce`), kill cả nhóm tiến trình khi xong hoặc khi bị ngắt (bài học T-053), chặn mạng ngoài, API giả trong bộ nhớ, dữ liệu bịa. Một lệnh cho tất cả: `bash eval/T-054/run.sh <front>` (chạy 1-8 rồi 9; dòng cuối PASS hoặc FAIL).

| # | Tiêu chí (có/không) | Eval (lệnh hoặc file chạy được) |
| --- | --- | --- |
| 1 | Mục 1: document cuộn ở bốn tab và trang con (lăn và vuốt cảm ứng), không khung con nào có `scrollTop > 0`, cuộn tới cuối và về đầu được | `bash eval/T-054/run.sh <front> --only 1` |
| 2 | Mục 2: tab ngắn không cuộn được dù tab khác dài; chuyển tab dài sang ngắn thì khoảng cuộn co lại; trang ngắn thì thanh tab sát đáy | `bash eval/T-054/run.sh <front> --only 2` |
| 3 | Mục 3 (trừ safe-area thật): header dính đầu, thanh tab dính đáy, không che chữ ở đầu/cuối, có và không có khối gợi ý cài (UA iPhone), header "Quay lại" của trang con dính | `bash eval/T-054/run.sh <front> --only 3` |
| 4 | Mục 4: nhớ và khôi phục vị trí khi chạm tab, Back, Forward, "Quay lại", từ trang con sang tab khác; trang mới và trang con mở từ danh sách bắt đầu ở 0; hai bước cùng trang dùng chung vị trí | `bash eval/T-054/run.sh <front> --only 4` |
| 5 | Mục 5: lớp mở (sheet Mời, ngăn kéo, chat AI, sheet "Thêm việc" ở Kế hoạch, hộp thoại "Cách hoạt động" ở trang con) thì nền không trôi và không nhảy, đóng giữ đúng vị trí, sheet nằm trong vùng nhìn thấy và dính đáy theo bề rộng khung, chạm lớp tối ở mép trên đóng sheet, lăn lại được | `bash eval/T-054/run.sh <front> --only 5` |
| 6 | Mục 6: chat AI ở 390 và 1024: "Đóng" và ô nhập thấy trọn trong vùng nhìn thấy, mở chat nền đứng yên, đóng nền về chỗ cũ | `bash eval/T-054/run.sh <front> --only 6` |
| 7 | Mục 7: không cuộn ngang ở 320/360/390/768/1024/1280 sau khi cuộn tới cuối và lăn ngang; khung rộng `min(vw,768)` căn giữa; lăn giữa khung cuộn document | `bash eval/T-054/run.sh <front> --only 7` |
| 8 | Mục 8: khối gợi ý cài (UA iPhone) ẩn khi kéo nội dung lên ≥ 8px, hiện khi kéo xuống ≥ 8px hay về đầu trang, ngưỡng chống rung, không đổi scrollY, không dao động ở cuối trang, ẩn khi có lớp và trả đúng trạng thái khi đóng, khôi phục vị trí không làm ẩn, "Không nhắc lại" vẫn tắt được | `bash eval/T-054/run.sh <front> --only 8` |
| 9 | Toàn bộ bất biến `_shared`, `planner/front/layout`, `navigation`, `budget` xanh (bản gốc, chưa sửa) | `bash eval/T-054/run.sh <front> --only 9` (= `bash eval/T-054/run_invariants.sh <front>`) |
| 10 | Safari iPhone thật: thanh địa chỉ thu gọn, thanh dưới ẩn khi vuốt lên và hiện lại khi vuốt xuống; header, thanh tab, safe-area, Back, lớp phủ, chat với bàn phím, khối gợi ý cài | `eval/T-054/checklist.md` (checklist, vì Chromium không có thanh Safari, safe-area thật hay bàn phím iOS; Capu tự kiểm 21 dòng) |

Trạng thái đã đo (Spec Writer, lần sửa v2, 2026-11-04): trên main `3f11d8b` lệnh `--only 1..8` **đỏ** (49 dòng XX trên 181 dòng; TC1, 3, 4, 5, 7, 8 đỏ; TC2 đỏ ở dòng chuyển tab dài sang ngắn và dòng focus Tab vào màn ẩn; TC6 xanh vì chat hiện đã đúng hình dạng, giữ làm chốt chặn); `--only 9` (bất biến) **xanh** (15 file).

Kiểm khả thi: ở v1 Spec critic đã chạy một bản thử riêng (clone của main, ngoài repo) với eval cũ: 185 dòng ok, chỉ 9 dòng `innerScrolled` đỏ (đã sửa ở v2 theo mục 1.2: miễn phần tử trong lớp). **Các dòng mới của v2 chưa được chạy xanh với cài đặt nào**: khung hình đầu tiên (mục 4.2), chạm tab đang xem (4.8), focus Tab (2.1), sheet "Thêm việc" và hộp thoại "Cách hoạt động" (mục 5), toàn bộ tiêu chí 8. Chúng đã chạy hết và đỏ đúng chỗ trên main; bản giả lập CSS của Spec Writer không đủ để kiểm hai lớp mới (thừa chiều cao ảo làm chúng không tới được). Nếu một dòng đo có vẻ đòi điều không làm được, `reject --kind spec` và nêu dòng nào.

## Bất biến bị thay hay bị đe doạ (đề xuất ADR; Chief of Staff ghi, Spec Writer không sửa eval cũ)
Đọc kỹ: **không bất biến nào hiện tại cần sửa hay xoá** để spec này cài được. Hai thứ **không phải bất biến** nhưng bị thay đổi và cần ADR:
1. **Spec T-025, mục "Không làm": "đổi chiều cao khung".** Nay khung đổi từ `height: 100dvh; overflow: hidden` sang cao theo nội dung (tối thiểu bằng vùng nhìn thấy). Đề xuất ADR: "T-054 thay điều khoản không-làm của T-025 về chiều cao khung; bề rộng, `--app-max`, căn giữa, viền/bóng của T-025 giữ nguyên".
2. **Cơ chế neo lớp phủ.** `src/index.css:187` ghi `contain: layout; /* khung là containing block của position: fixed */` và T-025/T-026/INV-003 dựa vào đó để sheet/scrim/toast rộng đúng bằng khung. Khung cao theo nội dung thì cơ chế này không dùng được nữa; hành vi (rộng bằng khung, căn giữa, INV-003/005/006) giữ nguyên, cách đạt do Engineering chọn. Đề xuất ADR ghi rõ "hành vi giữ, cơ chế đổi".

Bất biến có nguy cơ **đỏ do cài sai** (không phải để sửa eval, mà để Engineering biết chỗ phải cẩn thận): `layout/inv-003` (phần tử phủ và thanh tab nằm trong khung, rộng bằng khung ở 1024/1280: bỏ `contain` mà để `inset: 0` thì sheet rộng bằng cả viewport); `layout/inv-005`, `inv-006` (chạm ngoài khung đóng đúng lớp); `layout/inv-001`, `inv-002` (đo `scrollWidth` của khung: bỏ `overflow: hidden` mà để thứ gì tràn ngang thì đỏ); `navigation/*` (thư viện đo chọn nút theo toạ độ trong `innerHeight`, nên nút bị dưới thanh tab hay phải cuộn mới thấy có thể làm đỏ); `budget/inv-004` (hộp thoại "Cách hoạt động"). Một bất biến đỏ khi cài xong = spec rework, không phải sửa eval.

## Bất biến đề xuất (tầng 2)
Spec critic rút vào bể khi spec qua cổng; mỗi cái là một dòng đã chạy được của `check_ui.cjs`, chụp cố định vào `lib/` của thư mục bất biến như T-025.
- **INV-A** (`planner/front/layout`): không có khung con cuộn dọc nội dung chính khi không có lớp mở; document là thứ cuộn (mục 1.1, 1.2; `--only 1`).
- **INV-B** (`planner/front/layout`): thanh tab dính đáy vùng nhìn thấy và header dính đầu ở mọi vị trí cuộn; không che chữ ở đầu/cuối (mục 3; `--only 3`).
- **INV-C** (`planner/front/layout`): lớp mở thì nền không trôi và không nhảy, đóng trả đúng vị trí (mục 5; `--only 5`). Phủ năm lớp: sheet Mời, ngăn kéo, chat AI, sheet "Thêm việc", hộp thoại "Cách hoạt động". **Không mở được trong harness: sheet vendor ở Ngân sách** (cần dữ liệu tìm vendor từ API và nhiều bước chọn); nó có INV-003/005/006 (bề rộng, chạm ngoài) và `budget/inv-004`. Ai thêm lớp mới phải thêm bước mở nó vào đây (qua Chief of Staff), như INV-003.
- **INV-D** (`planner/front/navigation`): vị trí cuộn của mỗi trang được khôi phục khi chạm tab, Back, Forward, "Quay lại"; trang con mở từ danh sách bắt đầu ở 0 (mục 4; `--only 4`).

## Không làm
- Không đổi chữ, màu, biểu tượng, bố cục bên trong từng màn (ngoài việc bỏ khung cuộn con và làm header dính).
- Không đổi `src/nav.js` về hash, bước lịch sử, lớp; không thêm, không bớt bước lịch sử; không đưa vị trí cuộn vào địa chỉ.
- Không làm header tự ẩn khi cuộn; không làm "kéo xuống để tải lại"; không ảo hoá danh sách; không thêm thư viện.
- Không đổi hành vi bên trong lớp: Onboarding, Paywall, sheet, danh sách tin nhắn chat vẫn cuộn bên trong khung của chúng (mục 5.3); trang admin (`/?admin`) giữ nguyên.
- Không thêm khoảng đệm "bù thanh Safari" bằng số cố định; không dùng `100vh` cố định cho khung.
- Không khôi phục vị trí cuộn sau khi tải lại trang (mục 4.7: không quy định).

## Câu hỏi mở
Không. (Câu về khối gợi ý cài đã được Capu quyết: "Ẩn khi cuộn lên", mục 8.)
