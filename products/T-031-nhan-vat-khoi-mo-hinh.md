# Spec T-031: Nhân vật bot/người trong khối của bảng Mô hình, sáng và cử động khi khối hoạt động

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-01, `board/T-031.md`): khi một khối trên bảng Mô hình Eval-Gated 2029 đang xử lý, nhân vật (bot cho agent, người cho Capu) trong khối sáng lên và cử động làm việc sinh động như video tham chiếu; khối rảnh thì nhân vật yên, mờ. Khi dot chạy giữa hai khối thì khối gửi có cử động giao, khối nhận có cử động nhận, kèm bong bóng thoại ngắn tiếng Việt.

## Bằng chứng
- Video tham chiếu của Capu, ảnh cắt khung `scratchpad/mov/sheet_1.png`, `robots2.png` (đã mở xem): robot ngồi sau bàn có laptop và bảng tên; khi làm thì mắt sáng, đèn ăng-ten chớp, nhún nhẹ, có giọt mồ hôi; bong bóng thoại ngắn ("đang chờ…", "đi đây!") hiện trên đầu một lúc rồi mất; khi giao thì robot ôm tờ giấy lao sang bàn khác, có vệt tốc độ phía sau; khi rảnh thì ngồi yên, chớp mắt. Chỉ lấy ý tưởng chuyển động, không dùng lại nhân vật, màu hay chữ của sản phẩm trong video.
- Dashboard main `e184780` (`/home/user/tohong-hq-dashboard/index.html`, T-029): `#model svg` viewBox 1000x790 đã có quy tắc khối sáng (class `busy`/`ping`), các hàm `arrive`, `release`, `setLeg`, `emit` của dot (T-028), và các `<g id="g_*">` chứa icon robot/người 13px (`ic-robot`, `ic-human`) ở 9 khối. Khối `nd_rel` cao 40 đơn vị, ba khối `src_*` cao 26 đơn vị.
- Nhân vật pixel art của Bản đồ luồng (T-019, `handoffs/T-019-v1.md`): class `.chr`, `.st-*`, nhịp `steps(1,end)` như sprite, chỉ animate `transform`/`opacity`, `prefers-reduced-motion` tắt animation. Spec này giữ cùng phong cách và dùng tiền tố riêng `mch` để không đụng class cũ (T-019 có `.fx{display:none}`, T-028 dùng `#fx_f`).
- Chưa có số liệu người dùng (Capu là người dùng duy nhất). Mọi con số (thời lượng 1,2 giây, 2,0 giây, 3 bong bóng, opacity rảnh 0,30–0,50, biên độ nhún) là GIẢ ĐỊNH, tự tin ~60%; chúng ghi thành số cụ thể để eval đo được, đổi số thì đổi cả eval.

## Giả thuyết
Nếu mỗi khối có một nhân vật cho thấy "ai đang làm, ai vừa giao, ai vừa nhận, ai đang chờ" thì Capu đọc được trạng thái bảng bằng một cái nhìn, không cần dò viền màu. Chỉ số: GIẢ ĐỊNH, không có số đo ngoài `eval/T-031/checklist.md`. Chỉ số bảo vệ: bảng vẫn không cuộn ngang ở 390px; 0 lỗi console; khung hình không trễ quá 300 ms khi dồn 40 sự kiện; Bản đồ luồng và nhân vật T-019 không đổi một byte.

## Hành vi (người dùng thấy gì)

### 1. Khối nào có nhân vật nào
Mỗi nhân vật là một phần tử `<g class="mch" data-block="<id khối>">` nằm trong `#model svg`. Đúng 11 nhân vật:

| Khối (id) | Tên | Loại (`data-kind`) | Vai |
| --- | --- | --- | --- |
| `nd_intents` | Ý định | `human` | Capu viết ý định |
| `nd_spec` | Spec Writer | `bot` | product |
| `nd_respec` | Spec rework | `bot` | product sửa spec |
| `gt_spec` | Spec Gate | `bot` | spec-critic |
| `nd_exec` | Agent code | `bot` | engineering |
| `nd_rework` | Code rework | `bot` | engineering sửa code |
| `gt_code` | Code Gate | `bot` | adversary |
| `nd_capu` | Capu (người) | `human` | Capu quyết và đọc diff |
| `nd_insight` | Insight | `bot` | insight |
| `nd_kr` | Knowledge Reservoir | `bot` | bot thủ thư bể |
| `nd_prod` | Production | `bot` | bot trực production |

**Không có nhân vật** ở `nd_rel` (khối cao 40 đơn vị, chữ chiếm hết), `src_data`, `src_inc`, `src_fb` (nguồn dữ liệu cao 26 đơn vị, không phải ai đó làm việc). Với các khối này không có `g.mch`, không có cử động, không có bong bóng; nếu dot đi qua thì chỉ khối sáng như T-028. Nhân vật của `nd_kr` và `nd_prod` chỉ có trạng thái `idle` và `take` (hai khối này không có quy tắc A và không phải khối nguồn của đường có dot).

