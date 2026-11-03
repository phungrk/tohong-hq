# Spec T-047: Đầu mũi tên của đường nối trong bảng Mô hình to gấp 1,5 lần

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-03, `board/T-047.md`), nguyên văn: "Hãy cho dấu mũi tên của connect line giữa các khối to hơn, to hơn 1.5 lần hiện tại". Bậc A, vùng `hq/dashboard/model`. Đây là Capu đổi ý so với T-039 ("nhỏ nhưng rõ", 5-7px): ý định mới thắng, các ngưỡng cỡ của T-039 bị thay (mục "Ngưỡng bị thay").

## Bằng chứng
- **Mốc "hiện tại" đo bằng Playwright (Chromium 153) trên dashboard `dfe8a20`** (origin/main, đã có T-040 và T-042), `index.html`, cùng phương pháp đo như T-039 (bao lồi 120 điểm của phần tử `[data-part=ah]`, dài = chiều rộng bao lồi chiếu lên trục, rộng = chiếu lên phương vuông góc):

| viewport (rộng × cao) | hệ số hiển thị px/u | mũi cuối: 24 mũi, dài × rộng (px) | mũi giữa: 6 mũi, dài × rộng (px) |
| --- | --- | --- | --- |
| 1280 × 900 | 1,134 | 5,10-5,11 × 4,14-4,17 | 5,10-5,11 × 4,15-4,17 |
| 844 × 900 | 0,778 | 5,10 × 4,15-4,16 | 5,10 × 4,15-4,16 |
| 390 × 844 | 0,324 | 5,10 × 4,15-4,16 | 5,10 × 4,15-4,16 |

  Mọi mũi giống nhau: **dài 5,10px, rộng 4,15px, không phụ thuộc viewport** (mã `index.html` khối "T-040": `LEN_PX=5.1`, `WID_PX=4.2`, tam giác đặc, cỡ cố định theo px màn hình). Trong u: 4,50 × 3,66 (1280), 6,56 × 5,33 (844), 15,7 × 12,8 (390).
- Hệ quả của "1,5 lần": **dài 7,65px, rộng 6,23px** (nhân cả hai chiều, diện tích ×2,25). Nếu hiểu "1,5 lần" là diện tích thì cạnh chỉ ×1,22 (6,2 × 5,1px); spec chọn nhân **chiều dài** vì Capu nói "to hơn" về cỡ nhìn thấy và Chief of Staff đã chốt tiêu chí "dài và rộng đầu mũi = 1,5 × hiện tại". Tự tin ~75% rằng đây là điều Capu muốn (chưa hỏi lại).
- **Khả thi đã thử, không ship:** bản thử trong scratchpad (dfe8a20 với `LEN_PX=7.65`, `WID_PX=6.3`, không đổi gì khác) đo được dài 7,64-7,66 × rộng 6,22-6,25px ở cả ba viewport, và qua hết các luật cũ của T-039 trừ ba điểm nêu ở "Ngưỡng bị thay" (một là nét còn thấy ở 390, một là nhãn bị nhích, một là inv-029/030 cứng 5-7px). Độ tin cậy cao (~90%, đo, chỉ Chromium).
- **Lỗi có sẵn phát hiện khi đọc:** `eval/T-039/mui-ten-huong.cjs` (tiêu chí 4, mục V) đọc bất biến từ `eval/invariants/dashboard/model/`, thư mục đã chuyển sang `eval/invariants/hq/dashboard/model/` theo ADR-011; chạy nguyên bản sẽ lỗi đường dẫn. Eval của T-047 đã trỏ đúng cây mới; eval T-039 để nguyên (không sửa eval cũ).
- Chưa có số liệu người dùng (Capu là người dùng duy nhất). Dung sai ±10% là điều Chief of Staff đã ghi trong tiêu chí.

## Giả thuyết
Nếu đầu mũi dài 7,65px và rộng 6,23px (thay vì 5,10 × 4,15) thì Capu đọc hướng luồng ở điện thoại và máy tính mà không phải nheo mắt. Chỉ số bảo vệ: không che chữ, không đè bot, dot chạy trên mũi tên, không cuộn ngang ở 390px, đường ngắn nhất vẫn thấy được nét thân.

## Hành vi (người dùng thấy gì)

Quy ước đo, bảng khối đích, định nghĩa "mũi tên", "mũi cuối", "mũi giữa", "đường dài", "u", "dài", "rộng" giữ **nguyên văn mục 0 của `products/T-039-mui-ten-huong.md`**; spec này chỉ nêu phần đổi. Viewport đo: **1280×900, 844×900, 390×844, 390×844 ở chế độ phóng to** (`#model-zoom`), sáng và tối. ("844" ở đây là chiều **rộng** 844px; viewport 390×844 của T-039 vẫn đo, không trùng.)

