# Spec T-037: Bấm vào nhân vật Mô hình để nghe tóm tắt việc đang giữ (bong bóng gõ chữ)

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-01, `board/T-037.md`): bấm vào nhân vật trong khối của bảng Mô hình thì nhân vật nói ngắn gọn việc nó đang giữ, chữ hiện dần như đang gõ. Không gọi AI; chỉ dùng dữ liệu công khai đã có.

## Bằng chứng
- Dashboard nhánh `t-036-bo-cuc-phong-to` @ `2306da9` (`/home/user/tohong-hq-dashboard`, đọc bằng worktree tạm), `index.html`:
  - `drawModel` (dòng ~897-922) quyết định khối sáng bằng bảng `STATECOL` từ danh sách việc trong `x.tasks` (đã gộp dữ liệu live): `specNew`, `specDoing`, `specGate`, `specRw`, `execNew`, `execDoing`, `execRw`, `codeGate`, `esc`, `capuRead`, `insBusy`. Mục "Khối nào giữ việc nào" bên dưới là đúng các danh sách này, không phải suy đoán.
  - `nd_kr`, `nd_prod`, `nd_rel`, `src_*` không có quy tắc A (T-032 E2-E6); `nd_kr` và `nd_prod` có nhân vật nhưng không giữ việc nào.
  - Nhân vật: `g.mch` trong `g#chars`, thứ tự DOM `nd_intents, nd_spec, nd_respec, gt_spec, nd_exec, nd_rework, gt_code, nd_capu, nd_insight, nd_kr, nd_prod` (`CH_AT`). Hiện chưa có `tabindex`, `role`, `aria-*` và `.mch` có `pointer-events:none`, nên chưa bấm được (đo: bấm vào tâm thân bot không có gì xảy ra).
  - Lớp SVG: `g#fx_f`, `g#chars`, `g#fx_b` (bong bóng sự kiện, `BUB_CAP=3`, `BUB_MS=2000`, `WAIT_MS=3000`, `bubLay` cỡ chữ 12px bù hệ số co).
  - Chế độ phóng to (khối script cuối file): Esc đóng phóng to; Tab luôn đưa tiêu điểm về nút `#model-zoom` (`e.preventDefault(); b.focus()`), nên hiện nay không thể Tab tới nhân vật khi phóng to: spec này đổi (mục 6).
- Trường công khai của việc trong bản `--public` (`scripts/export_dashboard.py` dòng 36-41): `id, title, state, holder, owner, reviewer, rounds, version, deadline, budget, cost, created, updated, hours_since_update, pipeline, as_of, tier`; `detail` và `link` bị bỏ ở sự kiện. Spec này chỉ đọc `id`, `title`, `state`, `owner`, `tier`, `hours_since_update`.
- Chưa có số liệu người dùng (Capu là người dùng duy nhất). Các số 40 ký tự/giây, 20 ký tự tên, "không tự tắt", từ trạng thái tiếng Việt là GIẢ ĐỊNH, tự tin ~60%; ghi thành số cụ thể để eval đo được, đổi số thì đổi cả eval.

## Giả thuyết
Nếu Capu bấm nhân vật là thấy "khối này đang giữ việc nào, ở trạng thái gì" ngay tại chỗ, không phải đối chiếu số ở khối với bảng Việc, thì bảng Mô hình đọc được bằng một cú bấm. Chỉ số: GIẢ ĐỊNH, không có số đo ngoài `eval/T-037/checklist.md`. Chỉ số bảo vệ: inv-001..021 xanh; 0 lỗi console; khung hình không trễ ≥ 300 ms; không cuộn ngang ở 390px; bong bóng sự kiện (≤ 3, chữ cố định) không đổi.

## Hành vi (người dùng thấy gì)

### 0. Quy ước
- **Đơn vị SVG (u)** và **thân bot** như T-035 mục 0. **Bong bóng tóm tắt** (gọi tắt "tóm tắt") là `g.sum` của mục 3. **Bong bóng sự kiện** là `g.bub` trong `#fx_b` (T-031 mục 4).
- Mọi chữ tiếng Việt có dấu, chuẩn hoá NFC. Đếm độ dài theo **ký tự Unicode** (code point), không theo byte.
- Tóm tắt chỉ dùng trường công khai ở mục Bằng chứng; tuyệt đối không hiện `detail`, `link`, ghi chú, defect hay đường dẫn file (kể cả khi dữ liệu có chứa chúng).