**Hình dạng.** Pixel art vẽ trong trang bằng phần tử SVG (`rect`, `g`, `path`, `circle`), `shape-rendering: crispEdges`; không `image`, `foreignObject`, không `href` ra ngoài trang, không thư viện, không phông. Mỗi nhân vật có đúng các phần tử con đánh dấu bằng `data-part`:

| `data-part` | Có ở | Nghĩa |
| --- | --- | --- |
| `body` | tất cả | thân và đầu; là thứ nhún, lao, nhảy (đo vị trí của nó) |
| `eye` | tất cả (ít nhất 2 phần tử) | mắt; chớp bằng cách thấp lại |
| `lamp` | tất cả | đèn ăng-ten (bot) hoặc viên ngọc trên vương miện (người); màu sáng của nhân vật |
| `sweat` | tất cả | giọt mồ hôi; chỉ hiện khi `work` |
| `paper` | tất cả | tờ giấy; chỉ hiện khi `give` và `take` |
| `speed` | tất cả | vệt tốc độ; chỉ hiện khi `give` |
| `question` | chỉ `human` | dấu `?`; chỉ hiện khi `wait` |

Bot có laptop và thân robot, người có vương miện (cùng ý với Capu của T-019); mỗi bot nên có một đồ phân biệt vai (bút, kính lúp, mũ bảo hộ...): phần này không đo bằng máy, kiểm bằng checklist. Phần tử "hiện" nghĩa là `opacity` tính ra (nhân với opacity các phần tử cha tới `svg`) > 0,05, không `display:none`, không `visibility:hidden`. Mỗi nhân vật có ≤ 40 phần tử SVG con.

**Vị trí và cỡ** (đo trên hộp bao `getBoundingClientRect()` của `[data-part=body]`, không tính phần phụ đang ẩn). Tâm hộp bao nằm trong hộp bao hình chính của khối; hộp bao không chồng lên hộp bao của chữ nào của khối đó (`text`, kể cả `.t`, `.n`, `.cap`) quá 2 đơn vị SVG theo mỗi chiều; chiều cao hiển thị trên màn hình 20 đến 56 px ở 1280px và 9 đến 56 px ở 390px (thân cao 30 đơn vị SVG ở trạng thái nghỉ là đạt cả hai).

### 2. Năm trạng thái
`data-state` của `g.mch` là đúng một trong `idle`, `work`, `give`, `take`, `wait`. **Khối sáng** dùng đúng định nghĩa của T-028 mục 4 (`stroke-width` tính ra của hình chính của khối ≥ 2,5px).

Thứ tự ưu tiên khi nhiều điều kiện cùng đúng: `give` hoặc `take` (cái mới hơn thắng; mỗi cái kéo dài 1,2 giây) > `wait` > `work` > `idle`.

| Trạng thái | Khi nào | Cử động (`data-anim`) | Kéo dài | Màu `lamp` | Phần phụ hiện |
| --- | --- | --- | --- | --- | --- |
| `idle` | Khối không sáng và không có give/take/wait | `blink`: mắt thấp xuống (chớp) 0,2–0,4 giây, mỗi 3–7 giây một lần; thân đứng yên tuyệt đối | Cho tới khi có điều kiện khác | xám (không thuộc 5 màu) | không phần phụ nào |
| `work` | Khối đang sáng (quy tắc A hoặc B của T-028) và không có give/take/wait. Ở `nd_capu`: chỉ khi sáng vì việc `done` bậc B/C chờ đọc diff (quy tắc A-ii), nghĩa là Capu "đọc diff" | `work`: thân nhún theo trục dọc (biên độ cao-thấp ≥ 1,2 đơn vị, chu kỳ 0,4 đến 1,0 giây), tay gõ, đèn chớp | Suốt thời gian khối sáng | màu viền của khối đang sáng (một trong 5 màu T-028) | `sweat` hiện ít nhất một lần trong mọi cửa sổ 3 giây |
| `give` | Một dot **rời** khối này (đầu đường có khối này làm nguồn, kể cả chặng thứ hai của chuỗi M9, M19), tính từ khung đầu tiên dot hiện ra | `give`: thân lao về phía khối đích ít nhất 3 đơn vị rồi về chỗ cũ, ôm giấy, vệt tốc độ ở phía sau. `data-dir` = `left`/`right`/`up`/`down`: chiều có độ lệch tâm lớn hơn giữa khối nguồn và khối đích của đường đó (bằng nhau thì chọn ngang) | 1,2 giây (đo được 1,0 đến 1,5) | màu của dot | `paper`, `speed` |
| `take` | Một dot **chạm** khối này (cuối đường), tính từ lúc dot chạm | `take`: thân nhảy lên ít nhất 2 đơn vị rồi hạ xuống, hai tay đón giấy | 1,2 giây (đo được 1,0 đến 1,5), kể cả khi khối loại nháy (0,6 giây) đã tắt | màu của dot | `paper` |
| `wait` | Chỉ ở `nd_capu`, khi khối sáng vì quy tắc A-i của T-028 (có việc `state=escalated`, mọi chủ việc) | `wait`: thân đung đưa ngang (biên độ cao-thấp ≥ 1,2 đơn vị, chu kỳ 1,0 đến 2,0 giây), tay chống cằm; không nhún dọc như `work` | Suốt thời gian còn việc escalated (không bị cắt ở mốc 10 giây của quy tắc B) | `#d33` | `question` (chớp 1,2 giây) |

