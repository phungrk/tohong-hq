# Spec T-035: Bố cục nới rộng, chế độ phóng to và bot ở hai cổng nằm trên cùng (bảng Mô hình)

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-01, `board/T-035.md`, sau khi xem T-034): nhân vật trong bảng Mô hình phải to và sinh động như video tham chiếu: khối rộng ra để nhân vật lao/nhảy mà không che chữ; có chế độ phóng to riêng cho bảng; bot ở Spec Gate và Code Gate không bị viền khối hay đường nối đè lên. Mô hình vận hành: ADR-010.

## Bằng chứng
- Video tham chiếu (`scratchpad/mov/sheet_1.png`, `robots2.png`, `crop_1.png`, đã mở xem): robot chiếm khoảng một phần ba chiều cao ô làm việc, đứng trên cùng, không bị vật gì phủ lên; khi giao thì lao ra khỏi bàn gần một thân người. Chỉ lấy tỷ lệ và ý động, không lấy nhân vật.
- Đo trên dashboard main `55e8e57` (có T-034), `index.html`, bằng Playwright (`eval/T-035/run.sh` cho kết quả ở "Kết quả trên main" của bàn giao): `#model svg` `viewBox="0 0 1000 790"`; ở 1280px svg rộng 1134px (hệ số 1,134), ở 390px rộng 324px (hệ số 0,324). Thân bot (`[data-part=body]`) cao 30 đơn vị = 34px ở 1280, 9,7px ở 390. Hình chính khối: `nd_spec`, `nd_exec`, `nd_respec` 140×96; `nd_intents`, `nd_capu` 120×96; `nd_rework` 130×96; `nd_insight` 160×72; `nd_kr` 340×72; `nd_prod` 240×66; `gt_spec` tròn đường kính 92; `gt_code` đường kính 88 (đơn vị SVG). Chữ khối ở 1280: `.t` 13,0px, `.cap` 11,9px, `.n` 24,9px; ở 390 `.cap` chỉ còn 3,4px (chữ không đọc được ở 390px, đã có từ T-028; chỉ `.n` bù lên 9,7px).
- Biên độ cử động hiện tại do CSS: lao 4 đơn vị (`mc-gr/gl/gd/gu`), nhảy 4 đơn vị (`mc-take`), nhún 3 đơn vị (`mc-work`). Khối cao 96 đơn vị chỉ chứa nổi thân bot 30 đơn vị cạnh chữ, nên T-034 đã giảm biên độ (commit `0ce494c`) để không che chữ (inv-016). Muốn lao ≥ 8 thì phải có chỗ.
- Thứ tự lớp SVG hiện tại (DOM, `index.html` dòng 311): mọi khối, cổng, đường `p_*`, nhãn, rồi `g#chars`, rồi `g#fx_f` (dot), rồi `g#fx_b` (bong bóng). Hệ quả đo được: (1) dot nằm TRÊN nhân vật; dot của `p_exec_gate` kết thúc ở (748,296), nằm trong thân bot của `gt_code` (x 749–771, y 287–317). (2) đường `p_exec_gate` đâm thẳng vào thân bot của `gt_code` (ảnh cận cảnh `scratchpad/p35/zoom-gt_code.png`: mũi tên chui xuống sau bot, viền xanh dày của cổng sáng chạy ngang chân bot). Viền cổng và các đường khác nằm DƯỚI bot (đúng chiều), nhưng bot ngồi ngay trên mép cổng nên nhìn như bị viền cắt.
- **Lỗi có sẵn phát hiện khi viết eval (độ tin cậy cao, ~95%, đã đo):** `#fx_f` (`<g class="fx">`) bị luật `.fx{display:none}` của T-019 (`index.html` dòng 95) ẩn đi: `getComputedStyle(#fx_f).display === "none"`, dot được tạo ra (có `circle`, `opacity=1`) nhưng `getBoundingClientRect().width === 0`, tức dot KHÔNG BAO GIỜ hiện trên màn hình, ở cả bản thường. Ảnh `docs/screenshots/T-028/dot-code.png` không có dot nào. Eval T-028 và bất biến inv-001/002/003/008 không bắt được vì đọc thuộc tính `cx/cy/r` và `opacity`, không đo hiển thị thật. Hệ quả cho T-035: tiêu chí "dot vẫn chạy khi phóng to" và "dot không đè bot" vô nghĩa nếu dot không hiện; spec này bắt buộc dot hiện thật (mục 5).
- Chưa có số liệu người dùng (Capu là người dùng duy nhất). Mọi ngưỡng số ở mục 1 là GIẢ ĐỊNH rút từ ảnh video và từ số đo trên main, tự tin ~65%; chúng được ghi thành số cụ thể để eval đo được, đổi số thì đổi cả eval.