### 1. Khối nào giữ việc nào (khớp đúng quy tắc khối sáng)
"Việc khối X giữ" là **đúng tập việc làm khối X sáng theo quy tắc A** (sổ cái, không phải dot) của `drawModel`, tính trên cùng dữ liệu đã gộp live mà khối sáng dùng:

| Khối | Giữ các việc có |
| --- | --- |
| `nd_intents` | `owner=product` và `state=new` |
| `nd_spec` | `owner=product` và `state` ∈ {`doing`, `rework`} |
| `gt_spec` | `owner=product` và `state=review` |
| `nd_respec` | `state=spec` (mọi chủ việc) |
| `nd_exec` | `owner=engineering` và `state` ∈ {`new`, `doing`} |
| `nd_rework` | `owner=engineering` và `state=rework` |
| `gt_code` | `owner=engineering` và `state=review` |
| `nd_capu` | `state=escalated` (mọi chủ việc) **hoặc** (`owner=engineering`, `state=done`, `tier` khác `A`, `hours_since_update` < 48; đúng biểu thức `capuRead`) |
| `nd_insight` | `owner=insight` và `state` ∈ {`doing`, `rework`} |
| `nd_kr`, `nd_prod` | không giữ việc nào (T-032 E2, E4) |

Hệ quả bắt buộc, đo được: với chín khối có quy tắc A (mọi khối trừ `nd_kr`, `nd_prod`), **khối sáng theo quy tắc A khi và chỉ khi tóm tắt của nó không phải `Đang rảnh`**; số việc trong tóm tắt (số dòng việc + N của dòng "+N việc nữa") bằng số việc khối giữ. Khối chỉ sáng vì dot vừa tới (quy tắc B, tối đa 10 giây) mà không giữ việc nào thì tóm tắt vẫn là `Đang rảnh` (dot là sự kiện thoáng qua, không phải việc đang giữ). Việc `blocked`, việc `done` bậc A hoặc quá 48 giờ, việc `new` của `insight` và `chief-of-staff` không thuộc khối nào (như T-032).

### 2. Nội dung tóm tắt
**Mỗi việc một dòng:** `T-xxx · <tên rút gọn> · <trạng thái>`, ngăn bằng ` · ` (dấu chấm giữa U+00B7, có một dấu cách hai bên).
- `T-xxx` là `id` của việc, nguyên văn.
- **Tên rút gọn:** lấy `title`; gộp mọi dãy khoảng trắng thành một dấu cách; bỏ khoảng trắng đầu cuối; chuẩn hoá NFC. Nếu dài **≤ 20 ký tự** thì giữ nguyên; nếu **> 20** thì lấy 19 ký tự đầu, bỏ khoảng trắng cuối của đoạn đó, rồi thêm `…` (U+2026) (kết quả luôn ≤ 20 ký tự). `title` rỗng hoặc thiếu thì ghi `(không tên)`.
- **Trạng thái tiếng Việt** theo `state` của việc (chỉ các trạng thái có thể được giữ):

| `state` | Chữ |
| --- | --- |
| `new` | `Mới giao` |
| `doing` | `Đang làm` |
| `review` | `Chờ duyệt` |
| `rework` | `Đang sửa` |
| `spec` | `Sửa spec` |
| `escalated` | `Chờ Capu` |
| `done` (chỉ ở `nd_capu`) | `Chờ đọc diff` |

**Thứ tự việc:** (1) việc `escalated` trước; (2) trong mỗi nhóm, theo **số của id tăng dần** (số nguyên sau `T-`, vd `T-1030` đứng sau `T-106`, không theo thứ tự chữ cái); id không có số thì xếp cuối theo chữ cái. Thứ tự không phụ thuộc thứ tự dữ liệu hay thời gian cập nhật (để không nhảy dòng khi live).

**Số dòng:** tối đa **3 dòng việc**. Nếu khối giữ thêm n > 3 việc thì thêm đúng một dòng thứ tư `+<n−3> việc nữa` (vd `+2 việc nữa`). Khối giữ 1 đến 3 việc thì không có dòng này. Khối **không giữ việc nào**: đúng một dòng `Đang rảnh`. Tổng cộng 1 đến 4 dòng; mỗi dòng việc dài ≤ 43 ký tự (8 + 20 + 3 + 12).