Hệ quả (đều phải đúng):
- **Khớp khối sáng:** ngoài lúc `give`/`take`, nhân vật `work` hoặc `wait` thì khối đang sáng, nhân vật `idle` thì khối không sáng; sai lệch không được kéo dài quá 0,3 giây liên tục.
- Sau `give` hoặc `take` hết 1,2 giây, nhân vật trở về `work` (nếu khối còn sáng), `wait` (Capu còn việc escalated) hoặc `idle`.
- Dot bị bỏ vì trần 12 dot (T-028 mục 3) thì không tạo `give`/`take` cho dot đó. Khi `prefers-reduced-motion: reduce` không có dot, nên mọi sự kiện có ánh xạ đều tạo `give`/`take` (xem mục 6).
- Mở trang với sự kiện cũ (trong `dashboard.json` lần đầu hoặc `snapshot` live) KHÔNG tạo `give`/`take`/bong bóng giao-nhận; chỉ trạng thái `work`/`wait`/`idle` theo khối sáng. Riêng `wait` hiện bong bóng `Chờ quyết…` như mục 4.
- Thời điểm: `give` bắt đầu trong khoảng từ 300 ms trước đến 200 ms sau khung đầu tiên dot hiện (opacity > 0,05); `take` bắt đầu trong khoảng từ 200 ms trước đến 300 ms sau khung cuối cùng dot hiện (lúc dot chạm).
- Việc đổi trạng thái chỉ đổi `data-state`, `data-anim`, `data-dir`, `opacity`, màu `lamp` và hiện/ẩn phần phụ; không tạo lại phần tử `g.mch`.

### 3. Mức sáng của nhân vật (đo được)
- `opacity` tính ra của `g.mch`: `idle` trong khoảng 0,30 đến 0,50; mọi trạng thái khác ≥ 0,95. Chuyển mức trong ≤ 0,25 giây (reduced-motion: tức thì, xem mục 6).
- `lamp` ở `idle` có `fill` không thuộc năm màu `#14754d #2b7fb8 #d9931f #d33 #8a5cf6`; ở trạng thái khác `fill` đúng bằng màu ghi ở cột "Màu `lamp`" (sai số mỗi kênh ≤ 3).
- Màu `fill` của `body` đối với nền khối (`fill` tính ra của hình chính khối) có tỉ lệ tương phản ≥ 3,0 ở trạng thái `work` và ≥ 1,5 ở `idle` (đã tính opacity), cả chế độ sáng và tối.

### 4. Bong bóng thoại
- Bong bóng là `<g class="bub" data-block="<id khối>">` nằm trong một lớp mới `<g id="fx_b">` của `#model svg` (anh em với `#fx_f`; **không** nằm trong `#fx_f`, `#fx_f` vẫn chỉ chứa `circle` là dot). Bên trong: `rect` với `data-part="bubble-bg"` và `text` với `data-part="bubble-text"` chứa đúng chữ. Bong bóng chỉ tồn tại trong DOM khi đang hiện.
- Chữ **cố định** theo loại sự kiện (bảng M1–M19 của T-028), độ dài ≤ 16 ký tự, tiếng Việt có dấu, như bảng dưới. Bong bóng mọc ra từ khối có nhân vật: khối gửi hiện chữ "gửi", khối nhận hiện chữ "nhận".
- Hiện trong vòng 300 ms sau khi trạng thái `give`/`take` bắt đầu, và **tồn tại 2,0 giây** (đo được 1,8 đến 2,4 giây tính từ lúc `opacity` > 0,05 đến lúc hết), rồi tự gỡ khỏi DOM. Mỗi khối có tối đa một bong bóng: bong bóng mới của cùng khối thay bong bóng cũ và đếm lại 2,0 giây.
- `wait`: khi nhân vật vào `wait` (kể cả lúc mở trang đã có việc escalated) hiện `Chờ quyết…` **3,0 giây** (đo được 2,7 đến 3,4 giây), một lần cho mỗi lần vào `wait`, rồi tự gỡ dù Capu vẫn đang chờ. Khi vào `wait` ngay sau `take` thì `Chờ quyết…` thay `Cần quyết!` (mục dưới) lúc `take` hết.
- `idle` và `work` không có bong bóng của riêng chúng.
- **Tối đa 3 bong bóng cùng lúc** trong toàn bảng. Bong bóng thứ 4 đến thì bong bóng cũ nhất bị gỡ ngay.
- Hộp bao của bong bóng nằm trọn trong `svg` (được phép đè lên khối khác trong lúc nó hiện). Chữ hiển thị 9 đến 16 px ở mọi bề ngang từ 320 đến 1920px (cỡ chữ SVG bù theo độ co của svg, như dot ở T-028). Tương phản chữ so với `bubble-bg` ≥ 4,5 ở cả chế độ sáng và tối.