## Giả thuyết
Nếu thân bot to gấp đôi và khối đủ rộng để bot lao ≥ 8 đơn vị mà không che chữ, nếu bot ở hai cổng luôn nằm trên cùng, và nếu có chế độ phóng to riêng, thì Capu nhìn bảng là thấy ngay "ai đang giao cho ai" như trong video, mà không phải nheo mắt. Chỉ số: GIẢ ĐỊNH, không có số đo ngoài `eval/T-035/checklist.md`. Chỉ số bảo vệ: inv-001..016 xanh; 0 lỗi console; khung hình không trễ ≥ 300ms; không cuộn ngang ở 390px.

## Hành vi (người dùng thấy gì)

### 0. Quy ước đo (dùng cho cả spec)
- **Đơn vị SVG (u)** = px hiển thị chia cho `svg.getBoundingClientRect().width / svg.viewBox.baseVal.width`. Chiều rộng `viewBox` **giữ 1000** (mã dot, bong bóng và eval cũ đều chia cho 1000); chiều cao `viewBox` tự do nhưng **≤ 1200** (hiện 790).
- **Thân bot** là `g.mch [data-part=body]`; **cao** = chiều cao `getBoundingClientRect()` của nó. **Hình chính của khối** là `rect` hoặc `circle` con trực tiếp của khối (`:scope > rect, :scope > circle`), như T-031.
- **Lúc nghỉ** = `data-state="idle"` (không dot, không việc). **Che chữ** = hộp bao thân bot giao với hộp bao một `text` nào đó (không nằm trong `.mch`, `.bub`) quá 2u theo CẢ HAI chiều (cùng dung sai với inv-016, không nới).
- Hai viewport chuẩn: **1280×900** (svg rộng 1134px) và **390×844** (svg rộng 324px).
- `#model svg` phải vẫn là phần tử `svg` đầu tiên trong `#model`, và là phần tử duy nhất: nút phóng to **không dùng `<svg>`** (dùng chữ hoặc ký tự), vì mọi eval cũ gọi `document.querySelector('#model svg')`.
- Giữ nguyên mọi `id` hiện có (`nd_*`, `gt_*`, `src_*`, `p_*`, `fx_f`, `fx_b`, `chars`, `sgateQ`, `gateQ`, `krTxt`, ...), `data-block`, `data-part`, `data-state`, `data-dir`, `data-anim` của T-031/T-034.

