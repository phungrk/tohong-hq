# Spec T-039: Mũi tên chỉ hướng rõ ràng ở mọi đường nối của bảng Mô hình

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-02, `board/T-039.md`): nhìn bảng Mô hình là thấy hướng đi của mọi đường nối giữa các khối nhờ mũi tên nhỏ nhưng rõ, trên mọi trình duyệt. Bậc A (tự merge khi eval xanh), vùng `dashboard/model`.

## Bằng chứng
- Ảnh hiện trạng `scratchpad/arrows.png` (đã mở xem): đầu mũi là hình chữ V mảnh, rỗng; nhiều đầu mũi chìm vào viền khối đích hoặc nằm lệch (vd "đọc bể" vào góc dưới trái Spec Writer, "bậc C" vào mép phải Production).
- Mã hiện tại, dashboard main `ab08fd4`, `index.html`: marker `#ah` ở dòng 259 là `<path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.5">`, `markerWidth=7`, `markerUnits` mặc định (theo bề dày nét): 7 × 1,4 (nét `.arr`) ≈ 9,8u hộp, phần chữ V dài ≈ 7,8u. **Tính ra px**: ≈ 8,8px ở 1280 (hệ số 1,134 đo bằng Playwright) và **≈ 2,5px ở 390** (hệ số 0,324): ở điện thoại mũi tên gần như không thấy. Độ tin cậy cao (~90%, tính từ số đo, chưa đo pixel trên máy Capu).
- Đo bằng Playwright trên main: 24 đường `p_*`; độ dài 38u (`p_rework_exec`) đến 508u (`p_insight_intent`); khoảng trống giữa nhóm ≤ 176u và nhóm ≥ 268u (nên ngưỡng "đường dài" 220u không có đường nào nằm sát). **Hai đường có nét thò vào khối đích**: `p_kr_spec` (1,8u vào Spec Writer) và `p_capu_res` (6,0u vào Production). Một đường chạm cổng theo tiếp tuyến: `p_kr_gate` kết thúc đúng điểm trái nhất của vòng tròn Code Gate (cách mép 0u), nên đầu mũi phải lùi lại mới tách khỏi viền.
- **Lỗi có sẵn:** `id="ah"` bị trùng trong tài liệu (marker của `#model` và marker của bảng luồng bàn giao, `index.html` dòng 651, cùng id `ah`): `document.querySelectorAll('[id=ah]').length === 2`. Trình duyệt chọn marker đầu tiên cho cả hai nơi; hành vi này không bảo đảm giống nhau giữa Chromium, WebKit, Firefox.
- Chưa xác minh được trên WebKit/Firefox (môi trường làm spec chỉ có Chromium; Playwright báo thiếu `webkit-2359` và `firefox-1543`). Ghi nhận trong phạm vi: nghi ngờ của Capu về `context-stroke` trên Safari/iOS cũ **không kiểm chứng được ở đây**; spec loại bỏ `context-stroke` và `marker` để khỏi phụ thuộc (độ tin cậy ~75% rằng đó là nguyên nhân thật trên máy Capu; bỏ chúng thì rủi ro đó bằng 0 dù đúng hay sai).
- Chưa có số liệu người dùng (Capu là người dùng duy nhất). Mọi ngưỡng số dưới đây là GIẢ ĐỊNH rút từ ảnh và số đo main, tự tin ~65%; chúng ghi thành số cụ thể để eval đo được, đổi số thì đổi cả eval.

## Giả thuyết
Nếu mọi đường nối có đầu mũi đặc 6-10px, sát mép khối đích, cộng một mũi giữa đường cho đường dài, thì Capu (và người xem điện thoại) đọc đúng hướng luồng mà không phải lần theo nét. Chỉ số bảo vệ: không che chữ, không đè bot (inv-020), dot vẫn chạy trên mũi tên, không cuộn ngang ở 390px (inv-006), mọi inv-001..028 vẫn xanh.

## Hành vi (người dùng thấy gì)