### 3. Hình dạng và vị trí
- Tóm tắt là `<g class="sum" data-block="<id khối>" data-state="typing|done">` nằm trong lớp mới `<g id="fx_s">`, **con cuối cùng của `#model svg`** (sau `#fx_b`, `#chars`, `#fx_f`). Bên trong: một `rect[data-part="sum-bg"]`, 1 đến 4 `text[data-part="sum-line"]` (mỗi dòng một phần tử, theo thứ tự), một `path` đuôi trỏ về nhân vật (tuỳ chọn). Không `foreignObject`, không `<svg>` lồng, không ảnh. `#fx_s` rỗng khi không có tóm tắt.
- **Chỉ một tóm tắt cùng lúc** trong toàn trang. Không nằm trong `#fx_b`; **không tính vào giới hạn 3 bong bóng sự kiện** (`#fx_b .bub` vẫn ≤ 3, chữ cố định theo T-031).
- **Cỡ chữ** hiển thị 9 đến 16 px (cỡ chữ SVG × hệ số co của `svg`) ở mọi bề ngang 320 đến 1920px, bản thường và phóng to. Mặc định 12px; nếu hộp rộng hơn `svg` thì **giảm cỡ chữ** (không xuống dưới 9px) cho vừa. Nếu ở 9px dòng dài nhất vẫn rộng hơn `svg` (chỉ xảy ra khi tên toàn chữ hoa rộng ở khung ≤ 340px, svg ~254px), thì cắt thêm phần **tên rút gọn** của các dòng đó bằng `…` cho tới khi vừa (`T-xxx` và trạng thái giữ nguyên); ngoài trường hợp này không cắt chữ. Màu: cùng bảng màu bong bóng sự kiện (nền `#fff9d6`, chữ `#222`, viền `#7a6a20`), tương phản chữ/nền ≥ 4,5 ở chế độ sáng và tối.
- **Hộp bao `sum-bg` luôn nằm trọn trong `svg`** (dung sai 0,5px), **không chồng lên thân bot của chính nhân vật đó** (không quá 0,5u mỗi chiều), và **đứng trên cùng**: tại tâm mỗi dòng chữ đã hiện, `document.elementFromPoint` trả về phần tử nằm trong `g.sum` (không bị nút `#model-zoom`, bong bóng sự kiện hay phần tử khác che). Bong bóng được phép che chữ và nhân vật của khối khác trong lúc đang mở (xem Câu hỏi mở). Vị trí đặt trên, dưới hay bên cạnh là việc của Engineering, miễn thỏa các điều này.
- **Kích thước cố định từ lúc hiện**: hộp bao `sum-bg` được tính theo nội dung đầy đủ ngay khi mở và không đổi kích thước suốt lúc gõ (sai số 0,5px); chỉ đổi khi nội dung đổi do live (mục 5) hoặc khi đổi bề ngang.
- **Trong khung nhìn:** sau khi mở xong (≤ 300 ms), hộp bao `sum-bg` nằm trọn trong khung nhìn của trình duyệt (`0..innerWidth`, `0..innerHeight`). Nếu chưa thì cuộn tối thiểu (trang ở bản thường, `#model` ở chế độ phóng to) cho vừa. Cuộn không làm trang cuộn ngang.

### 4. Tương tác

**Nhân vật là nút.** Mỗi `g.mch` (cả 11) có `tabindex="0"`, `role="button"`, `aria-label="<Tên>, xem việc đang giữ"` (đúng chữ này; `<Tên>` ở bảng dưới), `aria-expanded="false"`/`"true"` (true khi tóm tắt của nó đang mở). `cursor:pointer`. Vòng tiêu điểm nhìn thấy khi tiêu điểm bàn phím: `outline-style` khác `none` và `outline-width` ≥ 2px (tính ra). Không đổi `data-state`, `data-anim`, `opacity`, màu `lamp` của nhân vật vì việc bấm (inv-010..012 giữ).

| `data-block` | `<Tên>` | | `data-block` | `<Tên>` |
| --- | --- | --- | --- | --- |
| `nd_intents` | Ý định | | `nd_capu` | Capu (người) |
| `nd_spec` | Spec Writer | | `nd_insight` | Insight |
| `nd_respec` | Spec rework | | `nd_kr` | Knowledge Reservoir |
| `gt_spec` | Spec Gate | | `nd_prod` | Production |
| `nd_exec` | Agent code | | `gt_code` | Code Gate |
| `nd_rework` | Code rework | | | |