### 1. Bố cục nới rộng (tiêu chí 1)
Ở **cả hai** viewport chuẩn, lúc nghỉ, với đủ 11 nhân vật:
- **1.1 Cỡ nhân vật.** Thân bot cao **62 đến 100u** (hiện 30u). Hệ quả đo bằng px: **≥ 68px ở 1280** (gấp đôi 34px hiện nay; 62u = 70px) và **≥ 19px ở 390** (gấp đôi 9,7px; 62u = 20px). Mức 62u là sàn: "gấp ≥ 2 lần" theo ý định.
- **1.2 Cỡ khối.** Hình chính của mọi khối có nhân vật có **cạnh nhỏ nhất ≥ 110u** (hiện 66–96u; cổng 88–92u, tính đường kính). Cụ thể cần ≥ 110u ở `nd_intents`, `nd_spec`, `nd_respec`, `nd_exec`, `nd_rework`, `nd_capu`, `nd_insight`, `nd_kr`, `nd_prod`, `gt_spec`, `gt_code`. `nd_rel` và ba `src_*` không có nhân vật, không đổi.
- **1.3 Nhân vật nằm trong khối.** Ở chín khối không phải cổng: hộp bao thân bot lúc nghỉ **nằm trọn** trong hộp bao hình chính (dung sai 0,5u). Ở hai cổng (bot nổi ở mép, xem mục 4): **tâm** thân bot nằm trong hộp bao của cổng và hộp bao thân bot nằm trọn trong `svg` (không bị cắt).
- **1.4 Chữ không thu nhỏ.** Ở 1280: chữ `.t`, `.cap`, `.n` của khối hiển thị ≥ **13,0px, 11,9px, 24,9px** (bằng hiện nay; dung sai 0,15px của làm tròn). Nghĩa là cỡ chữ SVG không được giảm để nhường chỗ cho bot.
- **1.5 Không che chữ.** Lúc nghỉ và ở MỌI trạng thái (work, give theo cả 4 chiều, take, wait), hộp bao thân bot không che chữ nào (định nghĩa mục 0), kể cả nhãn đường (`.lbl`) và chữ của khối khác. Eval đo ở 1280 và 390 trong lúc chạy 12 sự kiện (M4–M18).
- **1.6 Biên độ.** Khi `give`: tâm thân bot dịch theo chiều `data-dir` **≥ 8u** so với chỗ nghỉ (lúc nghỉ). Khi `take`: tâm thân bot nhảy lên **≥ 8u** so với chỗ nghỉ (dung sai làm tròn đo 0,1u). Mọi `give`/`take` quan sát được đều phải đạt (không chỉ cái lớn nhất), và phải quan sát được ít nhất 4 `give` và 4 `take` trong 12 sự kiện của kịch bản. Các ngưỡng T-031 khác giữ nguyên (work nhún ≥ 1,2u; wait đung đưa ≥ 1,2u; không nhún dọc ở wait; 1,0–1,5 giây mỗi cử động).
- **1.7 Bong bóng.** Hộp bao bong bóng của một nhân vật không giao với hộp bao thân bot của chính nhân vật đó (> 0,5u mỗi chiều) ở mọi khung hình. (Hiện bong bóng đặt cách tâm bot cố định 32u phía trên, sẽ đè đầu bot to gấp đôi.) Mọi điều khác của T-031 mục 4 giữ nguyên (trọn trong svg, chữ 9–16px, tối đa 3 bong bóng, 2,0 giây).
- **1.8 Chiều cao tổng.** `viewBox` cao ≤ 1200u (≈ 1361px ở 1280).
- **1.9 390px, bản thường.** Trang không cuộn ngang (`scrollWidth ≤ innerWidth`, inv-006); bảng vẫn **vừa trọn bề ngang** (svg rộng 300–390px, T-028 P2); không có cuộn dọc riêng trong bảng. **Quyết định cho 390:** ở bản thường chấp nhận chữ `.cap` nhỏ (3,4px, đã có từ T-028) và **không** thu nhỏ hay cuộn: nhân vật và dot đọc được (≥ 19px), chữ chi tiết đọc ở chế độ phóng to hoặc hai ngón. Lý do: cuộn ngang bị cấm (inv-006), cuộn dọc riêng trong bảng gây kẹt cuộn trang trên điện thoại.

Ghi chú không ràng buộc cách cài (Engineering tự chọn): có thể xếp nhân vật thành dải riêng phía trên chữ của khối, mỗi khối cao ~150u, cổng đường kính ~130u; con số cuối cùng chỉ cần thỏa 1.1 đến 1.8.

### 2. Chế độ phóng to (tiêu chí 2)
Hợp đồng quan sát (eval đọc đúng các thứ này; không ép cách cài):

| Thứ | Giá trị |
| --- | --- |
| Nút | `button#model-zoom` nằm trong `#model`, `type=button`, nhìn thấy ngay khi mở trang (không phải cuộn trong bảng). Không chứa `<svg>`. |
| Nhãn khi chưa phóng to | chữ hiển thị `Phóng to`; `aria-label="Phóng to bảng Mô hình"`; `aria-expanded="false"`; `#model` không có `role=dialog` và không có `data-zoom`. |
| Nhãn khi đang phóng to | chữ `Thu nhỏ`; `aria-label="Thu nhỏ bảng Mô hình"`; `aria-expanded="true"`. Cùng một nút, đổi nhãn. |
| Trạng thái | `#model[data-zoom="on"]` khi phóng to; khi thoát thì **không còn thuộc tính** `data-zoom`. Khi phóng to: `#model` có `role="dialog"`, `aria-modal="true"` và `aria-label` không rỗng (vd "Bảng Mô hình Eval-Gated 2029, chế độ phóng to"); khi thoát thì bỏ ba thuộc tính này. |
| Cỡ nút | ≥ 44×44 CSS px ở 390; cao ≥ 32px ở 1280. |