### 0. Quy ước đo (dùng cho cả spec và eval)
- **u** = đơn vị SVG = px hiển thị chia cho `svg.getBoundingClientRect().width / svg.viewBox.baseVal.width` của `#model svg` (1280px: 1,134; 390px: 0,324; phóng to 390px: 0,88). Viewport chuẩn: **1280×900**, **390×844**, **390×844 ở chế độ phóng to** (nút `#model-zoom`). Chế độ sáng và chế độ tối.
- **Mũi tên** là phần tử SVG `path` hoặc `polygon` nằm trong `#model svg`, **không** nằm trong `defs`/`marker`/`symbol`, có đủ ba thuộc tính: `data-part="ah"`, `data-for="<id của đường p_*>"`, `data-at="end"` (mũi cuối) hoặc `data-at="mid"` (mũi giữa). Đây là **hợp đồng đo** giữa spec và eval: không có phần tử này thì coi như không có mũi tên.
- **Hình lồi** của mũi tên = bao lồi của 120 điểm lấy mẫu đều trên đường viền hình. **Đầu mũi** = đỉnh có góc nhọn nhất của bao lồi. **Trục** = từ trọng tâm hình tới đầu mũi. **Dài** = độ rộng của bao lồi chiếu lên trục, **rộng** = độ rộng chiếu lên phương vuông góc với trục; đổi sang px bằng hệ số trên. **Tâm** = trọng tâm bao lồi.
- **Khoảng cách tới khối** = khoảng cách có dấu từ điểm tới đường viền **hình học** của hình chính khối (hình `rect` hoặc `circle` là con trực tiếp của `g.node`, `g.gate`, `g.res`; `rect` tính cả bo góc `rx`); dương là ở ngoài khối. Hình vẽ ra ngoài nét viền nửa bề dày (0,6u khối thường, 0,7u cổng, 1,5u khi khối sáng `busy/ping`).
- **Khối đích** của mỗi đường (bảng cố định, không suy diễn):

| đường | khối đích | đường | khối đích | đường | khối đích |
| --- | --- | --- | --- | --- | --- |
| `p_intent_spec` | `nd_spec` | `p_gate_rework` | `nd_rework` | `p_gate_rel` | `nd_rel` |
| `p_spec_gate` | `gt_spec` | `p_rework_exec` | `nd_exec` | `p_capu_res` | `nd_prod` |
| `p_gate_exec` | `nd_exec` | `p_gate_respec2` | `nd_respec` | `p_rel_res` | `nd_prod` |
| `p_gate_respec` | `nd_respec` | `p_gate_capu` | `nd_capu` | `p_src1`, `p_src2`, `p_src3` | `nd_insight` |
| `p_respec_spec` | `nd_spec` | `p_capu_exec` | `nd_exec` | `p_res_insight` | `nd_insight` |
| `p_exec_gate` | `gt_code` | `p_gate_kr`, `p_gate_kr2` | `nd_kr` | `p_insight_intent` | `nd_intents` |
| `p_kr_gate` | `gt_code` | `p_kr_spec` | `nd_spec` | `p_insight_kr` | `nd_kr` |

- **Đường dài** = `getTotalLength()` của đường ≥ **220u**. Trên main có đúng 6: `p_gate_respec2` (270), `p_kr_gate` (268), `p_kr_spec` (395), `p_capu_res` (271), `p_res_insight` (478), `p_insight_intent` (508). 18 đường còn lại ≤ 176u là đường ngắn.
- Giữ nguyên mọi `id` hiện có (`nd_*`, `gt_*`, `src_*`, `p_*`, `fx_f`, `fx_b`, `fx_s`, `chars`, ...), `data-block`, `data-part` của T-031..T-037. `#model svg` vẫn là `svg` đầu tiên và duy nhất trong `#model`.