**Vùng bấm.** Điểm bấm trong hình chữ nhật quanh tâm thân bot, rộng bằng hộp bao thân bot nới 8px mỗi phía (bản thường > 480px), hoặc **≥ 44×44 px** (khung nhìn ≤ 480px), thì tính là bấm nhân vật đó (`closest('g.mch')` của phần tử tại điểm đó là nhân vật đó). Ở cả hai bản thường và phóng to. Các phần khác của `#model` (khối không có nhân vật `nd_rel`, `src_*`, chữ, đường) bấm vào không mở tóm tắt nào.

**Mở / bấm lần nữa / đóng**, áp cho bấm chuột, chạm, và **Enter** hoặc **Space** khi nhân vật có tiêu điểm (Space không làm trang cuộn):
1. Nhân vật đang đóng, bấm: mở tóm tắt của nó (mục 4.1 thời gian), `data-state="typing"`. Nếu đang có tóm tắt của nhân vật khác: **đóng cái cũ ngay** (gỡ khỏi DOM, không chồng hai cái dù một khung hình) rồi mở cái mới.
2. Đang `typing`, **bấm lần nữa** vào nhân vật đó (hoặc vào chính bong bóng, hoặc Enter/Space): hiện **ngay toàn bộ chữ** (trong 200 ms), `data-state="done"`. Không đóng.
3. Đang `done`, bấm vào nhân vật đó (hoặc Enter/Space): **đóng** (gỡ `g.sum`, `aria-expanded="false"`). Bấm vào bong bóng khi `done`: không làm gì.
4. **Bấm ra ngoài** (một sự kiện `click` mà đích không nằm trong `g.sum` và không nằm trong nhân vật đang mở): đóng; việc bấm ra ngoài vẫn thực hiện bình thường (vd bấm `Phóng to` thì vừa đóng tóm tắt vừa vào phóng to). Bấm vào nhân vật khác: theo mục 1.
5. **Esc** khi có tóm tắt đang mở: đóng tóm tắt, tiêu điểm về nhân vật đó, và **không** đóng chế độ phóng to (Esc lần hai khi không còn tóm tắt mới đóng phóng to, như T-035 mục 2). Esc khi không có tóm tắt và không phóng to: không làm gì.
6. **Không tự tắt**: tóm tắt ở lại (kể cả `done`) cho tới khi người dùng đóng, hoặc khi vào/thoát chế độ phóng to hoặc nút Back đóng phóng to (bố cục đổi, tóm tắt đóng). Đã chốt vì nội dung cập nhật theo live (mục 5): tự tắt sẽ làm cập nhật vô nghĩa.

**4.1 Thời gian và hiệu ứng gõ** (bản thường; reduced-motion xem mục 7):
- Trong **≤ 200 ms** sau khi bấm: `g.sum` có trong DOM, `sum-bg` hiện (opacity tính ra > 0,05, hộp bao rộng > 0). **Bong bóng hiện trước, chữ chạy sau**: ở khung hình đầu tiên bong bóng hiện, tổng chữ đã gõ ≤ 2 ký tự; ký tự đầu tiên xuất hiện trong ≤ 400 ms sau khi bấm.
- **Tốc độ 40 ký tự/giây** (đo được 30 đến 50): tính từ ký tự đầu tới ký tự cuối, theo thời gian đồng hồ (không theo số khung hình: khung hình trễ thì chữ nhảy cách, không chậm đi). Các dòng gõ **lần lượt từ dòng 1 đến dòng cuối**, mỗi dòng gõ từ trái sang phải; tại mọi thời điểm chữ đã hiện là **tiền tố** của chữ đầy đủ (ghép các dòng theo thứ tự). Dòng chưa tới lượt có `textContent` rỗng. Dấu ` · ` và dấu cách tính là ký tự.
- Khi gõ xong: `data-state="done"`, chữ đúng bằng nội dung mục 2.
- Hiệu ứng xuất hiện của bong bóng (nếu có) ≤ 150 ms và chỉ animate `transform`/`opacity`; việc gõ dùng một vòng `requestAnimationFrame` chỉ chạy trong lúc gõ, tắt khi xong (không `setInterval` chạy mãi).