1. **Cỡ mũi cuối.** Ở **mỗi** viewport trên, **mỗi** trong 24 mũi cuối (`data-at="end"`) có **dài 6,89 đến 8,41px** và **rộng 5,60 đến 6,85px** (= 1,5 × mốc 5,10 và 4,15, dung sai ±10%). Cỡ vẫn **cố định theo px màn hình, giống nhau ở mọi viewport** như hiện nay (không tỉ lệ theo bảng) và tự cập nhật khi đổi cỡ cửa sổ hoặc bật/tắt phóng to, không tải lại trang (≤ 700ms).
2. **Cỡ mũi giữa.** Mỗi trong 6 mũi giữa (`data-at="mid"`, đường dài ≥ 220u) có **cùng khoảng cỡ** như mục 1. Số lượng và vị trí mũi giữa theo T-039 mục 2.1-2.2 (đúng 1 mũi trên đường dài, 0 trên đường ngắn, ở 25-75% chiều dài). Nếu mũi to hơn làm chạm chữ/khối/mũi khác ở 50%, vẫn nhích dọc đường theo quy tắc T-039 2.2.
3. **Hai chiều cùng đổi.** Không chấp nhận chỉ dài mà không rộng (hoặc ngược lại): cả hai chiều phải nằm trong khoảng ở mục 1 (hình mũi vẫn là tam giác đặc, **tỉ lệ dài/rộng nằm trong 1,106 đến 1,352** (= 5,10/4,15 = 1,229 ±10%), tức phóng đều, không đổi hình. Capu muốn "to hơn", không muốn đổi hình (Chief of Staff phân xử, `handoffs/T-047-D1.md`). Mũi 8,3 × 5,7px (tỉ lệ 1,46) và 6,95 × 6,8px (1,02) đều **đỏ** dù từng chiều nằm trong khoảng. Tỉ lệ đo từ cùng bao lồi với dài/rộng, áp cho mũi cuối và mũi giữa, mọi viewport.
4. **Giữ nguyên mọi luật khác của T-039** (mục 1.1, 1.2, 1.4-1.8 và 2.x, 3.x, 4.x), kể cả: đúng hướng (≤ 20°), đầu mũi cách mép khối đích 0,8-3,5u, không chui vào khối đích, không bị vẽ đè, đặc và cùng màu đường ở chế độ sáng và tối, không `marker`/`context-stroke`/id trùng, **không che chữ** (kể cả mũi giữa), **không đè thân bot** (inv-020), **`#fx_f` (dot) vẫn sau mọi mũi tên trong DOM và hiện**, không đổi tuyến đường (rút cuối ≤ 16u, kéo dài ≤ 8u), nhãn `.lbl` chỉ nhích ≤ 8u **và chỉ khi** ở vị trí cũ nhãn bị bao lồi của một mũi tên chồng quá 0,5u, **không cuộn ngang ở 390px** (inv-006), không lỗi console, reduced-motion vẫn đủ 30 mũi.
5. **Nét còn thấy ở điện thoại (thay T-039 1.9, chỉ ở hệ số hiển thị < 0,5, tức 390×844 không phóng to).** Nét còn thấy = độ dài dọc đường từ khối nguồn tới gốc mũi cuối: **≥ 25% chiều dài đường trên main và ≥ 3px** (T-039: ≥ 50% và ≥ 7px). Ở các viewport còn lại (1280, 844, phóng to) **giữ ≥ 50% và ≥ 7px**. Lý do tính ra: đường ngắn nhất `p_rework_exec` dài 38u = 12,3px ở 390; mũi tối đa 8,41px và đầu mũi cách khối ≥ 0,8u (0,26px) chỉ còn ≤ 3,6px nét, nên 7px là **không thể** (cần mũi ≤ 4,8px) và 3px là cận khả thi. Bản thử: `p_rework_exec` 4,5px (37%), `p_intent_spec` và `p_rel_res` 6,2px (44%).
6. **Ảnh trước/sau.** `docs/screenshots/T-047/` trong repo dashboard, đã commit ở HEAD của nhánh, có đúng sáu ảnh PNG: `truoc-1280.png`, `sau-1280.png`, `truoc-844.png`, `sau-844.png`, `truoc-390.png`, `sau-390.png`. Mỗi ảnh là dải dọc chứa `#model` (cắt theo chiều cao của `#model`, rộng bằng viewport: đúng 1280, 844, 390px; không cắt theo hộp bao ngang của `#model`, vốn hẹp hơn viewport do `.page` giới hạn 1200px), ≥ 5 KB, sáu ảnh khác nhau. "Trước" chụp từ `dfe8a20`, "sau" chụp từ nhánh. **Mô tả PR nhúng cả sáu ảnh** (`![..](docs/screenshots/T-047/….png)` hoặc URL tuyệt đối trỏ tới đúng tên file đó), xếp trước/sau cạnh nhau.

## Ngưỡng bị thay (đề xuất ADR, Chief of Staff ghi)
Đề xuất **ADR-019 "T-047: nâng cỡ đầu mũi tên 1,5 lần"** (số do Chief of Staff đặt), cùng tinh thần ADR-015 (nâng chuẩn theo ý định mới của Capu, không nới cho khớp code). Nội dung đề xuất:
1. `products/T-039-mui-ten-huong.md` mục **1.3** (và 2.3, 4.5): cỡ 5-7px × 4-7px → **6,89-8,41px × 5,60-6,85px**. Ý "nhỏ thôi" của T-039 bị thay bằng ý "to hơn 1,5 lần" của Capu 2026-11-03.
2. T-039 mục **1.9**: ≥ 50% và ≥ 7px → giữ ở viewport lớn, **≥ 25% và ≥ 3px khi hệ số hiển thị < 0,5** (mục 5 ở trên).
3. **INV-029** (`eval/invariants/hq/dashboard/model/inv-029-moi-duong-co-mui-cuoi.sh`) và **INV-030** (`inv-030-duong-dai-co-mui-giua.sh`): hằng số `CFG.LEN` `[5, 7]` → `[6.89, 8.41]` và `CFG.WID` `[4, 7]` → `[5.60, 6.85]` trong `eval/invariants/hq/dashboard/model/lib/t039_inv.cjs`; sửa dòng "5-7px × 4-7px" trong chú thích hai file `.sh`. **Hệ quả cho cổng:** nếu sửa sau, Code Gate của T-047 sẽ đỏ tầng 2 ở INV-029/030 dù code đúng spec và việc bị trả `--kind spec`. Vì vậy ADR và sửa hằng số **phải vào bể trước khi Engineering bàn giao** (spec-critic rút/sửa bất biến khi spec qua cổng, theo CLAUDE.md "sửa hay xoá phải qua Chief of Staff và ghi `decisions/`").
4. `eval/T-040/lib/adv_probe.cjs` (cùng `LEN:[5,7], WID:[4,7]`) và dòng 5 của `eval/T-039/checklist.md` ("mũi nhỏ gọn 5-7px"): cũ, đề nghị cập nhật hoặc đánh dấu "thay bởi T-047". Không chặn T-047 (cổng T-047 không chạy eval T-040/T-039).
- **Không bị thay:** ADR-015 và ADR-016 chỉ nói cỡ nhân vật và trần nhân vật khi phóng to (T-031/T-035), không ràng buộc mũi tên. Các bất biến inv-001..028 và inv-031 giữ nguyên; spec này không vi phạm INV nào khác. Eval cũ (`eval/T-039/`, `eval/T-040/`) **không bị sửa**; eval T-047 là bản dẫn xuất riêng.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` · Nhánh: `t-047-mui-ten-to` · Vùng (`area`): `hq/dashboard/model` · một file `index.html`.
- Bất biến đã đọc: `eval/invariants/hq/dashboard/model/` inv-001..031 và `eval/invariants/_shared/` (inv-001 không secret, inv-002 số cái đọc được). Mâu thuẫn duy nhất là INV-029/030 (cỡ), xử lý ở mục trên.
- Không chạm: payment, auth, DB, dữ liệu người dùng; bảng luồng bàn giao (`drawFlow`); dashboard.json; tuyến đường; bố cục; màu; dot.
- Bậc đề xuất: **A** như Chief of Staff đặt (chỉ giao diện, eval tự động phủ). Lưu ý: eval chỉ chạy Chromium ở môi trường này; WebKit/Firefox chưa kiểm (xem `eval/T-039/checklist.md`, các dòng 1-4, 6-8 vẫn dùng được).

## Tiêu chí chấp nhận và eval
`cwd` của mọi lệnh: `/home/user/tohong-hq`; tham số đầu là thư mục repo dashboard (có `index.html`). Cần Playwright và d3 cục bộ (`D3=/đường/dẫn/d3.min.js`).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | 24 mũi cuối: dài 6,89-8,41px, rộng 5,60-6,85px, tỉ lệ dài/rộng 1,106-1,352 (check B5c) ở 1280, 844, 390, phóng to, sáng và tối; đúng hướng, sát mép khối đích 0,8-3,5u, đặc cùng màu đường, không bị đè, không chui vào khối; nét còn thấy đủ (mục 5) | `bash eval/T-047/run.sh /home/user/tohong-hq-dashboard --task T-047 --criterion 1` |
| 2 | 6 mũi giữa (đường ≥ 220u) cùng khoảng cỡ và tỉ lệ (M3), đúng số lượng và vị trí, đường ngắn không có | `bash eval/T-047/run.sh /home/user/tohong-hq-dashboard --task T-047 --criterion 2` |
| 3 | Không `context-stroke`/`marker`/id trùng; chạy được trên Chromium, WebKit, Firefox (engine thiếu thì SKIP rõ, không PASS giả; CI thêm `--require-engines`) | `bash eval/T-047/run.sh /home/user/tohong-hq-dashboard --task T-047 --criterion 3` |
| 4 | Không che chữ, không đè bot, dot trên mũi, không đổi tuyến, nhãn chỉ nhích khi mũi chạm, không cuộn ngang 390, không lỗi console, reduced-motion đủ 30 mũi, bất biến hq/dashboard/model (trừ INV-029/030 cho tới khi ADR áp) xanh | `bash eval/T-047/run.sh /home/user/tohong-hq-dashboard --task T-047 --criterion 4` (thêm `--no-inv` để bỏ 29 bất biến, chạy lâu) |
| 5 | Sáu ảnh trước/sau đã commit ở HEAD; mô tả PR nhúng đủ sáu ảnh | `bash eval/T-047/run.sh /home/user/tohong-hq-dashboard --task T-047 --criterion 5` **và** `bash eval/T-047/pr-body.sh` |

Chạy cả năm: `bash eval/T-047/run.sh /home/user/tohong-hq-dashboard --task T-047` (in `PASS n/n` hoặc `FAIL …`, mã thoát 0/1). Chụp ảnh: "trước" từ `dfe8a20` (vd `git -C <dashboard> archive dfe8a20 | tar -x -C <thư mục tạm>`): `bash eval/T-047/run.sh <thư mục tạm> --task T-047 --shots <repo nhánh>/docs/screenshots/T-047 --label truoc`; "sau": `bash eval/T-047/run.sh <repo nhánh> --task T-047 --shots <repo nhánh>/docs/screenshots/T-047 --label sau`.
Trạng thái đã kiểm khi viết spec: trên `dfe8a20` tiêu chí 1 và 2 đỏ (chỉ ở cỡ), tiêu chí 3 xanh, tiêu chí 4 xanh (không kèm bất biến, 29/29), tiêu chí 5 đỏ; trên bản thử 7,65 × 6,3px, tiêu chí 1, 2, 3 xanh (tiêu chí 1: 90/90, tiêu chí 2: 16/16), tiêu chí 4 đỏ đúng một dòng (K8, nhãn "→ lưu bất biến" bị nhích 2u ở 390 dù mũi không chạm), nên eval phân biệt được. Bản thử của spec-critic: 8,3 × 5,7px đỏ ở B5c (tiêu chí 1) và M3 (tiêu chí 2); 6,95 × 6,8px đỏ ở B5c và M3 (và B11).
Các eval ghi vào `board/T-047.md` khi giao Engineering: sáu mục: năm lệnh `run.sh --criterion 1..5` cộng `bash eval/T-047/pr-body.sh` (mặc định tìm PR của nhánh `t-047-mui-ten-to` bằng `gh`; đỏ cho tới khi PR có và mô tả nhúng đủ ảnh, nên Engineering mở PR và nhúng ảnh trước khi bàn giao).

## Bất biến đề xuất (tầng 2)
- **Không bất biến mới.** Tính chất "mũi tên có cỡ nhìn thấy được" đã nằm trong INV-029/030; việc của T-047 là **đổi hằng số** của chúng (ADR mục 3), không thêm bất biến. Spec-critic áp sửa này khi spec qua cổng.

## Không làm
Đổi tuyến đường (ngoài rút cuối ≤ 16u), đổi bố cục, đổi màu mũi hoặc dot, đổi hình mũi (vẫn tam giác đặc), làm mũi tỉ lệ theo bảng, các bảng khác (luồng bàn giao, KPI, dòng thời gian), thêm thư viện, sửa eval cũ của T-039/T-040.

## Câu hỏi mở
Một câu cho Capu (không chặn): "to hơn 1,5 lần" nên hiểu là **đúng khoảng 1,5 lần (7,65px, cho phép 6,89-8,41px)** như spec đang viết, hay **ít nhất 1,5 lần** (sàn 7,65px, trần do Product định)? Mặc định giữ khoảng ±10% theo tiêu chí Chief of Staff đã ghi.

## Lịch sử spec
- 2026-11-03 v1 (Spec Writer): bản đầu.
- 2026-11-03 v2 (Spec Writer, theo `handoffs/T-047-D1.md`): mục 3 có eval (check B5c trong tiêu chí 1 và M3 của tiêu chí 2, tỉ lệ 1,106-1,352; câu cũ "không đổi quá ±10%" không có máy đo, cho phép mũi phi tiêu 8,3 × 5,7); mục 6 sửa câu ảnh (dải dọc rộng bằng viewport, khớp `--shots`).