**Vào:** bấm nút (chuột, chạm, Enter, Space khi nút có tiêu điểm). Không có cách vào nào khác. **Thoát, ba cách, mỗi cách một lần bấm/nhấn:** (a) bấm lại nút (lúc này ghi `Thu nhỏ`); (b) phím **Esc**; (c) nút **Back** của trình duyệt. Esc khi chưa phóng to **không làm gì** (không rời trang). Back khi đang phóng to **chỉ đóng phóng to và ở lại đúng trang**: không tải lại, địa chỉ (`location.href`) không đổi, mọi trạng thái (dot đang chạy, dữ liệu) giữ nguyên (cách cài gợi ý: `history.pushState` khi vào, `popstate` đóng; thoát bằng nút/Esc thì gọi `history.back()` để không để lại mục thừa; eval đo hành vi chứ không đo cách này).

**Bố cục khi phóng to:** `#model` phủ **toàn bộ khung nhìn** (vị trí 0,0, rộng và cao đúng bằng khung nhìn, nằm trên mọi thứ khác); `overflow:auto` cả hai chiều. **Trang ngoài không bao giờ cuộn ngang**: `document.documentElement.scrollWidth ≤ innerWidth` ở mọi cỡ.
- **Khung nhìn rộng > 480px (vd 1280):** svg rộng **≥ 94% khung nhìn** và ≥ bề rộng bản thường (ở 1280: ≥ 1203px so với 1134px); cuộn dọc bên trong `#model` nếu cao hơn; `#model.scrollWidth ≤ clientWidth` (dung sai 1px), không cuộn ngang ở đâu cả.
- **Khung nhìn ≤ 480px (điện thoại, 390):** svg rộng **≥ 870px** để chữ khối đọc được: `.t` hiển thị **≥ 10px** và `.cap` **≥ 9px** (ADR-015; 10,5 đơn vị × 0,87 = 9,1px). Vì rộng hơn khung nhìn, **`#model` cuộn được cả ngang lẫn dọc bên trong** (`scrollWidth > clientWidth`; `scrollLeft` đặt được > 0), còn trang ngoài không dịch (`window.scrollX = 0`, không tràn ngang). Kéo một ngón cuộn trong lớp phủ chứ không kéo trang: `#model` có `touch-action` khác `none` và `overscroll-behavior` là `contain` hoặc `none`. Hai ngón vẫn phóng được (meta viewport không chặn).
- Nút `Thu nhỏ` cố định trong lớp phủ: luôn nằm trong màn hình và bấm được kể cả khi đã cuộn hết cả hai chiều (`document.elementFromPoint` tại tâm nút trả về chính nút). Nhân vật khi phóng to cao ≥ bản thường và ≥ sàn 1.1 (≥ 68px ở 1280, ≥ 19px ở 390).

**Một bảng duy nhất.** Khi phóng to vẫn chỉ có **một** `svg` trong `#model` và **không id nào trùng** trong `#model` (không nhân bản bảng, không chép sang lớp phủ khác), để toàn bộ logic dot, khối sáng, nhân vật chạy nguyên.

**Tiêu điểm:** khi vào, tiêu điểm chuyển vào nút (`document.activeElement.id === "model-zoom"`); Tab và Shift+Tab không ra khỏi `#model` (nội dung phía sau không nhận Tab); khi thoát (bằng cách nào cũng được) tiêu điểm về `#model-zoom`; vị trí cuộn của trang trở về như trước khi vào (±2px). Mở/thoát nhiều lần không để lại trạng thái (vẫn một svg, không id trùng, trang cuộn được).

**390px (điện thoại), quyết định (ADR-015):** phóng to hiển thị bảng ở cỡ chữ đọc được (svg ≥ 870px), kéo ngang/dọc trong lớp phủ như trên; ngoài lớp phủ, bản thường 390 vẫn vừa bề ngang (1.9).

**Đổi chiều màn hình khi đang phóng to** (390→844px hoặc 1280→390px): vẫn đang phóng to; svg đúng quy tắc của cỡ mới (≤ 480px: ≥ 870px; rộng hơn: ≥ 94%); trang không cuộn ngang.

**Dot, khối sáng, nhân vật khi phóng to (chạy y như bản thường):** bắn các sự kiện M4–M18 khi đang phóng to thì (a) dot hiện ra thật (mục 5), đường kính 7–16px (inv-008), nằm trong svg; (b) khối đích sáng (viền ≥ 2,5px) như T-028; (c) nhân vật `give`/`take` với biên độ ≥ 8u; (d) nhân vật không che chữ; (e) 0 lỗi console; khung hình không trễ ≥ 300ms. `prefers-reduced-motion`: vào/thoát vẫn dùng được (nút, Esc); không dot, nhân vật đứng yên (`data-anim="none"`, như inv-005/inv-012).