### 5. Dữ liệu đổi (live) khi tóm tắt đang mở
Tóm tắt tính lại mỗi lần bảng vẽ lại (live, tải lại dữ liệu, 15 giây một lần). So sánh danh sách dòng mới với danh sách dòng đang hiện:
- **Không đổi** (kể cả khi chỉ có sự kiện của khối khác, hoặc việc đổi nhưng không làm khối này đổi dòng nào): không làm gì; nếu đang `typing` thì **gõ tiếp, không bắt đầu lại**; không tạo lại phần tử.
- **Có đổi:** trong ≤ 1 giây, `g.sum` (cùng phần tử DOM, không gỡ rồi tạo lại) hiện **ngay toàn bộ nội dung mới** (`data-state="done"`, không gõ lại, kể cả đang `typing`), hộp bao tính lại theo nội dung mới và vẫn thỏa mục 3 (trong svg, không đè thân bot, 9-16px), vẫn mở, vẫn cùng nhân vật. Việc rời khối thì dòng mất; việc vào thì dòng hiện đúng chỗ theo thứ tự mục 2; đổi trạng thái thì chữ trạng thái đổi; số "+N" cập nhật; khối hết việc thì thành `Đang rảnh` (không tự đóng); khối đang rảnh có việc thì hiện dòng.
- **Vùng đọc cho trình đọc màn hình** (mục 6) cập nhật cùng lúc.
- Khi tóm tắt đang mở, bong bóng sự kiện **của cùng khối** không được tạo (cử động `give`/`take` và dot vẫn chạy bình thường); khi tóm tắt vừa mở, bong bóng sự kiện của cùng khối đang hiện bị gỡ ngay. Bong bóng sự kiện của khối khác chạy y như cũ (≤ 3, chữ cố định, 2,0 giây) và nằm **dưới** tóm tắt. Khi đóng tóm tắt, bong bóng sự kiện lại hoạt động bình thường cho lần sự kiện kế tiếp (không phát lại cái đã bỏ).

### 6. Truy cập (a11y)
- Nhân vật là nút như mục 4. Thứ tự Tab bản thường: theo thứ tự DOM của 11 nhân vật (`nd_intents … nd_prod`), liền nhau.
- **Vùng đọc:** phần tử HTML (không phải trong `svg`) `#model-sum-live` nằm trong `#model`, có từ lúc tải trang, `aria-live="polite"`, `aria-atomic="true"`, không `display:none`, không `visibility:hidden` (ẩn bằng kỹ thuật chỉ-đọc-màn-hình, hộp ≤ 2px), **không làm `#model` có hai `svg`, không trùng id**. Khi mở tóm tắt (và mỗi khi nội dung đổi do live), `textContent` của nó là **ngay lập tức** `<Tên>: <dòng 1>. <dòng 2>. …` với nội dung **đầy đủ** (không theo tiến độ gõ), vd `Spec Writer: T-102 · Sửa lại · Đang sửa. +1 việc nữa`; khi đóng thì rỗng. Các `text[data-part="sum-line"]` có `aria-hidden="true"` (để chữ đang gõ không bị đọc từng ký tự).
- **Chế độ phóng to** (`#model[data-zoom=on]`, role dialog): **Tab và Shift+Tab xoay vòng giữa nút `#model-zoom` và 11 nhân vật** (thứ tự: nút, rồi `nd_intents … nd_prod`, rồi quay về nút; Shift+Tab ngược lại), tiêu điểm không bao giờ ra ngoài `#model`. Thay cho câu "Tab luôn về nút" của mã T-036; vẫn thỏa T-035 mục 2 "Tab không ra khỏi `#model`". Tiêu điểm khi vào phóng to vẫn là nút.
- Esc xử lý như mục 4.5. Tiêu điểm sau khi đóng bằng Esc: nhân vật đó.

