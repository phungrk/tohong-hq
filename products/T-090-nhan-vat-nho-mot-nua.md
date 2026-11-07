# Spec T-090: Nhân vật bảng Mô hình nhỏ còn 1/2, khối thu nhỏ tương ứng

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-07, `board/T-090.md`): "Thu nhỏ kích thước character còn 1/2 và kích thước khối tương ứng trên Mô hình Eval-Gated 2029." Sơ đồ gọn hơn; nhân vật (T-031/T-035) đang to gấp đôi so với lúc đầu và chiếm gần nửa chiều cao mỗi khối.

## Bằng chứng
Đo bằng Playwright trên dashboard `origin/main` (index.html 1350 dòng; `CH_S=2.2`, `CH_TOP=52`; `viewBox 0 0 1000 1100`), 2026-11-07, ở 1280 (svg rộng 1134px, hệ số 1,134) và 390 (324px, hệ số 0,324); đơn vị u = px chia hệ số:
- Thân `g.mch [data-part=body]` lúc nghỉ: **48,4 × 66u** ở cả 11 nhân vật (74,8px ở 1280; 21,4px ở 390). Nhân vật đầy đủ (hộp bao các phần đang hiển thị: thân, mũ/đèn, đạo cụ, tay) cao 79,2–85,8u, rộng 57,2–81,4u (bảng ở `eval/T-090/nhan-vat-nho.cjs`, hằng `FULL0`).
- Khối: chín khối có nhân vật là `rect` cao **176u** (`nd_insight` 160u), rộng 150–340u; `gt_spec`, `gt_code` là vòng tròn đường kính 124u. Trong khối cao 176u: thân cách mép trên 19u, cao 66u, cách chữ `.t` bên dưới 21,5u; chữ (`.t`, `.n`, `.cap`) chiếm 106–170u tính từ mép trên. Nghĩa là nhân vật chiếm khoảng 85/176 = 48% chiều cao khối, chữ ~38%, đệm ~14%.
- Nhân vật là `g.mch` nhận `transform="translate scale(CH_S)"`; thu nhỏ một nửa tức là `CH_S` 2,2 → 1,1 (nét vẽ 1 đơn vị gốc giữ nguyên thuộc tính, không đổi `stroke-width`).
- Bố cục dọc: các hàng khối ở y = 96, 328, 562, 672 (Production), 782 (Insight); khối đứng chồng theo hàng nên mỗi khối thấp đi ~38u thì cả bảng thấp đi ~110u (mô phỏng thô ở `eval/T-090/screenshots/mo-phong-sau-1280.png`: viewBox 1100 → 986, các đường nối chưa nối lại, chỉ để thấy cỡ).
- **Lỗi có sẵn phát hiện khi đo (độ tin cậy cao, ~95%, đã đo ở 1280/844/390):** chú thích khối `nd_capu` do mã sinh ra ("0 leo thang · 0 chờ quyết/chặn · 0 diff hành vi chờ đọc", `setNode('nd_capu'…)`) rộng 268u trong khối rộng 190u: chạy ra ngoài khối và ra ngoài `viewBox` (x 756 → 1024 > 1000), bị cắt ở mép svg. Capu yêu cầu "chữ trong khối không bị che hay cắt" nên tiêu chí 2 nhận lỗi này vào phạm vi (rút ngắn hoặc xuống dòng chú thích; không đổi nghĩa).
- Chưa có số liệu người dùng (Capu là người dùng duy nhất). Mọi ngưỡng số là GIẢ ĐỊNH rút từ số đo trên main và từ chữ của Capu, tự tin ~65%.

## Giả thuyết
Nếu nhân vật nhỏ còn một nửa và khối thấp đi đúng phần nhân vật nhường ra thì bảng Mô hình thấp hơn khoảng 10% (1100 → ≤ 1040u) và chữ khối (không đổi cỡ) chiếm tỉ lệ lớn hơn, Capu đọc chữ dễ hơn mà vẫn thấy ai đang giao cho ai. Chỉ số: GIẢ ĐỊNH, đo bằng `eval/T-090`. Chỉ số bảo vệ: bất biến `hq/dashboard/model` xanh (trừ inv-019); 0 lỗi console; không cuộn ngang ở 390.

## Hành vi (người dùng thấy gì)