### 3. Không đổi
Dot (đường `p_*`, 5 màu, trần 12, 1,2 giây giữa hai chặng), quy tắc khối sáng (viền 3px, nền 18/22%, số đếm > 0 thì sáng), năm trạng thái nhân vật và bong bóng của T-031, chú giải, Bản đồ luồng và các bảng khác: giữ nguyên hành vi T-028, T-032, T-031 (trừ các câu ở mục "Câu nào của T-031, T-028 bị thay").

### 4. Bot ở Spec Gate và Code Gate luôn nằm trên cùng (tiêu chí 3)
Áp cho `g.mch[data-block="gt_spec"]` và `g.mch[data-block="gt_code"]`, ở bản thường (1280 và 390) và khi phóng to. Hai điều, đều đo được:
- **4.1 Thứ tự vẽ.** Không có phần tử vẽ nào (`path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`, `text`, `use`, `image`) nằm **ngoài** `g.mch` của cổng đó, **đứng sau** nó trong thứ tự DOM (tức vẽ sau, đè lên) mà hộp bao hiển thị giao với hộp bao thân bot (> 0,5px mỗi chiều). Ngoại lệ duy nhất: bong bóng `#fx_b .bub` (đã có ràng buộc riêng ở 1.7). Phần tử không hiện (`display:none`, `visibility:hidden`, opacity ≤ 0,05, bbox rỗng) bị bỏ qua. Đo ở lúc nghỉ, và **ở mọi khung hình** khi chạy 12 sự kiện (có dot, `give`, `take`). Gồm: viền khối/cổng (kể cả viền sáng 3px), đường nối `p_*`, đầu mũi tên, nhãn, và **dot**.
  Ngoài ra eval đặt thử một `circle` vào `#fx_f` ngay tâm thân bot và kiểm nó vẫn nằm dưới bot (không phụ thuộc lúc dot chạy qua). (Không dùng `elementsFromPoint`: `.mch` có `pointer-events:none` nên không bao giờ nằm trong kết quả.)
- **4.2 Đường nối không cắm vào bot.** Lúc nghỉ, **không** đường `p_*` nào đi qua hộp bao thân bot của hai cổng nới 2u mỗi phía (lấy mẫu mỗi 2u dọc đường). Hiện `p_exec_gate` (đầu mũi tên ở (748,296)) cắm vào bot của `gt_code`. Chuyển bot lên mép trên cổng hay dời đầu mút đường là việc của Engineering; chỉ cần đo ra không cắt.
- Cách cài gợi ý (không ràng buộc): `g#chars` đứng sau `g#fx_f` trong DOM. Được phép áp cho cả 11 nhân vật; chỉ hai cổng là bắt buộc.

### 5. Dot nhìn thấy được (sửa lỗi có sẵn, bắt buộc)
`#fx_f` không được bị ẩn. Khi có sự kiện, ít nhất 10 khung hình có `circle` trong `#fx_f` với `getBoundingClientRect().width > 0` (đo tại bản thường 1280 trong 12 sự kiện M4–M18) và đường kính hiển thị 7–16px ở 1280 và ở 390 (inv-008, T-028). Thay đổi tối thiểu chỉ là CSS (thêm `#model .fx{display:inline}` hay đổi tên lớp). Đây là sửa **hành vi đã được spec ở T-028** (dot hiện) nhưng chưa bao giờ đúng trên main; không đổi đường, màu, 12 dot, 1,2 giây.

### 6. Hiệu năng và giữ hành vi cũ (tiêu chí 4)
- Mọi bất biến `inv-001..016` xanh; eval T-028 (tiêu chí 1, 2, 4, 6–10; tiêu chí 3 khối sáng đã bị T-032 sửa có chủ đích và đỏ trên main từ T-032, do eval T-032 và inv-004/009 giữ; tiêu chí 5 của T-028 chạy kèm C3 nên bỏ, phần "không dot giả, trần dot" do inv-001/002 giữ), T-032 và T-031 (bản đã sửa, xem dưới; ảnh đối chiếu `--task T-034`) xanh.
- 40 sự kiện cùng lúc: khung hình không trễ ≥ 300ms và ≤ 12 dot, ở bản thường và khi phóng to. 0 lỗi console.
- Bản thường 1280 ở `reduced-motion`: không dot, nhân vật đứng yên (lệch ≤ 0,3u).
- `eval/T-035` và các eval cũ chỉ đọc `index.html`; **không** thêm thư viện, không gọi mạng thật, không đổi `dashboard.json` hay kênh live.