Chữ theo sự kiện (cột "gửi" hiện ở khối nguồn nếu khối đó có nhân vật, cột "nhận" ở khối đích nếu khối đó có nhân vật; M9 là chuỗi hai chặng):

| Dòng T-028 | Sự kiện | Khối gửi → chữ | Khối nhận → chữ |
| --- | --- | --- | --- |
| M1 | `assigned` → product | `nd_intents`: `Giao việc!` | `nd_spec`: `Nhận việc!` |
| M2 | `assigned` → engineering | `gt_spec`: `Giao việc!` | `nd_exec`: `Nhận việc!` |
| M3 | `assigned` → insight | (`src_data` không có nhân vật) | `nd_insight`: `Nhận việc!` |
| M4 | `started` engineering vòng ≥ 1 | `nd_rework`: `Sửa xong!` | `nd_exec`: `Làm lại!` |
| M5 | `handoff` từ product | `nd_spec`: `Xong, giao đây!` | `gt_spec`: `Đã nhận!` |
| M6 | `handoff` từ engineering | `nd_exec`: `Xong, giao đây!` | `gt_code`: `Đã nhận!` |
| M7 | `handoff` từ insight | `nd_insight`: `Xong, giao đây!` | `nd_intents`: `Đã nhận!` |
| M8 | `accepted` việc product | `gt_spec`: `Qua cổng!` | `nd_kr`: `Lưu bất biến!` |
| M9 | `accepted` engineering bậc A | `gt_code`: `Qua cổng!` (chặng 1; `nd_rel` không có nhân vật) | `nd_prod`: `Lên sóng!` (chặng 2) |
| M10 | `accepted` engineering bậc B/C/rỗng | `gt_code`: `Qua cổng!` | `nd_capu`: `Diff chờ đọc!` |
| M11 | `accepted` việc insight | `nd_insight`: `Gửi vào bể!` | `nd_kr`: `Lưu insight!` |
| M12 | `rejected` state=spec, product | `gt_spec`: `Trả về!` | `nd_respec`: `Sửa spec!` |
| M13 | `rejected` state=spec, engineering | `gt_code`: `Trả về!` | `nd_respec`: `Sửa spec!` |
| M14 | `rejected` state=rework | `gt_code`: `Trả về!` | `nd_rework`: `Sửa code!` |
| M15 | `respec` | `nd_respec`: `Spec đã sửa!` | `nd_spec`: `Viết lại!` |
| M16 | `evalplus` | `gt_code`: `Thêm eval!` | `nd_kr`: `Vào bể!` |
| M17 | `escalated` → capu | `gt_code`: `Báo Capu!` | `nd_capu`: `Cần quyết!`, rồi `wait` |
| M18 | `decided` (việc làm tiếp) | `nd_capu`: `Quyết rồi!` | `nd_exec`: `Làm tiếp!` |
| M19 | `insight_reports` tăng | `nd_insight`: `Gửi insight!` (chặng 2) | `nd_insight`: `Có insight!` (chặng 1, khi dot chạm); `nd_intents`: `Ý định mới!` (chặng 2) |

Sự kiện không ánh xạ (mọi dòng "bỏ qua" của T-028) không tạo `give`, `take` hay bong bóng nào.

### 5. Quan hệ với khối sáng và dot (không đổi T-028)
Nhân vật là lớp phủ lên hành vi T-028; spec này **không đổi** thứ gì của dot hay khối sáng: đường, màu dot, 12 dot, viền 3px và nền 18/22%, chú giải. Nhân vật suy ra trạng thái từ chính các thời điểm đó (dot rời, dot chạm, khối đang sáng).