### 0. Quy ước đo (dùng cho cả spec)
- **u** = px hiển thị chia `svg.getBoundingClientRect().width / svg.viewBox.baseVal.width`; chiều rộng `viewBox` **giữ 1000**.
- **Thân** = hộp bao `g.mch [data-part=body]`. **Nhân vật đầy đủ** = hộp bao của mọi `path` trong `g.mch` đang hiển thị lúc nghỉ (không `display:none`, độ mờ tích lũy > 0,05; mồ hôi, giấy, vệt lao, dấu hỏi ẩn lúc nghỉ nên không tính). **Lúc nghỉ** = `data-state="idle"`. **"Mốc trước"** = số đo ở mục Bằng chứng, đóng cứng trong eval.
- **Viewport đo:** 1280×900, 1440×900, 1920×1000, 844×900, 390×844 (bản thường) và 1280×900, 1440×900, 390×844 khi phóng to (`button#model-zoom`). "Mọi viewport" trong ý định nghĩa là tám tình huống này (v2 thêm 1440, 1920 vì `.page` rộng tới 1400px). Vì nhân vật và khối cùng nằm trong một `viewBox` rộng 1000 nên tỉ lệ đo bằng u đúng ở mọi viewport; eval vẫn đo ở cả tám để bắt trường hợp CSS đổi theo cỡ màn hình.
- **Cách hiểu đã chọn cho "kích thước nhân vật":** hộp bao ở **toạ độ màn hình** (`getBoundingClientRect`) chia cho hệ số svg, **không** đọc thuộc tính `viewBox` hay `transform` (đo hành vi thấy được, không đo mã). Có hai số đo: thân và nhân vật đầy đủ; **cả hai** phải bằng 1/2 mốc trước của chính nó, **cả rộng lẫn cao**.

### 1. Cỡ nhân vật (tiêu chí 1)
Ở mọi viewport trên, lúc nghỉ, với đủ 11 nhân vật:
- **1.1** Thân rộng và cao bằng **0,45–0,55** mốc trước (mốc 48,4 × 66u) tức 21,8–26,6u × 29,7–36,3u.
- **1.2** Nhân vật đầy đủ rộng và cao bằng **0,45–0,55** mốc trước của chính nhân vật đó (bảng `FULL0`).
- **1.3** Sàn tuyệt đối (để chặn thu quá tay): thân cao ≥ 29,7u; ≥ 33px ở 1280; ≥ 9px ở 390.
- **1.4** Mười một nhân vật đều đạt 1.1–1.2 (không thu riêng vài cái); vì mốc rộng và cao đều bị ràng 0,45–0,55 nên nhân vật không bị bóp méo quá ±10%.
- Không đổi: hình vẽ, màu, đạo cụ, 5 trạng thái, bong bóng, tóm tắt khi bấm, nét vẽ (`stroke-width` thuộc tính).