## Câu nào của T-031, T-028 bị thay (chỉ những câu này)
- **T-031 mục 1 "Vị trí và cỡ"**, câu "chiều cao hiển thị trên màn hình 20 đến 56 px ở 1280px và 9 đến 56 px ở 390px (thân cao 30 đơn vị SVG ở trạng thái nghỉ là đạt cả hai)" → **thay bằng** mục 1.1 của spec này: thân cao 62–100u; ≥ 68px (≤ 114px) ở 1280; ≥ 19px (≤ 56px) ở 390. Các câu khác của mục đó (tâm trong khối, không che chữ quá 2 đơn vị) giữ nguyên. Lý do trần 56→114 ở 1280: 56px nhỏ hơn 68px sàn mới (bản thân yêu cầu "gấp 2" mâu thuẫn trần cũ). Trần ở 390 giữ 56.
- **T-031 mục 6 "Màn hình 390px"**: "nhân vật cao ≥ 9px" → "≥ 19px". Các ý khác giữ nguyên.
- T-031 mục 4 (bong bóng): thêm 1.7 (không đè thân bot chủ). Không đổi câu nào.
- **T-028** không bị thay câu nào; mục 5 của spec này **thực thi** đúng câu "dot là phần tử circle ... chạy dọc đường" của T-028 mục 1 (dot phải hiển thị).
- Giữ nguyên: inv-001..016 (không đổi bất biến nào; xem bảng dưới).

## Eval và bất biến cũ phụ thuộc số đo hay toạ độ (cách cập nhật)
Đã đọc mã từng file (không chỉ đọc tên); "không đổi" nghĩa là không có toạ độ hay cỡ cứng cần sửa, và sẽ chạy lại nguyên văn trên bố cục mới (tiêu chí 4).

| Eval / bất biến | Phụ thuộc | Việc cần làm |
| --- | --- | --- |
| `eval/T-031/model-characters.cjs` S7 (dòng 344) | cỡ thân 20–56px ở 1280 | **Đã sửa** (Spec Writer): 68–114px, ghi ở "Nhật ký sửa eval" của T-031. Sàn tăng, trần tăng vì mâu thuẫn trực tiếp với yêu cầu (56 < 68). **Chief of Staff phân xử** (mục "Cần phân xử"). |
| `eval/T-031/model-characters.cjs` C8 P2 (dòng 504), P5 (dòng 513) | sàn 9px ở 390 | **Đã sửa**: sàn 19px, trần 56 giữ. Chỉ chặt thêm. |
| `eval/T-031/model-characters.cjs` C3, C4 (biên độ ≥ 1,2/≥ 3/≥ 2u) | biên độ tính bằng đơn vị SVG | Không đổi, vẫn đúng (T-035 thêm ≥ 8 ở tiêu chí 1). |
| `eval/T-031/model-characters.cjs` S6 (tâm trong khối, không che chữ khối đó), C5 bong bóng (trọn trong svg, 9–16px) | hộp bao so với hình chính; vị trí bong bóng tính từ `c.y-32` trong `bubLay` | Không đổi eval; **mã** `bubLay` (đặt bong bóng cách tâm bot 32u) phải theo cỡ bot mới (1.7). |
| `eval/T-031/model-characters.cjs` C12 (ảnh T-031 đã commit), C11 (Bản đồ luồng không đổi byte) | ảnh cũ; vùng khác của trang | Không đổi. Ảnh T-035 ở `docs/screenshots/T-035/`, tiêu chí 5. |
| `eval/T-028/model-dots.cjs` (P0/P6 dot 7–16px, P1/P2 bề ngang bảng 300–390px, P3 số đếm ≥ 9px, mọi phép đo dot theo `p_*`) | đo bằng hệ số `svg.width / viewBox.width`, không toạ độ cứng | Không đổi. (T-028 C3 đỏ trên main từ T-032, ngoài phạm vi; tiêu chí 4 của T-035 bỏ C3 và C5 của T-028.) Cần giữ `id` đường `p_*`, `viewBox` rộng 1000, `.n` ≥ 9px ở 390 (đúng nếu chữ `.n` giữ 30u ở ≤ 480px). **Không bắt được dot ẩn** (đo thuộc tính): đề xuất bất biến mới INV-A dưới đây. |
| `eval/T-032/khoi-sang.cjs` | không dùng toạ độ | Không đổi. |
| `eval/T-034/lib/adv_chars.cjs` (adv-01) và **inv-016** | hộp bao thân vs `text` của khối đó, dung sai 2u, ở 1280 và 390, mọi trạng thái | **Không nới.** Chạy nguyên văn trên bố cục mới; chính nó ép Engineering chừa chỗ cho biên độ ≥ 8u. T-035 thêm 1.5 (mọi `text`, không chỉ của khối đó) thành INV-B đề xuất. |
| inv-001/002/003/004/005/007/008/009/014 | dot, số đếm, khối sáng, màu | Không đổi. inv-003 (dot trên đường p_*) và inv-008 (dot 7–16px khi đổi bề ngang, `dotR()` chia cho `width/1000`) đúng cả khi phóng to vì viewBox giữ rộng 1000. |
| inv-006 (không cuộn ngang 390) | `scrollWidth` | Không đổi; chế độ phóng to cũng phải thỏa (2). |
| inv-010/011/012/013/015 | trạng thái nhân vật khớp khối, opacity idle, reduced-motion, bong bóng có trần, nét vẽ giữ nguyên | Không đổi. Nếu Engineering cho nhân vật co bằng `transform: scale()` thì `stroke-width` thuộc tính không đổi (inv-015 đọc thuộc tính tính ra; xem rủi ro). |
| `tests/model.js`, `tests/characters.js` của repo dashboard | chạy kèm PR | Engineering chạy lại; không có số liệu cứng đã thấy (`tests/model.js` chỉ đặt viewport). |