### 6. Các tình huống
- **`prefers-reduced-motion: reduce`:** không animation, không transition chạy trên `g.mch` và `g.bub` (`document.getAnimations()` không có phần tử nào trong số đó); thân đứng yên tuyệt đối ở mọi trạng thái; `data-anim` luôn là `none`. `data-state`, `opacity`, màu `lamp`, phần phụ hiện/ẩn, `data-dir` và bong bóng (chữ, thời gian hiện) vẫn đúng như mục 2 đến 4, chỉ không có chuyển động. Thời điểm: không có dot, nên `give` của khối nguồn và `take` của khối đích bắt đầu theo đúng lịch "dot tới ngay" của T-028 mục 6 (chặng đầu ngay khi nhận sự kiện, chặng sau của chuỗi M9, M19 trễ 0,6 giây); sai số 0,4 giây.
- **Màn hình 390px:** không cuộn ngang; nhân vật cao ≥ 9px, bong bóng chữ ≥ 9px và nằm trọn trong svg, nhân vật không che chữ của khối; mọi trạng thái đúng như desktop.
- **Chế độ tối** (`prefers-color-scheme: dark`): mọi tỉ lệ tương phản ở mục 3 và 4 đạt; opacity và màu `lamp` như chế độ sáng.
- **Không có sự kiện:** không `g.bub` nào, không nhân vật nào ở `give`/`take` (kể cả sau 7 giây); nhân vật chỉ `idle`/`work`/`wait` theo khối sáng.
- **Tải lại, kênh live nối lại (`snapshot`):** sự kiện cũ không phát lại `give`/`take`/bong bóng.
- **Dồn 40 sự kiện cùng lúc:** ≤ 3 bong bóng cùng lúc, không khung hình nào trễ quá 300 ms, sau khi xong không còn `give`/`take` nào treo và `#fx_b` rỗng sau 5 giây không có sự kiện (trừ `Chờ quyết…` đang chạy 3 giây).
- **Dữ liệu thiếu** (không `state`, không rõ chủ việc, thiếu `model`): không ném lỗi, nhân vật về `idle`.
- **Đổi bề ngang giữa lúc nhân vật đang cử động** (xoay điện thoại): cỡ nhân vật và cỡ chữ bong bóng vẫn trong khoảng ở mục 1 và 4 (không tính một lần lúc tạo).

### 7. Ngân sách hiệu năng
- `index.html` nặng thêm ≤ 40 960 byte so với bản gốc (`BASE_REF`).
- Mỗi nhân vật ≤ 40 phần tử SVG con; ≤ 11 nhân vật.
- Chỉ animate `transform` và `opacity`: mọi animation chạy trên `g.mch`, con của nó và `g.bub` có keyframe chỉ chứa thuộc tính `transform`/`opacity` (đo bằng `Animation.effect.getKeyframes()`); không `filter`, không `box-shadow`, không `drop-shadow` (`filter` tính ra là `none` ở mọi phần tử con).
- Số animation chạy đồng thời trong `#model`: ≤ 22 khi mọi khối rảnh, ≤ 60 ở mọi thời điểm kể cả lúc dồn 40 sự kiện.
- Khoảng cách hai khung hình liên tiếp ≤ 300 ms khi dồn 40 sự kiện (như T-028).
- Không thêm yêu cầu mạng, thư viện hay thẻ script ngoài; không `setInterval` mới chạy mỗi khung hình (dùng CSS animation cho cử động lặp).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` · Nhánh: `t-031-nhan-vat-mo-hinh` (Engineering điền) · Vùng (`area`): `dashboard/model`.
- Bất biến của vùng đã đọc: `eval/invariants/dashboard/model/` inv-001 (không dot giả), inv-002 (trần 12 dot), inv-003 (dot trên đường p_* và 5 màu), inv-004 (không kẹt sáng), inv-005 (reduced-motion không dot), inv-006 (không cuộn ngang 390px), inv-007 (Capu sáng đỏ khi escalated), inv-008 (dot cỡ 7–16px khi đổi bề ngang). Spec này không mâu thuẫn bất biến nào: `#fx_f` vẫn chỉ có `circle` dot (bong bóng ở `#fx_b`); nhân vật không tạo hay đổi dot, khối sáng, đường; `nd_capu` vẫn sáng đỏ (nhân vật `wait` chỉ đọc trạng thái này).
- Kiến trúc: giữ một file `index.html` tĩnh, d3 như hiện tại; thêm CSS và JS trong file đó. Nhân vật thay thế 9 icon `<use href="#ic-robot|#ic-human">` trong các `<g id="g_*">` của `#model` (chúng chỉ là chỗ giữ icon của T-023); `symbol` `ic-robot`/`ic-human` giữ nguyên. Không sửa Bản đồ luồng, nhân vật T-019 (`.chr`, `.st-*`, `tests/characters.js`), bảng Việc, bảng khác. Không đổi schema `dashboard.json`, không đổi `scripts/live.py`.
- Thay đổi so với main `e184780` (cố ý): thêm 11 `g.mch`; thêm lớp `#fx_b`; bỏ icon `g_*` cũ ở các khối; `tests/model.js` (T-023) phải vẫn xanh, nếu một ý của nó mâu thuẫn spec này thì trả về `spec`.
- Cảnh báo CSS có sẵn: `#model .busy rect`, `#model .node.busy rect`, `#model .res.busy rect` (viền 3px, nền color-mix) khớp **mọi** `rect` con của khối đang sáng, kể cả `rect` của nhân vật. Tương tự `#model .node rect, .res rect, .gate circle {transition: stroke, stroke-width, fill}` (khi không reduced-motion) cũng khớp `rect` của nhân vật. Nhân vật không được bị tô viền 3px, đổi nền hay chạy transition `fill`/`stroke` theo khối: eval đo `fill` của `lamp` và `body` khi khối sáng và kiểm keyframe của mọi animation/transition trong nhân vật chỉ có `transform`/`opacity`.
- Không chạm payment, auth, DB, dữ liệu người dùng. Không gửi gì ra ngoài. Không âm thanh.
- Bậc lưới lọc đề xuất: **A** (đúng bậc Capu đặt): UI tĩnh, eval tự động phủ 11/12 tiêu chí, phần "trông có sinh động không" có checklist.
- Chạy eval cần Playwright (`NODE_PATH=$(npm root -g)`) và d3 cục bộ (`D3=/đường/dẫn/d3.min.js`).