### 2. Khối thu nhỏ tương ứng (tiêu chí 2)
**Cách hiểu đã chọn cho "khối tương ứng":** khối **chỉ thấp đi** đúng phần chiều cao nhân vật nhường ra; **bề ngang giữ nguyên** vì chữ trong khối quyết định bề ngang và chữ **không** được thu (T-035 1.4: `.t` ≥ 13,0px, `.cap` ≥ 11,9px, `.n` ≥ 24,9px ở 1280; cỡ SVG `.node .t` ≥ 11,5, `.cap` ≥ 10,5, `.n` ≥ 22 — các ngưỡng này giữ nguyên, không nới). Cách hiểu thứ hai ("thu cả hai chiều theo cùng tỉ lệ 1/2") làm chữ nhỏ một nửa hoặc tràn ra ngoài khối, trái yêu cầu "chữ không bị che hay cắt", nên bị loại; xem Câu hỏi mở.
- **2.1 Chiều cao.** Chín khối có nhân vật (`nd_intents`, `nd_spec`, `nd_respec`, `nd_exec`, `nd_rework`, `nd_capu`, `nd_insight`, `nd_kr`, `nd_prod`) **thấp đi 30–46u** so với mốc (176 → 130–146u; `nd_insight` 160 → 114–130u). Con số lấy từ phần nhân vật nhường ra: thân bớt 33u, nhân vật đầy đủ bớt 36–43u, lấy khoảng 38 ±8. Hai cổng `gt_spec`, `gt_code`: **đường kính nhỏ đi 30–46u** (124 → 78–94u). `nd_rel` và ba `src_*` không có nhân vật: **giữ nguyên cỡ** (±1u).
- **2.2 Bề ngang.** Rộng mỗi khối có nhân vật nằm trong ±10% mốc (`nd_intents` 150, `nd_spec` 165, `nd_respec` 160, `nd_exec` 180, `nd_rework` 155, `nd_capu` 190, `nd_kr` 340, `nd_prod` 240, `nd_insight` 160).
- **2.3 Nhân vật vừa khối.** Ở chín khối không phải cổng: thân nằm giữa khối theo chiều ngang (lệch ≤ 3u); thân cách mép trên khối 0–24u; đáy thân cách chữ ngay bên dưới 2–24u (mốc trước 19u và 21,5u: không dính chữ, không để trống thừa); nhân vật đầy đủ không nhô quá mép trên khối quá 3u (mũ, đèn). Ở hai cổng: tâm thân cách tâm vòng ≤ nửa bán kính (và vẫn thỏa inv-020: bốn góc thân cách tâm ≤ bán kính − 2u).
- **2.4 Chữ không bị che hay cắt.** Mọi `text` hiển thị của khối (kể cả `.cap` và chú thích do mã sinh, và chữ khối `nd_kr` trong `#krTree`) nằm trọn trong hình chính của khối (dung sai 0,5u) và trong `viewBox`; chữ của cổng không đè vòng cổng (> 0,5u); thân nhân vật lúc nghỉ không đè chữ nào quá 2u theo cả hai chiều. **Gồm cả chú thích `nd_capu` (lỗi có sẵn, mục Bằng chứng).** Trạng thái chuyển động (lao, nhảy, work, wait) do inv-016/018 giữ (tiêu chí 3).
- **2.5 Khối không chồng nhau, nằm trong `viewBox`;** `viewBox` cao ≤ **1040u** (hiện 1100; các hàng khối co theo, không để khoảng trống). Con số 1040 là GIẢ ĐỊNH (3 hàng × ~38u = ~114u, lấy sàn 60u cho an toàn), tự tin ~60%.
- **2.6 390px.** Bản thường và khi phóng to: trang không cuộn ngang (`scrollWidth ≤ innerWidth`).
- **Đường nối, mũi tên, nhãn:** khối đổi chỗ nên các đường `p_*` và nhãn `.lbl` phải được vẽ lại cho nối đúng khối mới; tuyến (khối nào nối khối nào) giữ nguyên. Không có ràng buộc toạ độ cụ thể, chỉ có bất biến inv-029/030/031/032, inv-003, inv-020 ở tiêu chí 3.

### 3. Mọi thứ khác vẫn chạy (tiêu chí 3)
Dot, khối sáng, số đếm, nhân vật 5 trạng thái, bong bóng, tóm tắt khi bấm (T-037), phóng to (T-035), mũi tên (T-039/T-047), reduced-motion: không đổi hành vi. Tất cả bất biến trong `eval/invariants/hq/dashboard/model/` (inv-001..032, trừ inv-019) chạy trên bản mới và xanh. Biên độ lao/nhảy CSS (≥ 8u, T-035 1.6) giữ: ngưỡng là max(8u; 0,25 × thân) = 8,25u với thân 33u, hiện lao 9u nên đạt; Engineering không thu biên độ theo nhân vật.

### 4. Ảnh trước/sau (tiêu chí 4)
Bốn ảnh `docs/screenshots/T-090/{truoc,sau}-{1280,390}.png` của vùng `#model` đã commit ở HEAD của repo dashboard: đủ bốn, khác nhau, ≥ 5KB, rộng đúng 1280/390px, và mỗi ảnh "sau" **thấp hơn** ảnh "trước" cùng cỡ. Ảnh "trước" mẫu đã chụp sẵn ở `eval/T-090/screenshots/truoc-{1280,390}.png` (chụp từ main, cùng fixture); Engineering dùng lại hay chụp lại bằng `bash eval/T-090/run.sh <repo> --shots <thư-mục> --label truoc|sau`.