**Cần phân xử (Chief of Staff, ghi `decisions/` nếu đồng ý):** (1) nâng trần cỡ nhân vật ở 1280 từ 56 lên 114px trong eval T-031 S7 (đã làm trong eval để C4 chạy được; hoàn tác được bằng một dòng nếu không đồng ý). Không có bất biến nào phải sửa hay xoá.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` (một file `index.html`), nhánh `t-035-bo-cuc-phong-to`. Vùng: `dashboard/model`.
- Bất biến của vùng đã đọc: `eval/invariants/dashboard/model/inv-001..016` (và mã trong `lib/`): spec không mâu thuẫn bất biến nào; không đề nghị đổi/xoá bất biến nào.
- Không chạm: `dashboard.json`, kênh live, các bảng khác (Bản đồ luồng, Kanban, ...), màu dot, ánh xạ sự kiện → đường, `nd_rel` và `src_*` (chỉ được dời vị trí nếu cần), âm thanh, robot chạy thật qua đường (việc riêng).
- Bậc lưới lọc đề xuất: **A** (đúng như `board/T-035.md`): giao diện, eval tự động phủ cả năm tiêu chí, không chạm payment/auth/DB/dữ liệu người dùng. Không đề nghị nâng bậc.
- Rủi ro đã biết cho Engineering (không ép cách cài): (a) `.mch` dùng `shape-rendering:crispEdges`, thu phóng bằng `transform: scale(2)` ra nét giống pixel to; vẽ lại đường path to hơn cũng được; (b) CSS cũ `#model .busy rect/circle{stroke-width:3 !important}` khớp mọi `rect/circle` con của khối sáng; nhân vật chỉ dùng `path`, giữ như vậy (inv-015); (c) `.fx{display:none}` (mục 5); (d) `chDir`, `bubLay`, `CH_AT` là toạ độ cứng theo bố cục cũ.