## Hợp đồng quan sát (để eval đọc được; không ép cách cài đặt)
Giữ nguyên bảng của T-028 (`#model`, khối, đường `p_*`, `#fx_f`, `.mlegend`, `#model-live`) và thêm:

| Phần tử | Nội dung |
| --- | --- |
| Nhân vật | `#model svg g.mch[data-block]`, đúng 11 phần tử như mục 1 (không có ở `nd_rel`, `src_*`) |
| Thuộc tính | `data-kind` (`bot`/`human`), `data-state` (`idle`/`work`/`give`/`take`/`wait`), `data-anim` (`blink`/`work`/`give`/`take`/`wait`/`none`), `data-dir` (`left`/`right`/`up`/`down`, chỉ có khi `data-state=give`) |
| Bộ phận | `[data-part]` ∈ `body`, `eye`, `lamp`, `sweat`, `paper`, `speed`, `question` (chỉ `human`) |
| Mức sáng | `getComputedStyle(g.mch).opacity`; màu sáng là `fill` tính ra của `[data-part=lamp]` |
| Lớp bong bóng | `<g id="fx_b">`; mỗi bong bóng là `g.bub[data-block]` chứa `[data-part=bubble-bg]` (`rect`) và `[data-part=bubble-text]` (`text`) |
| Khối sáng | như T-028: `stroke-width` tính ra của hình chính khối ≥ 2,5px |

## Tiêu chí chấp nhận và eval
Lệnh chung (cwd `/home/user/tohong-hq`): `bash eval/T-031/run.sh <thư-mục-repo-dashboard> --task T-031`; thêm `--criterion N` để chạy một tiêu chí. In từng dòng `PASS/FAIL Cn …` rồi `PASS` hoặc `FAIL …`, mã thoát 0/1. Dữ liệu dashboard.json và kênh live đều giả. `--task` bắt buộc cho tiêu chí 12 và `--shots`: tên thư mục ảnh là `docs/screenshots/<task>/`, không có giá trị mặc định.