### 5. Bề ngang trang tăng lên 1400px (tiêu chí 5, v2)
Ý định (Capu, nguyên văn ở Câu hỏi mở): bề ngang trang trên PC tăng từ `max-width: 1200px` lên `1400px` (`index.html` dòng 26, `.page{max-width:1200px;margin:0 auto;padding:24px 16px 48px;…}`).
- **5.1** `getComputedStyle(.page).maxWidth` = `1400px`. `.page` rộng `min(viewport, 1400)px` (±1px): 1440 và 1920 → 1400px; 1280 → 1280px; 844 → 844px; 390 → 390px. Padding, margin, khoảng cách dọc giữ nguyên.
- **5.2** Ở 390, 844, 1280, 1440, 1920: trang không cuộn ngang; mọi phần tử con trực tiếp của `.page` (KPI, Đội ngũ, Bản đồ luồng, Mô hình, Cảnh báo, Kanban, Dòng thời gian…) nằm trong `.page`.
- **5.3** `#model svg` rộng ≥ 90% `.page` ở viewport > 480px (co giãn theo bề ngang trang: ~1334px ở 1440 và 1920, ~1214px ở 1280) và không tràn `.page`; ở 390 vẫn 300–390px (T-028 P2).
- **5.4** Bản đồ luồng (d3 dựng theo `clientWidth`) vẫn vừa khung chứa.
- **5.5** Phóng to ở 1280, 1440, 1920: svg ≥ 94% khung nhìn, không cuộn ngang trong `#model`, trang không cuộn ngang (T-035 mục 2 giữ nguyên).
- **Không đổi hành vi ở 844 và 390** (`.page` đã kín khung nhìn; 0 thay đổi px). **Ở 1280 hành vi giữ nhưng kích thước px đổi:** trước đây `.page` bị chặn ở 1200px nên 1280 trông như 1232; nay `.page` = 1280px nên svg 1134 → 1214px (+7%), thân nhân vật px × 1,07. Đây là hệ quả của yêu cầu, không phải lỗi.

## Hệ quả của max-width 1400 (đã kiểm, Product 2026-11-07)
Đo bằng Playwright trên bản vá thô trong scratchpad (chỉ đổi 1200 → 1400): svg `#model` rộng 1134px ở 1280/1440/1920 (trước) → 1214px ở 1280 và 1334px ở 1440/1920 (sau); hệ số 1,134 → 1,214 / 1,334; thân nhân vật cao 74,8px → 80,1 / 88,0px (với CH_S cũ); chữ `.t` 13,0px → 14,0 / 15,3px; không cuộn ngang ở cả bốn cỡ.
- **Đo theo u:** không đổi (u = px chia hệ số svg; `viewBox` giữ 1000). Tiêu chí 1 và 2 đo theo u nên bất kể 1200 hay 1400. Đã thêm 1440 và 1920 vào danh sách viewport của tiêu chí 1-2.
- **Đo theo px:** chỉ có sàn (thân ≥ 33px ở 1280, ≥ 9px ở 390 ở tiêu chí 1.3): rộng ra chỉ làm px lớn hơn nên không đỏ. Hệ quả cho "1/2": ở 1440+ thân nhân vật cao ~44px (33u × 1,334) so với ~88px trước (66u × 1,334); tỉ lệ 1/2 vẫn đúng theo u. Cỡ chữ `.t`/`.cap`/`.n` ở 1440+ lớn hơn 1280 vì svg co giãn (T-035 1.4 chỉ có sàn nên không vi phạm).
- **Quét bể `eval/invariants/hq/dashboard/` (model 32 + gốc 16, và mọi `lib/*.cjs`)**: không file nào chứa hằng 1200 hay chuỗi `max-width`; viewport rộng nhất mọi bất biến dùng là 1280 (mọi `lib` dùng 1280×900 và 390×844; inv-032 thêm 360, 375, 844; `adv_model.cjs` ADV-01 đổi bề ngang tới 1920 để đo đường kính dot 7–16px). Không bất biến nào phụ thuộc `max-width:1200`. Cái duy nhất đổi hành vi số là px ở 1280 (svg 1134 → 1214px). Đã chạy lại toàn bộ bất biến `hq/dashboard` (model 32 + gốc 16) trên bản vá thô chỉ đổi 1200 → 1400: mọi bất biến cho kết quả **y hệt main**: 46 xanh; hai đỏ có sẵn trên main (cũng đỏ khi không vá, không do 1400): `hq/dashboard/inv-015` và `inv-016` (cột Xong, ADR-031, T-089 đang sửa). Eval tiêu chí 5 xanh 23/23 trên bản vá, đỏ 6/23 trên main (đúng chỗ `max-width` còn 1200).
- **Kanban, drawer, modal ở 1440+:** `#capu-modal` và `#model[data-zoom=on]` là `position:fixed; inset:0` theo khung nhìn, không phụ thuộc `.page`; modal panel `width:min(560px,100%)`. Kanban và Dòng thời gian là `section.card` trong `.page`, chỉ rộng ra theo `.page` (tiêu chí 5.2 kiểm không tràn). Không có drawer trong `index.html` origin/main. T-089 (Kanban) sẽ sửa phần Kanban: tiêu chí 5.2 áp cho cả Kanban mới của T-089 (chỉ kiểm nằm trong `.page`, không kiểm cột).
- Bất biến nào đỏ có chủ ý do 1400: **không thêm**; vẫn chỉ inv-019.