### 7. Các tình huống
- **`prefers-reduced-motion: reduce`:** bấm thì tóm tắt hiện **ngay đủ chữ** (trong 200 ms), `data-state="done"` từ khung đầu tiên; không có khung nào có chữ gõ dở; không animation hay transition trên `g.sum` và con của nó (`document.getAnimations()` không có phần tử nào trong số đó); bấm lần nữa/Esc/bấm ngoài như mục 4. Mọi thứ khác như bản thường.
- **390px:** bản thường không cuộn ngang; vùng bấm ≥ 44×44px; tóm tắt cỡ chữ 9-16px, trọn trong `svg`, không đè thân bot của nó, trong khung nhìn. Ở chế độ phóng to 390 (svg ≥ 870px, cuộn trong `#model`), tóm tắt đặt trong `svg`, mở được cho cả 11 nhân vật (nhân vật ngoài khung nhìn thì tiêu điểm bàn phím cuộn tới nó), trang ngoài không cuộn ngang.
- **Chế độ tối:** tương phản chữ/nền tóm tắt ≥ 4,5; mọi thứ khác như sáng.
- **Đổi bề ngang khi đang mở** (xoay điện thoại, đổi cỡ cửa sổ): tóm tắt giữ mở, cùng nhân vật; trong 400 ms hộp bao và cỡ chữ lại thỏa mục 3.
- **Nhân vật đang `give`/`take`/`wait` hay bị dim (`idle`):** vẫn bấm được; cử động của nhân vật không đổi.
- **Dữ liệu thiếu** (thiếu `title`, thiếu `state`, `tier` hoặc `hours_since_update`): không ném lỗi; việc thiếu `state` không thuộc khối nào.
- **Dồn 40 sự kiện khi tóm tắt đang mở:** tóm tắt vẫn một cái; `#fx_b .bub` ≤ 3; khung hình không trễ ≥ 300 ms; ≤ 12 dot; không lỗi console.
- **Mở trang:** không có tóm tắt nào; `#fx_s` rỗng; `#model-sum-live` rỗng.

### 8. Ngân sách
- Không thêm thư viện, thẻ script hay yêu cầu mạng; không gọi AI; không đổi `dashboard.json`, kênh live, `scripts/live.py`.
- `index.html` nặng thêm ≤ 20 480 byte so với nhánh T-036 (`2306da9`, GIẢ ĐỊNH).
- Keyframe mới chỉ `transform`/`opacity`; không `filter`/`box-shadow` mới trên `g.sum`.

## Câu nào của spec cũ bị thay (chỉ những câu này)
- **T-031/T-034 (mã), `.mch{pointer-events:none}`**: nhân vật (hoặc vùng bấm của nó) nhận chuột/chạm. Không câu nào của spec T-031 nói nhân vật phải "không bấm được"; không đổi hành vi nhìn thấy.
- **Mã T-036, khối script phóng to, nhánh `Tab`:** "Tab luôn về nút" → xoay vòng nút + 11 nhân vật (mục 6). **Nhánh `Escape`:** đóng tóm tắt trước, phóng to sau (mục 4.5). T-035 mục 2 giữ nguyên chữ ("Tab và Shift+Tab không ra khỏi `#model`", "Esc thoát phóng to" khi không có tóm tắt đang mở).
- **T-031 mục 4:** không đổi câu nào (bong bóng sự kiện ≤ 3, chữ cố định, 2,0 giây). Thêm duy nhất quan hệ ở mục 5 (không tạo bong bóng sự kiện cùng khối khi tóm tắt đang mở).