| # | Tiêu chí (có/không) | Việc ở `board` | Eval |
| --- | --- | --- | --- |
| 1 | Đúng 11 `g.mch` ở đúng 11 khối với đúng `data-kind`; không có ở `nd_rel`, `src_*`; đủ `data-part`; chỉ phần tử SVG nội tuyến, không ảnh/`foreignObject`/href ngoài; ≤ 40 phần tử mỗi nhân vật; tâm trong khối, không che chữ; cỡ 20–56px ở 1280 | 1 | `… --criterion 1` |
| 2 | Khối rảnh: `idle`, opacity 0,30–0,50, `lamp` xám, `data-anim=blink`, thân đứng yên 7 giây, có chớp mắt (ít nhất 1, nhiều nhất 3 lần trong 8 giây), không phần phụ nào hiện, không bong bóng | 2 | `… --criterion 2` |
| 3 | Khối đang xử lý (quy tắc A, không dot): `work`, opacity ≥ 0,95, `lamp` đúng màu viền khối, thân nhún ≥ 1,2 đơn vị, có giọt mồ hôi; Capu đọc diff là `work`; khối khác vẫn `idle` | 2 | `… --criterion 3` |
| 4 | Mỗi dòng M1–M19: `give` ở khối nguồn và `take` ở khối đích đúng lúc, 1,0–1,5 giây, `lamp` đúng màu dot, `data-dir` đúng, `give` lao ≥ 3 đơn vị có `paper` và `speed`, `take` nhảy ≥ 2 đơn vị có `paper`; sau đó trở về `work`/`idle`; nhân vật luôn khớp khối sáng; sự kiện bỏ qua và sự kiện cũ không tạo `give`/`take` | 3 | `… --criterion 4` |
| 5 | Bong bóng đúng chữ ở bảng (cả 19 dòng), ≤ 16 ký tự, tồn tại 1,8–2,4 giây rồi tự gỡ, mỗi khối một bong bóng, ≤ 3 cùng lúc khi dồn 40 sự kiện, ở `#fx_b` không phải `#fx_f`, trong svg, `#fx_b` rỗng sau 5 giây yên | 3 | `… --criterion 5` |
| 6 | Capu có việc escalated: `wait`, `lamp` `#d33`, `question` hiện, đung đưa ngang ≥ 1,2 đơn vị và không nhún dọc, vẫn `wait` sau 12 giây; bong bóng `Chờ quyết…` 2,7–3,4 giây một lần; hết việc thì rời `wait`; M17: `Cần quyết!` rồi `Chờ quyết…` | 4 | `… --criterion 6` |
| 7 | `prefers-reduced-motion: reduce`: không animation/transition trên nhân vật và bong bóng, thân đứng yên, `data-anim=none`, vẫn đúng `data-state`, opacity, `lamp`, bong bóng và thời điểm | 5 | `… --criterion 7` |
| 8 | 390px (không cuộn ngang, nhân vật ≥ 9px, bong bóng chữ ≥ 9px trong svg, không che chữ) và chế độ tối (tương phản thân/nền ≥ 3,0 khi `work`, chữ bong bóng ≥ 4,5, opacity rảnh đúng); đổi bề ngang giữa chừng vẫn đúng cỡ | 5 | `… --criterion 8` |
| 9 | Bất biến `dashboard/model` inv-001 đến inv-008 vẫn đạt (chạy lại 8 script) | 5 | `… --criterion 9` |
| 10 | Hiệu năng: +≤ 40 960 byte; keyframe chỉ `transform`/`opacity`; không `filter`; ≤ 22 animation khi rảnh, ≤ 60 khi dồn 40 sự kiện; không khung hình trễ > 300 ms; 0 lỗi console/pageerror; không script/link/host ngoài mới | 5 | `… --criterion 10` |
| 11 | Mọi phần ngoài `#model` (Bản đồ luồng, nhân vật T-019, bảng khác) giống bản đối chứng (`BASE_REF`, mặc định merge-base với `origin/main`) về HTML, tên animation tính ra và số animation chạy, dưới cùng dữ liệu | 6 | `… --criterion 11` |
| 12 | `docs/screenshots/<task>/` đã commit ở `HEAD` đủ 11 PNG: `idle`, `work`, `work-2`, `give`, `take`, `wait`, `bubble`, `reduced-motion`, `phone-390` (rộng đúng 390px), `dark`, `dark-work`; mỗi tệp khác nhau; tạo bằng `--shots` chụp **giữa lúc đang cử động** (xem dưới) | 7 | `… --criterion 12` |
| (nhìn) | Phần máy không đo được: có "sinh động như video", mỗi vai dễ phân biệt, pixel art đồng phong cách T-019, bong bóng dễ đọc, 390px và chế độ tối thoải mái | 1–5 | `eval/T-031/checklist.md` (checklist, vì cảm nhận thị giác không đo được bằng máy) |

**Cách chụp ảnh (`--shots <thư-mục>` hoặc `--shots` kèm `--task`, thư mục mặc định là `<repo>/docs/screenshots/<task>`).** Eval chờ tới khi trạng thái cần chụp đang thật sự cử động rồi mới chụp, không chụp theo giờ cố định: `work` khi thân đã nhún lệch ≥ 1,2 đơn vị so với chỗ nghỉ; `give` khi đã lao ≥ 3 đơn vị về phía đích; `take` khi đã nhảy ≥ 2 đơn vị; `wait` khi đã nghiêng ≥ 1,2 đơn vị. Ngay khi đạt, eval tạm dừng mọi animation CSS (đóng băng đúng khung cử động) rồi chụp, rồi kiểm lại `data-state` vẫn đúng và độ lệch vẫn đạt. Bất kỳ ảnh nào không đạt điều đó thì `--shots` in `FAIL` và không ghi ảnh. `bubble` chụp lúc có ≥ 1 bong bóng hiện. `work-2` chụp 250 ms sau `work` ở pha khác của nhún (vị trí thân khác `work` ≥ 1 đơn vị).