## Bất biến sẽ đỏ có chủ ý và đề xuất lời mới (Chief of Staff phân xử qua `decisions/`; Product không tự sửa)
Đã đọc mã cả 32 bất biến của `hq/dashboard/model` (không chỉ đọc tên) và chạy trên main (xem bản bàn giao). Chỉ **một** bất biến mâu thuẫn trực tiếp với ý định:
- **inv-019 "nhân vật đủ to"** (`lib/t035_inv.cjs`, `BODY_MIN_U = 62`, `BODY_MIN_PX = {1280: 68, 390: 19}`): thân 33u sẽ đỏ ở cả hai cỡ. Ngưỡng này sinh ra từ ý định T-035 ("gấp đôi 30u"); T-090 đảo ý định đó. **Đề nghị lời mới:** `BODY_MIN_U = 29.7`, `BODY_MIN_PX = {1280: 33, 390: 9}` (một nửa ngưỡng cũ, làm tròn xuống; vẫn đủ 11 nhân vật), sửa chú thích dòng "thân cao ≥ 62u" tương ứng, ghi ADR dẫn T-090. Eval T-090 tiêu chí 1.3 đã dùng chính các số này. Eval T-090 chạy inv-019 theo danh sách miễn (`T090_EXEMPT`, mặc định `inv-019`); khi Chief of Staff sửa inv-019, chỉ cần đặt `T090_EXEMPT=` (rỗng) để chạy đủ.
- **Không đỏ nhưng phải đo lại sau khi sửa:** inv-029/030/031/032 (mũi tên, suy khối đích bằng hình học, không có toạ độ cứng) và inv-020 (đường không cắm vào thân bot, bot nằm trọn trong vòng cổng ≥ 2u): Engineering nối lại các đường `p_*` cho khối mới. inv-016/018/026 (không che chữ, tóm tắt không che chữ khối) dễ đạt hơn vì thân nhỏ đi nhưng khối cũng thấp đi nên phải kiểm lại, đã nằm trong tiêu chí 3. inv-006 (không cuộn ngang 390): không đổi.
- Eval cũ của việc đã đóng ghi cỡ/toạ độ cũ (`eval/T-031/model-characters.cjs` S7 68–114px, C8 P2/P5 sàn 19px; `eval/T-035/…` 1.1/1.2; `eval/T-047/mui-ten-to.cjs` `ORACLE` toạ độ tuyến): là eval của việc đã đóng, không chạy lại, không sửa (cùng cách ADR-019 xử lý `eval/T-039`). Không phải bất biến.

## Ràng buộc (vòi)
- Chỉ đổi `index.html` dòng 26 cho tiêu chí 5 (`max-width:1200px` → `1400px`); không đổi `padding`, `margin`, `gap`.
- Repo: `phungrk/tohong-hq-dashboard` (một file `index.html`) · Nhánh: `t-090-nhan-vat-nho` từ `origin/main` · Vùng: `hq/dashboard/model`.
- **Không đụng phần Kanban** (T-089 cũng sửa `index.html`): chỉ sửa trong `#model` (khối `nd_*`, `gt_*`, `src_*`, đường `p_*`, nhãn `.lbl`, `buildChars`, `CH_S`, `CH_TOP`, `bubLay`, chú thích `nd_capu`, `viewBox` của bảng Mô hình). Merge xung đột với T-089 do Chief of Staff xử lý theo thứ tự.
- Bất biến đã đọc: `eval/invariants/_shared/` + `eval/invariants/hq/dashboard/model/` (32). Spec này không vi phạm INV nào, trừ inv-019 (đề nghị đổi, mục trên).
- Giữ nguyên mọi `id`, `data-block`, `data-part`, `data-state`, `data-dir`, `data-anim`; `#model svg` là `svg` duy nhất trong `#model`; `viewBox` rộng 1000.
- Không chạm: payment, auth, schema, dữ liệu người dùng; không thêm thư viện, không gọi mạng thật, không đổi `dashboard.json` hay kênh live.
- Bậc lưới lọc đề xuất: **A** (UI thuần, eval tự động phủ cả bốn tiêu chí; ghi chú: inv-019 đỏ có chủ ý cho tới khi Chief of Staff ghi `decisions/`, nên merge phụ thuộc việc ghi này).