## Tiêu chí chấp nhận và eval
Một lệnh cho mọi tiêu chí, chạy từ thư mục `/home/user/tohong-hq`: `bash eval/T-035/run.sh <repo-dashboard> --task T-035 [--criterion N]`. Mỗi tiêu chí đúng một mục `--criterion`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mục 1 (1.1–1.9): nhân vật cao 62–100u (≥ 68px ở 1280, ≥ 19px ở 390); khối cạnh ≥ 110u; thân trọn trong khối (hai cổng: tâm trong cổng); chữ không nhỏ đi; không che chữ nào ở mọi trạng thái; lao/nhảy ≥ 8u; bong bóng không đè bot; viewBox 1000×≤1200; 390px không cuộn ngang | `cd /home/user/tohong-hq && bash eval/T-035/run.sh <repo> --task T-035 --criterion 1` |
| 2 | Mục 2 và 5: nút/nhãn/aria; vào bằng nút; thoát bằng nút, Esc, Back; tiêu điểm; phủ khung nhìn; không cuộn ngang; một svg; 390px dùng được; đổi chiều màn hình; dot, khối sáng, nhân vật chạy khi phóng to; dot hiện thật; reduced-motion | `… --criterion 2` |
| 3 | Mục 4: bot ở `gt_spec`, `gt_code` luôn trên cùng, không phần tử nào vẽ đè (thứ tự vẽ, dot thử), đường nối không cắm vào bot; dot hiện thật (G0) | `… --criterion 3` |
| 4 | Mục 6: inv-001..016, eval T-028 (trừ C3)/T-032/T-031 xanh; reduced-motion; 0 lỗi console; 40 sự kiện khung < 300ms (thường và phóng to) | `… --criterion 4` (thêm `--no-old` để bỏ ba eval cũ khi chạy riêng) |
| 5 | PR có ảnh đã commit ở HEAD trong `docs/screenshots/T-035/`: `truoc-1280`, `sau-1280`, `truoc-390`, `sau-390`, `phong-to-1280`, `phong-to-390`, `can-canh-gt_spec`, `can-canh-gt_code`, `truoc-can-canh-gt_code` (.png), khác nhau, ≥ 5KB, `sau-390` và `phong-to-390` rộng đúng 390px; chụp lúc đang cử động bằng `--shots` | `… --criterion 5` (chụp: `bash eval/T-035/run.sh <repo> --task T-035 --shots`) |
| (nhìn) | Phần máy không đo được: "to và sinh động như video", bot cổng trông nổi trên cùng, chế độ phóng to thoải mái ở 390 | `eval/T-035/checklist.md` (checklist, vì cảm nhận thị giác không đo được bằng máy) |

Bản "trước" của ảnh lấy từ `--ref` (mặc định `origin/main`) bằng `git show`; không cần chép file.

## Bất biến đề xuất (tầng 2)
Spec Critic rút vào bể khi spec qua cổng (mã mẫu: các hàm `gateViol`, `ovlText`, `pathHit` trong `eval/T-035/bo-cuc-phong-to.cjs`, viết lại thành `inv-0nn-*.sh` theo khuôn `lib/*.cjs`).
- **INV-A (dot nhìn thấy được).** Khi dashboard nhận một sự kiện có đường dot, ít nhất một `circle` trong `#fx_f` có `getBoundingClientRect().width` ≥ 7px (và `getComputedStyle(#fx_f).display !== "none"`). Lỗ hổng bể: inv-001/002/003/008 đo thuộc tính, không đo hiển thị. Bằng chứng: mục Bằng chứng ở trên.
- **INV-B (nhân vật không che chữ nào).** Ở mọi trạng thái, ở 1280 và 390, hộp bao `[data-part=body]` không che quá 2u (cả hai chiều) bất kỳ `text` nào ngoài `.mch`/`.bub` (tổng quát hoá inv-016 vốn chỉ xét chữ của khối đó).
- **INV-C (nhân vật đủ to).** Thân bot cao ≥ 62u (≥ 68px ở 1280, ≥ 19px ở 390) ở cả 11 nhân vật.
- **INV-D (bot ở cổng nằm trên cùng).** Mục 4.1, 4.2.
- **INV-E (chế độ phóng to an toàn).** Khi `#model[data-zoom="on"]`: Esc và Back đều đóng; không cuộn ngang; chỉ một `svg` và không id trùng trong `#model`.

## Không làm
Robot chạy thật qua đường; đổi màu hay ánh xạ dot; các bảng khác ngoài Mô hình; âm thanh; đổi dữ liệu `dashboard.json` hay kênh live; Fullscreen API (không dùng được trên iOS Safari: phóng to bằng lớp phủ CSS); kéo/thu phóng riêng bằng JS (cuộn gốc của trình duyệt trong lớp phủ, hai ngón của trình duyệt); thêm thư viện.

## Câu hỏi mở
Không (đã chốt ở ADR-015: phương án kéo trong lớp phủ).

## Nhật ký sửa eval
- 2026-11-01 (Spec Writer, T-035): đổi `eval/T-031/model-characters.cjs` S7 (20–56 → 68–114px ở 1280), C8 P2 và P5 (sàn 9 → 19px ở 390). Lý do: T-035 mục 1.1; xem bảng trên. Không đổi ý kiểm nào khác.