## Bất biến đề xuất (tầng 2)
Vùng `dashboard/model`; mỗi cái viết được thành eval chạy được từ các ca của `eval/T-031/model-characters.cjs`:
1. **Nhân vật khớp khối sáng:** ngoài lúc `give`/`take`, nhân vật `work`/`wait` thì khối của nó sáng, nhân vật `idle` thì khối không sáng, không lệch quá 0,3 giây (ca C4 và C3).
2. **Rảnh thì mờ:** `g.mch[data-state=idle]` có opacity 0,30–0,50 và thân đứng yên; trạng thái khác opacity ≥ 0,95 (ca C2, C3).
3. **Reduced-motion không cử động:** `prefers-reduced-motion: reduce` thì không animation/transition nào trên `g.mch` và `g.bub` (ca C7).
4. **Bong bóng có trần và tự tắt:** ≤ 3 bong bóng cùng lúc, mỗi bong bóng ≤ 3,5 giây, `#fx_b` rỗng 5 giây sau sự kiện cuối, và `#fx_f` chỉ chứa `circle` dot (ca C5).
5. **Không giao-nhận giả:** mở trang với dữ liệu cũ (dashboard.json, snapshot live) không tạo `give`/`take`/bong bóng giao-nhận (ca C4 phần "sự kiện cũ").
6. **Chỉ animate transform/opacity:** keyframe của animation trong `#model .mch`/`.bub` chỉ gồm `transform`/`opacity` (ca C10).

## Không làm
- Âm thanh; dùng lại nhân vật, màu, chữ hay asset của sản phẩm trong video; thư viện hay ảnh ngoài.
- Nhân vật rời khối đi thật qua các đường (xem Câu hỏi mở): chuyển động giữa hai khối vẫn là dot của T-028; `give` là lao tại chỗ về phía khối đích.
- Nhân vật ở `nd_rel`, `src_data`, `src_inc`, `src_fb`.
- Đổi schema `dashboard.json`, `scripts/live.py`; đổi quy tắc dot, khối sáng, ánh xạ M1–M19 của T-028; sửa Bản đồ luồng, nhân vật T-019, các bảng khác.
- Nhân vật cho từng việc riêng lẻ (mỗi khối đúng một nhân vật, bất kể số việc trong khối).

## Câu hỏi mở
Video của Capu cho robot ôm giấy **chạy thật sang bàn của người nhận**; spec này làm `give` là nhân vật lao tại chỗ về phía khối đích (ôm giấy, vệt tốc độ) còn dot lo phần di chuyển giữa khối, vì cho nhân vật rời khối sẽ chồng lên dot, vi phạm "mỗi sự kiện một dot" và trần 12 phần tử của T-028. Capu có muốn nhân vật chạy thật qua đường (thêm một lớp "người chạy" riêng, có trần riêng) không, hay giữ lao tại chỗ? Nếu không trả lời, spec giữ nguyên lao tại chỗ.

## Nhật ký sửa eval
- 2026-11-01 (Spec Writer, theo báo của adversary trên T-034): C10/P5 (`runBurst` trong `eval/T-031/model-characters.cjs`) đỏ ngẫu nhiên vì đọc `logOf()` trước `statsOf()`, việc kéo cả log làm trang khựng 217–350ms lọt vào `maxGap`. Đổi thứ tự: đọc `statsOf()` trước. Giữ ngưỡng 300ms và mọi ý kiểm khác. Rà T-028 (đã đọc stats trước log), T-029 và invariants/dashboard/model (chỉ đọc stats, không đọc log), T-032 (không đo maxGap), T-034/lib/adv_chars.cjs (có biến maxGap nhưng không dùng để khẳng định): không cần sửa. Chứng minh: C10 xanh 5/5 trên head a62b047 của T-034; bản đột biến thêm vòng bận 400ms mỗi khung vẫn đỏ ở P5.
- 2026-11-01 (Spec Writer, T-035): cỡ nhân vật đổi theo `products/T-035-bo-cuc-phong-to.md` mục 1.1. Sửa `eval/T-031/model-characters.cjs` S7 (20–56 → 68–114px ở 1280) và C8 P2/P5 (sàn 9 → 19px ở 390; trần 56 giữ). Câu thay: mục 1 "Vị trí và cỡ" (chỉ câu cỡ hiển thị) và mục 6 "Màn hình 390px" (chỉ "≥ 9px"). Chờ Chief of Staff phân xử trần 114px.
- 2026-11-01 (Spec Writer, gỡ chặn T-036): C11/O3 không còn bảo vệ `@keyframes mc-*` (keyframes của nhân vật Mô hình, chỉ dùng trong `#model .mch`; T-035 thay biên độ nên phiên bản cũ thành CSS thừa). O3 vẫn bảo vệ mọi luật CSS ngoài `#model` khác (Bản đồ luồng, T-019). Chi tiết: "Nhật ký sửa eval" của `products/T-035-bo-cuc-phong-to.md`.