## Tiêu chí chấp nhận và eval
Lệnh chung: `cd /home/user/tohong-hq && export NODE_PATH=$(npm root -g) D3=/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js && bash eval/T-090/run.sh <repo-dashboard> --criterion N`

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Ở 1280, 1440, 1920, 844, 390, phóng to 1280/1440/390: thân và nhân vật đầy đủ của 11 nhân vật bằng 0,45–0,55 mốc trước (cả rộng lẫn cao), không dưới sàn 29,7u / 33px / 9px | `bash eval/T-090/run.sh <repo> --criterion 1` |
| 2 | Khối thấp đi 30–46u (cổng: đường kính), bề ngang ±10%, nhân vật vừa khối, mọi chữ trọn trong khối và `viewBox` (kể cả chú thích `nd_capu`), thân không đè chữ lúc nghỉ, khối không chồng nhau, `viewBox` ≤ 1040u, không cuộn ngang ở 390 (thường và phóng to) | `bash eval/T-090/run.sh <repo> --criterion 2` |
| 3 | Mọi bất biến `hq/dashboard/model` (trừ inv-019 có chủ ý) xanh: đường nối, mũi tên, dot, bong bóng, tóm tắt, phóng to chạy | `bash eval/T-090/run.sh <repo> --criterion 3` (chạy 31 bất biến, 4 luồng, ~3 phút) |
| 4 | Bốn ảnh trước/sau 1280 và 390 đã commit ở HEAD, ảnh sau thấp hơn ảnh trước | `bash eval/T-090/run.sh <repo> --criterion 4` |
| 5 | `.page` max-width 1400px: rộng `min(viewport,1400)`, không cuộn ngang 390–1920, mọi khối trong `.page`, `#model svg` ≥ 90% `.page`, Bản đồ luồng vừa khung, phóng to ≥ 94% khung nhìn | `bash eval/T-090/run.sh <repo> --criterion 5` |

Kiểm chứng eval (Spec Writer, 2026-11-07): trên main `--criterion 1` và `2` đỏ đúng chỗ (thân/nhân vật tỉ lệ 1,00; khối cao 176; viewBox 1100; chú thích `nd_capu` tràn); trên bản mô phỏng thô (`CH_S` 1,1, khối thấp 38u, hàng dịch lên, chú thích rút gọn) cả 20 kiểm tra tiêu chí 1 và 27 kiểm tra tiêu chí 2 xanh, nên tiêu chí đạt được. Tiêu chí 4 đỏ cho tới khi có ảnh trong repo dashboard.

## Bất biến đề xuất (tầng 2)
Một, cho Spec critic rút vào bể khi spec qua cổng: **inv-019 viết lại** như mục trên (sàn cỡ nhân vật theo T-090: thân ≥ 29,7u, ≥ 33px ở 1280, ≥ 9px ở 390; vẫn đủ 11). Ngoài ra (tính chất mới, chạy được): **"chữ của khối không bao giờ chạy ra ngoài hình chính của khối hay ra ngoài `viewBox`"** (tiêu chí 2.4, đo bằng `MEASURE` trong `eval/T-090/nhan-vat-nho.cjs` mục D: lỗi `nd_capu` là bằng chứng nó đã vỡ một lần). Không đề xuất bất biến về tỉ lệ 1/2 (ý định của một lần, không phải tính chất phải đúng mãi).

## Không làm
- Không đổi cỡ chữ, bề ngang khối (trong u), màu, hình vẽ nhân vật, số nhân vật, 5 trạng thái, tuyến đường (khối nào nối khối nào), dot, tóm tắt, phóng to.
- Không đụng Kanban hay bảng khác của dashboard (T-089), Bản đồ luồng, chú giải.
- Không sửa bất biến trong bể, không sửa eval của việc cũ.

## Câu hỏi mở
Không. Capu đã trả lời (2026-11-07, nguyên văn): "T-90: giữ kích thước khối đồng thời tăng bề ngang của page trên PC — hiện tại max-width 1200px thì tăng lên max-width 1400px". Hiểu: giữ cách hiểu mặc định (khối chỉ thấp đi, bề ngang khối giữ trong ±10%, tiêu chí 2.2) và thêm yêu cầu `.page{max-width}` 1200px → 1400px (tiêu chí 5).

## Nhật ký sửa spec
- v2 (2026-11-07, Capu trả lời câu hỏi mở): bỏ câu hỏi mở, thêm mục 5 và tiêu chí 5, thêm viewport 1440/1920 vào mục 0; thêm mục "Hệ quả của max-width 1400". Không đổi câu nào của tiêu chí 1-4.