### 1. Mũi cuối (tiêu chí 1)
Ở **mỗi** viewport chuẩn (3 viewport) và cả chế độ tối, với **mỗi** đường `p_*` (24 đường) có **đúng một** mũi cuối (`data-at="end"`):
- **1.1 Nhìn thấy.** Không `display:none`, không `visibility:hidden`, độ đục tích luỹ = 1, hộp bao hiển thị rộng và cao > 0. Điểm ảnh ở tâm mũi (chụp màn hình thật: sáng ở 1280 và 390 không phóng to; tối ở 1280) **đúng màu fill của mũi** (sai số tổng 3 kênh ≤ 45), tức là mũi thật sự được vẽ chứ không bị khối hay nét khác phủ lên.
- **1.2 Đặc, cùng màu đường.** `fill` là màu đặc (alpha 1, không `none`, không `context-*`); không viền, hoặc viền cùng màu và liền nét (không `stroke-dasharray`) ngay cả với đường rework nét đứt. Màu fill = màu `stroke` tính ra của đường tương ứng (sai số tổng 3 kênh ≤ 12): đường thường theo `--axis`, đường `.arr.back` (7 đường: `p_gate_respec`, `p_respec_spec`, `p_gate_rework`, `p_rework_exec`, `p_gate_respec2`, `p_capu_exec`, `p_kr_spec`) theo `--warn`. **Chế độ tối:** màu mũi phải tự đổi theo token (không cứng màu sáng): mỗi mũi có fill ở chế độ tối **khác** fill ở chế độ sáng và vẫn bằng màu đường lúc đó.
- **1.3 Kích thước, tính bằng px hiển thị, giống nhau ở mọi viewport:** dài **6 đến 10px**, rộng **5 đến 10px**. Nghĩa là kích thước trong u phải tính lại theo hệ số hiển thị (≈ 7px dài: 6,2u ở 1280; 21,6u ở 390; 8u ở phóng to 390); phải tự cập nhật khi đổi cỡ cửa sổ hoặc bật/tắt phóng to, **không tải lại trang** (≤ 700ms sau khi đổi). Lý do: số đo main (≈ 8,8px ở 1280 nhưng ≈ 2,5px ở 390).
- **1.4 Đúng hướng.** Trục mũi tên lệch ≤ **20°** so với hướng đi của đường (từ đầu tới cuối) tại điểm gần đầu mũi nhất; tích vô hướng âm (ngược chiều) là lỗi. Từ đầu mũi, đi thêm 6u theo trục không được rơi vào trong một khối khác khối đích.
- **1.5 Sát mép khối đích.** Khoảng cách có dấu từ **đầu mũi** tới đường viền hình học của khối đích trong khoảng **0,8 đến 3,5u** (dương là ngoài khối): chạm sát mép, ngoài nét viền lúc nghỉ (0,6u) và không lún vào khối. Đầu mũi nằm trên đường: cách đường ≤ 1,5u, tính trên đường kéo dài thêm tối đa **8u** theo hướng cuối (để lấp khe, vd `p_gate_respec2` kết thúc cách góc bo 5,6u).
- **1.6 Không chui vào khối đích.** Không điểm nào của nét đường nằm sâu hơn 0,5u bên trong khối đích (hiện `p_kr_spec` 1,8u, `p_capu_res` 6,0u). Được **rút ngắn cuối đường tối đa 16u** (tiếp tuyến như `p_kr_gate` cần ≈ 15u) để đạt điều này; đường vẫn là đường cũ (xem 4.4).
- **1.7 Không bị đè.** Trong thứ tự DOM, mũi tên nằm **sau** khối đích và sau mọi khối, cổng, nhãn (chúng không được vẽ đè lên mũi) và **trước** `#fx_f` (dot chạy trên mũi tên, 4.3). Không có phần tử vẽ sau nào, ngoài `#fx_f`, `#chars` (nhưng xem 4.2), `#fx_b`, `#fx_s`, các mũi tên khác và các đường `p_*`, có hộp bao chồng lên mũi tên quá 0,5u. Mũi tên không chồng vào bên trong bất kỳ khối nào quá 0,5u.
- **1.8 Không phải marker.** Đường `p_*` không dùng `marker-start`, `marker-mid`, `marker-end` (tính ra `none`). Mũi tên: `pointer-events:none`, `aria-hidden="true"`, đứng yên (không animation, kể cả khi người dùng chưa đặt reduced-motion), không chồng lên nhau.