## Eval và bất biến cũ chịu ảnh hưởng
| Eval / bất biến | Ảnh hưởng | Việc cần làm |
| --- | --- | --- |
| inv-013 (bong bóng sự kiện có trần) | Tóm tắt ở `#fx_s`, không ở `#fx_b` | Không đổi. |
| inv-016/018 (thân bot không che chữ) | Tóm tắt là `text` ngoài `.mch/.bub`; các eval cũ không mở tóm tắt | Không đổi; eval T-037 đo riêng thân bot của chính nó (mục 3). |
| inv-010/011/012/015 | Bấm không đổi trạng thái/nét vẽ nhân vật | Không đổi; eval T-037 chạy lại ở tiêu chí 5. |
| inv-021, T-035/T-036 eval phóng to (Tab, Esc) | Nhánh Tab và Esc đổi hành vi **chỉ khi** có nhân vật hoặc tóm tắt | Chạy nguyên văn, phải xanh (tiêu chí 5); không sửa. |
| inv-022 (sắp có: bong bóng đúng cỡ khi đổi phóng to) | Chỉ xét `#fx_b` | Chưa có file; Spec Critic ghép khi có. |

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` (một file `index.html`), nhánh `t-037-bam-nhan-vat-tom-tat` dựa trên `t-036-bo-cuc-phong-to` (head `2306da9` hoặc mới hơn; Engineering rebase nếu T-036 đã merge vào `main`). Vùng `dashboard/model`.
- Bất biến của vùng đã đọc: `eval/invariants/dashboard/model/` inv-001..021 (và mã trong `lib/`): spec không mâu thuẫn bất biến nào; không đề nghị đổi/xoá bất biến nào.
- Không chạm: `dashboard.json`, kênh live, `scripts/live.py`, các bảng khác, dot, khối sáng, bong bóng sự kiện (trừ mục 5), nhân vật (hình, trạng thái, cử động).
- Bậc lưới lọc: **A** (đúng bậc Capu đặt): UI tĩnh, eval tự động phủ 6/6 tiêu chí, không chạm payment/auth/DB/dữ liệu người dùng; chỉ đọc trường công khai.
- Chạy eval cần Playwright (`NODE_PATH=$(npm root -g)`) và d3 cục bộ (`D3=/đường/dẫn/d3.min.js`).

## Hợp đồng quan sát (để eval đọc được; không ép cách cài)
| Phần tử | Nội dung |
| --- | --- |
| Nhân vật | `#model svg g.mch[data-block]` với `tabindex`, `role="button"`, `aria-label`, `aria-expanded` |
| Lớp tóm tắt | `g#fx_s` là con cuối của `#model svg`; chứa 0 hoặc 1 `g.sum[data-block][data-state]` |
| Bên trong | `[data-part="sum-bg"]` (rect), 1-4 `[data-part="sum-line"]` (text, `aria-hidden="true"`) |
| Vùng đọc | `#model-sum-live` (HTML, trong `#model`, `aria-live="polite"`, `aria-atomic="true"`) |
| Chữ đã hiện | ghép `textContent` của các `sum-line` theo thứ tự (dòng cách bằng `\n` khi so sánh) |

## Tiêu chí chấp nhận và eval
Một lệnh cho mọi tiêu chí, chạy từ `/home/user/tohong-hq`: `bash eval/T-037/run.sh <repo-dashboard> --task T-037 [--criterion N]`. In từng dòng `PASS Cn …`/`FAIL Cn.<mã> <lý do>`, dòng cuối `PASS` hoặc `FAIL …`, mã thoát 0/1. Dữ liệu `dashboard.json`, kênh live và d3 đều giả/cục bộ.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mục 1-2 (AC1): bấm (chuột và Enter/Space) mở tóm tắt đúng nội dung cho cả 11 khối theo dữ liệu giả (khối nhiều việc, khối rảnh, tên dài và ranh giới 20/21 ký tự, thứ tự theo số, escalated trước, `+N việc nữa`); khớp khối sáng; không rò `detail`/`link`; bấm khối không nhân vật không mở gì | `… --criterion 1` |
| 2 | Mục 3-4 (AC2): bong bóng hiện trước chữ; gõ lần lượt ~40 ký tự/giây, chữ đã hiện luôn là tiền tố; bấm lần hai (nhân vật hoặc bong bóng) hiện ngay hết; bấm lần ba đóng; bấm ngoài và Esc đóng; mở nhân vật khác đóng cái cũ (không bao giờ hai cái); không tự tắt sau 12 giây; quan hệ với bong bóng sự kiện (tầng, gỡ, không tạo cùng khối, ≤ 3) | `… --criterion 2` |
| 3 | Mục 5 (AC3): việc rời/vào/đổi trạng thái qua live khi đang mở: cập nhật trong 1 giây cùng phần tử, hiện ngay đủ, không đóng, vùng đọc cập nhật; sự kiện không liên quan không làm gõ lại | `… --criterion 3` |
| 4 | Mục 3, 6, 7 (AC4): focus/Enter/Space/aria-label/aria-expanded/vòng tiêu điểm; `#model-sum-live` đúng và tức thì; Tab xoay vòng khi phóng to, Esc hai nấc; reduced-motion hiện ngay; cỡ chữ 9-16px, trọn trong svg, không đè thân bot, trên cùng, trong khung nhìn, ở 320/390/1280/1920 và phóng to 390/1280, tối; vùng bấm ≥ 44px ở 390; đổi bề ngang khi đang mở | `… --criterion 4` |
| 5 | Mục 7, 8 (AC5): inv-001..021 chạy lại xanh; bong bóng sự kiện giữ nguyên (≤ 3, chữ cố định) khi có tóm tắt; 40 sự kiện khi tóm tắt đang mở: khung < 300 ms, ≤ 12 dot, 0 lỗi console; trạng thái nhân vật không đổi vì bấm; khung hình lúc gõ < 300 ms | `… --criterion 5` (thêm `--no-inv` để chạy riêng không chạy 21 bất biến) |
| 6 | (AC6) `docs/screenshots/T-037/` đã commit ở HEAD đủ 7 ảnh: `dang-go-1280`, `dang-go-1280-sau`, `xong-1280`, `ranh-1280`, `dang-go-390`, `phong-to-390`, `toi-390` (.png), khác nhau, ≥ 5KB; `dang-go-390`, `phong-to-390`, `toi-390` rộng đúng 390px; chụp lúc chữ đang gõ dở bằng `--shots` | `… --criterion 6` (chụp: `bash eval/T-037/run.sh <repo> --task T-037 --shots`) |
| (nhìn) | Phần máy không đo được: chữ gõ "có hồn" (nhịp, không giật), bong bóng dễ đọc, đuôi trỏ đúng nhân vật, không rối khi nhiều bong bóng | `eval/T-037/checklist.md` (checklist, vì cảm nhận thị giác không đo được bằng máy) |