### 2. Mũi giữa đường dài (tiêu chí 2)
- **2.1 Số lượng.** Đường dài (≥ 220u) có **đúng một** mũi giữa (`data-at="mid"`); đường ngắn **không có**. Tổng: 24 mũi cuối + 6 mũi giữa = 30 mũi (reduced-motion cũng vậy). Ngưỡng 220u nằm giữa khoảng trống 176u..268u của main; đường thêm sau này theo cùng ngưỡng.
- **2.2 Vị trí.** Tâm mũi giữa nằm trên đường (≤ 1,5u), ở **25% đến 75%** chiều dài, cách đầu đường ≥ 30u và cách cuối đường ≥ 50u (theo chiều dọc đường). Đặt thử ở 50%; nếu mũi chạm chữ, thân bot, khối (cách khối < 1,5u) hay một mũi khác thì nhích dọc đường từng bước ≤ 2% (xen kẽ hai phía) tới vị trí trống đầu tiên trong khoảng 25-75%. Tâm không nằm trong khối nào.
- **2.3 Cùng chuẩn mũi cuối.** Mũi giữa đạt 1.1 đến 1.4, 1.7, 1.8 (trục theo tiếp tuyến tại điểm đặt, cùng chiều đi), cùng màu và kích thước 6-10px × 5-10px, không che chữ, không đè bot.

### 3. Mọi trình duyệt (tiêu chí 3)
- **3.1 Không phụ thuộc `context-stroke`.** `index.html` không còn chuỗi `context-stroke` hoặc `context-fill`; không phần tử nào trong trang có `fill`/`stroke` tính ra `context-*`.
- **3.2 Mũi tên là phần tử vẽ thật** (mục 0), không `marker`; marker `#ah` của `#model` bị xoá. **Không có `id` trùng** trong tài liệu (hiện `ah` trùng; marker của bảng luồng bàn giao ở `index.html` dòng 651 giữ id của nó và không được đổi hành vi, "các bảng khác" không làm).
- **3.3 Chạy trên đủ ba engine.** Eval chạy toàn bộ tiêu chí 1-4 trên Chromium, WebKit, Firefox khi Playwright có sẵn. Engine nào không khởi động được thì eval in `SKIP <engine> <lý do>` và dòng cuối ghi "CHƯA KIỂM trên <engine>" (không bao giờ tính là PASS cho engine không chạy). Với `--require-engines` thì SKIP là FAIL (dùng ở CI có đủ engine). Môi trường làm spec này chỉ có Chromium; hai engine còn lại được kiểm bằng checklist (`eval/T-039/checklist.md`) trên máy có Safari/Firefox hoặc bằng CI.

### 4. Giữ bất biến và các hành vi hiện có (tiêu chí 4)
- **4.1 Không che chữ.** Hộp bao của mọi mũi tên giao với hộp bao mọi `text` hiển thị trong `#model svg` (nhãn `.lbl`, chữ khối, cổng; trừ chữ trong `g.mch`, `#fx_b`, `#fx_s`, `#fx_f`) quá 0,5u thì lỗi (đo bằng bao lồi của mũi, chống chồng SAT), ở cả ba viewport. Vì mũi ở 390px dài ≈ 21u, **nhãn đường `.lbl` được phép nhích tối đa 8u** (theo x hoặc y, không đổi chữ, cỡ chữ, `text-anchor`) khi mũi tên nếu không sẽ chạm nó (hiện cần cho "spec đã sửa → viết lại" và "spec đã duyệt → lưu bất biến" ở 390px). Mọi nhãn còn đủ và không lệch > 8u so với main. Không đổi gì khác của bố cục.
- **4.2 Không đè bot (inv-020).** Mũi tên không chồng lên hộp bao thân bot (`g.mch [data-part=body]`) quá 0,5u; `g#chars` vẫn nằm sau mũi tên và trước `#fx_b`.
- **4.3 Dot chạy trên mũi tên.** `#fx_f` vẫn hiện (không `display:none`), nằm sau mọi mũi tên trong DOM; các eval dot (inv-001, 003, 017...) vẫn xanh.
- **4.4 Không đổi tuyến đường, bố cục, màu dot.** 80% đầu của mỗi đường vẫn đi qua các điểm của đường trên main (sai ≤ 1u); chỉ được rút cuối ≤ 16u (1.6) hoặc coi như kéo dài ≤ 8u để đặt mũi (1.5). Khối, cổng không đổi vị trí hay kích thước.
- **4.5 Phóng to và 390px.** Ba viewport đều đạt 1.1-1.8, 2.x, 4.1-4.3; không cuộn ngang ở 390px (`scrollWidth ≤ innerWidth`, inv-006); đổi 1280 → 390 → phóng to → 1280 trên cùng một trang không tải lại vẫn giữ 6-10px.
- **4.6 Console.** Không lỗi console ở cả ba viewport.
- **4.7 Bất biến.** `inv-001..inv-028` của `eval/invariants/dashboard/model/` chạy nguyên văn và xanh.

### 5. Ảnh (tiêu chí 5)
`docs/screenshots/T-039/` trong repo dashboard, đã commit ở HEAD của nhánh, có đúng bốn ảnh PNG: `truoc-1280.png`, `sau-1280.png`, `truoc-390.png`, `sau-390.png`. Ảnh chụp **toàn bảng Mô hình** (hộp bao của `#model`), viewport 1280×900 và 390×844, rộng đúng 1280 và 390px, mỗi ảnh ≥ 5 KB, bốn ảnh khác nhau. "Trước" chụp từ main `ab08fd4`, "sau" chụp từ nhánh; lệnh chụp ở mục eval. PR mô tả bằng hai ảnh cạnh nhau.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` · Nhánh: `t-039-mui-ten-huong` · Vùng (`area`): `dashboard/model` · một file `index.html`.
- Bất biến đã đọc: `eval/invariants/dashboard/model/` inv-001..028; spec này không vi phạm INV nào. Va chạm cần để ý: inv-020 (bot trên cùng, 4.2), inv-006 (không cuộn ngang 390, 4.5), inv-017/003 (dot, 4.3), inv-016/018/026 (che chữ, 4.1), inv-021 (phóng to). Không đề nghị đổi INV nào.
- Không chạm: payment, auth, DB, dữ liệu người dùng; bảng luồng bàn giao (`drawFlow`, marker `ah/ar/aa/ab` của nó); dashboard.json.
- Bậc lưới lọc đề xuất: **A** (đúng như Capu ghi): chỉ giao diện, eval tự động phủ cả năm tiêu chí. Lưu ý cho Chief of Staff: ở môi trường chỉ có Chromium, Code Gate xanh chưa chứng minh WebKit/Firefox (eval in SKIP rõ ràng); phần đó nằm ở `eval/T-039/checklist.md` (MANUAL) hoặc CI chạy `--require-engines`.

## Tiêu chí chấp nhận và eval
`cwd` của mọi lệnh: `/home/user/tohong-hq` (repo sổ cái), tham số đầu là thư mục repo dashboard (có `index.html`).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mọi đường `p_*` có đúng một mũi cuối: nhìn thấy, đặc, cùng màu đường (sáng và tối), 6-10px ở 1280/390/phóng to, đúng hướng, sát mép khối đích 0,8-3,5u, không chui vào khối, không bị vẽ đè, không phải marker | `bash eval/T-039/run.sh /home/user/tohong-hq-dashboard --task T-039 --criterion 1` |
| 2 | Đường dài ≥ 220u có đúng một mũi giữa, đặt đúng quy tắc; đường ngắn không có | `bash eval/T-039/run.sh /home/user/tohong-hq-dashboard --task T-039 --criterion 2` |
| 3 | Không `context-stroke`/`marker`, không id trùng; chạy được trên Chromium, WebKit, Firefox (engine thiếu thì SKIP rõ, không PASS giả) | `bash eval/T-039/run.sh /home/user/tohong-hq-dashboard --task T-039 --criterion 3` (ở CI có đủ engine thêm `--require-engines`); phần nhìn trên Safari/Firefox: `eval/T-039/checklist.md` |
| 4 | Không che chữ, không đè bot, dot trên mũi, không đổi tuyến, nhãn nhích ≤ 8u, phóng to và 390px, không lỗi console, inv-001..028 xanh | `bash eval/T-039/run.sh /home/user/tohong-hq-dashboard --task T-039 --criterion 4` (thêm `--no-inv` để bỏ phần 28 bất biến, chạy lâu) |
| 5 | Bốn ảnh trước/sau ở 1280 và 390 đã commit | `bash eval/T-039/run.sh /home/user/tohong-hq-dashboard --task T-039 --criterion 5` |

Chạy cả năm: `bash eval/T-039/run.sh /home/user/tohong-hq-dashboard --task T-039` (in `PASS n/n` hoặc `FAIL …`, mã thoát 0/1). Chụp ảnh: `bash eval/T-039/run.sh <repo main> --task T-039 --shots <repo nhánh>/docs/screenshots/T-039 --label truoc`, rồi `… <repo nhánh> … --label sau`. Tiêu chí 1-4 chạy trên Chromium cục bộ; nhãn engine nằm trong từng dòng kết quả (`[chromium]`).

Để `gate.py` chạy được, các eval ghi vào `board/T-039.md` khi giao Engineering là sáu mục: năm lệnh ở cột Eval (một lệnh cho mỗi tiêu chí) cộng `eval/T-039/checklist.md` (MANUAL).

## Bất biến đề xuất (tầng 2)
Tính chất phải đúng mãi trong vùng `dashboard/model` sau khi T-039 ship (Spec critic rút vào bể khi spec qua cổng; chưa viết file vào `eval/invariants/`):
- **INV-A "mọi đường p_* có mũi cuối thật".** Với **mọi** phần tử `path[id^=p_]` trong `#model svg` (kể cả đường thêm sau này): có đúng một phần tử `data-part="ah" data-at="end" data-for=<id>` nhìn thấy, đặc, cùng màu đường, đúng hướng (≤ 20°), dài 6-10px, rộng 5-10px, đầu mũi cách khối **gần nhất** với cuối đường 0,8-3,5u, không bị vẽ đè, ở 1280, 390 và phóng to, sáng và tối. (Bản bất biến phải suy khối đích bằng hình học thay vì bảng ở mục 0, để đường mới không cần sửa eval.) Cài đặt gợi ý: tách từ `eval/T-039/mui-ten-huong.cjs` (khối `MEASURE`, nhóm C1).
- **INV-B "đường dài có mũi giữa".** Mọi `p_*` dài ≥ 220u có đúng một mũi giữa, mọi đường ngắn hơn không có, mũi giữa không che chữ, không đè bot, không trong khối.
- **INV-C "không phụ thuộc kỹ thuật dễ vỡ".** Không `context-stroke`/`context-fill` trong trang; `p_*` không dùng marker; không `id` trùng trong tài liệu.
- Điều kiện áp dụng (như inv-020): trang có phần tử `[data-part=ah]`; trước đó PASS "chưa áp dụng".

## Không làm
Đổi tuyến đường (ngoài rút cuối ≤ 16u), đổi bố cục (ngoài nhích nhãn `.lbl` ≤ 8u), đổi màu dot, các bảng khác (bảng luồng bàn giao `drawFlow`, KPI, dòng thời gian), thêm thư viện, đổi font, đổi dữ liệu. Không tự tạo `marker` thay thế.

## Câu hỏi mở
Không có điều gì chặn việc giao Engineering. Một điều Capu nên biết (không cần trả lời để đi tiếp): Spec đặt kích thước theo px màn hình (7px) nên ở 390px mũi dài ≈ 21u so với đường ngắn nhất 38u: mũi chiếm hơn nửa đường `p_rework_exec` ở điện thoại. Nếu Capu thấy to quá ở 390px, hạ cận dưới `LEN_MIN` xuống 5px là một dòng số trong eval và spec.

## Lịch sử spec
- 2026-11-02 v1 (Spec Writer): bản đầu. Eval đã chạy được trên bản thử (xem bàn giao): xanh trên bản thử, đỏ trên main.