`--task` bắt buộc cho tiêu chí 6 và `--shots` (thư mục ảnh `docs/screenshots/<task>/`, không có giá trị mặc định). Eval chụp ảnh chờ tới khi chữ **đang gõ dở** (đã gõ 15% đến 70% tổng) rồi mới chụp, và kiểm lại sau khi chụp vẫn chưa gõ xong; không đạt thì `--shots` in `FAIL` và không ghi ảnh.

## Bất biến đề xuất (tầng 2)
Vùng `dashboard/model`; Spec Critic rút vào bể khi spec qua cổng (mã mẫu: các hàm oracle và đọc `g.sum` trong `eval/T-037/bam-nhan-vat-tom-tat.cjs`):
1. **Tóm tắt khớp khối sáng.** Với mọi khối có quy tắc A, khối sáng theo quy tắc A khi và chỉ khi tóm tắt của nó khác `Đang rảnh`, và số việc trong tóm tắt bằng số việc khối giữ (mục 1). Lý do: Capu đọc đèn và đọc lời; hai thứ không được nói hai điều khác nhau; thêm khối hay đổi quy tắc A mà quên cập nhật tóm tắt thì đỏ.
2. **Tóm tắt không rò dữ liệu riêng.** Dù dữ liệu việc có `detail`, `link`, ghi chú, đường dẫn, không chữ nào trong `#fx_s` và `#model-sum-live` chứa chúng (chỉ `id`, `title`, `state`).
3. **Một tóm tắt, ở lớp riêng, và nhường tầng cho bong bóng sự kiện.** `#fx_s` có ≤ 1 `g.sum`, nằm sau `#fx_b`; `#fx_b .bub` vẫn ≤ 3 khi tóm tắt đang mở; bong bóng sự kiện cùng khối với tóm tắt đang mở không tồn tại.
4. **Esc đóng từng lớp một.** Khi có tóm tắt trong chế độ phóng to: Esc lần một đóng tóm tắt, phóng to còn; Esc lần hai đóng phóng to (mở rộng inv-021).

## Không làm
Gọi AI để tóm tắt; hiện ghi chú, defect, đường dẫn file, `detail`/`link`; sửa dữ liệu từ dashboard (không nút, không ô nhập); âm thanh; tự tắt theo giờ; các bảng khác ngoài Mô hình; đổi hình, cử động, trạng thái của nhân vật; đổi quy tắc khối sáng, dot, bong bóng sự kiện; thêm thư viện.

## Câu hỏi mở
Trong lúc tóm tắt đang mở, bong bóng có được che chữ và nhân vật của khối khác không? Spec chọn **được** (nó là cửa sổ nhỏ tạm thời, đóng bằng một cú bấm; ở 390px bong bóng rộng hơn cả khối nên không thể tránh) và chỉ cấm đè thân bot của chính nhân vật được bấm; nếu Capu hiểu "không che chữ khối" là không che bất cứ chữ khối nào thì bong bóng phải đặt ở vùng trống và không vừa ở 390px, cần nới bố cục (việc riêng). Không trả lời thì giữ "được".

## Nhật ký sửa eval
(chưa có)
