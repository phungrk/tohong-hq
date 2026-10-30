# Spec T-020: Bản đồ luồng theo ADR-009 + bảng Đài phun nước

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-10-30, `board/T-020.md`): vẫn xem Bản đồ luồng quen thuộc để biết ai giữ việc gì, và có thêm hình đài phun để thấy nước đang chảy hay nghẽn ở tầng nào của mô hình mới (`decisions/2026-10-30-mo-hinh-dai-phun-nuoc.md`, ADR-009).

## Bằng chứng
- `index.html` ở `phungrk/tohong-hq-dashboard` (main `d3c855b`): Bản đồ luồng có 9 vị trí (`POS_WIDE`, `POS_NARROW`), không có `insight`, không có `STATE_LABEL.spec`; `RUN_STATES` bỏ qua trạng thái `spec`; `tasks[]` trong `dashboard.json` chưa có `tier` (xem `scripts/export_dashboard.py`).
- `org/roster.json` đã có `insight` (role "Máy bơm") và mỗi vị trí có trường `role`; `dashboard.json.roster[].role` đã mang trường này.
- `scripts/task.py`: tám trạng thái `new, doing, review, rework, spec, blocked, escalated, done`; bậc `A|B|C`; `spec` luôn do `product` giữ.
- Chưa có người dùng thật của dashboard ngoài Capu: mọi quy tắc đếm dưới đây là **GIẢ ĐỊNH về cách đọc brief của Capu, tự tin ~75%**. Chỗ yếu nhất là tầng Ống hồi (xem Câu hỏi mở).

## Giả thuyết
Nếu thêm vị trí insight, đường về spec, bậc ở đường review, và bảng đài phun thì Capu nhìn một lần biết (a) việc đang nằm ở tầng nào của đài, (b) tầng nào nghẽn, (c) việc nào đang chờ mình merge, không cần mở Kanban. Chỉ số bảo vệ: mọi thứ của T-019 (đường bàn giao, số việc, tooltip, 390px, reduced-motion, không lỗi console) không xấu đi.

## Hành vi (người dùng thấy gì)

### Phần 1. Bản đồ luồng (chỉ thêm, không vẽ lại)
1. **Vị trí insight.** Có nhân vật pixel art riêng (khác mọi nhân vật khác và khác bóng mờ) với `data-agent="insight"`, cùng cơ chế trạng thái như T-019 (`working` khi đang giữ việc, `idle`, nhất thời…). Tâm ở 20% bề ngang bản đồ, cùng hàng với Chief of Staff, bên trái nó (hàng y=130 ở cả bố cục rộng lẫn hẹp). Chín vị trí cũ **giữ nguyên toạ độ tâm** (sai số 1px) ở cả hai bố cục. Vendor Ops, Growth, Finance vẫn là bóng mờ cùng một sprite. Chỉ vẽ nút insight khi `roster` có id `insight` (để `tests/characters.js` của T-019 không phải sửa); nếu insight là `Need Hiring` thì vẽ bóng mờ.
2. **Nhãn vai.** Dưới tên mỗi vị trí có roster (không tính nút "Hoàn thành") một dòng chữ nhỏ bằng đúng `roster[].role` của vị trí đó, đọc từ `dashboard.json`, không có chuỗi vai nào viết sẵn trong code. Thứ tự từ trên xuống: tên, nhãn vai, rồi (nếu có) "Need Hiring" hoặc tên hành động đang chạy. Không nhãn nào đè nhãn khác ở 1280px và 390px.
3. **Trạng thái `spec`.** Mỗi việc ở trạng thái `spec` vẽ vào một đường **reviewer → product** tách riêng (luôn là reviewer → product, bất kể owner của việc). Đường này tô màu `--spec` (tím), khác màu đường chạy (`--accent`), đường rework (`--bad`). Nếu có cả việc `rework` của product, hai đường là hai nét riêng, hình khác nhau. Trên đường có nhãn `Về spec` (thêm ` ×n` khi có n ≥ 2 việc). Tooltip đường liệt kê từng việc với trạng thái "Về spec".
4. **Product "đang sửa spec".** Khi có ít nhất một việc ở trạng thái `spec` có `holder` là product (hoặc `holder` rỗng), nhân vật Product có `data-state="revising"`, tooltip hiện "Trạng thái Đang sửa spec", và có chuyển động riêng (tập tên animation khác tập của `working`). Thứ tự ưu tiên trạng thái nhân vật: `hiring` > nhất thời (upset, celebrating, receiving, handing-off) > `revising` > `working` > `idle`.
5. **Bậc ở việc review.** Đường owner → reviewer của các việc `review` có `data-kind="review"`, kèm nhãn bậc ngay trên đường: các bậc khác nhau của việc trên đường, sắp A, B, C, rồi `?`, nối bằng `·` (ví dụ `A·C`, `B·?`). Có ít nhất một việc bậc C trên đường thì có thêm nhãn `chờ anh merge`. Tooltip đường mỗi việc một dòng có `Bậc X` (X là A, B, C hoặc `?`), việc bậc C có thêm `chờ anh merge`.
6. **Giữ T-019.** Đường bàn giao xám, đường trả về đỏ nét đứt, huy hiệu số việc, tooltip có "Đang giữ" và "Trạng thái", vòng act-ring, run-glow, run-flow, 390px không tràn ngang, reduced-motion tắt hết animation, không lỗi console, và `node tests/characters.js` vẫn qua **không sửa file đó**.

### Phần 2. Bảng Đài phun nước
Một thẻ mới `#dai-phun-nuoc` đặt ngay sau thẻ Bản đồ luồng, tiêu đề "Đài phun nước". Có sáu tầng theo thứ tự đọc, nước chảy từ trái sang phải ở 1280px (hoặc từ trên xuống, lưới hai cột đọc theo hàng, ở 390px), một khối **Phía Capu** tách khỏi chuỗi sáu tầng, và một dòng **ngoài đài**.

**Dữ liệu suy từ đâu** (duy nhất): `tasks[]` của `dashboard.json` đã gộp với sự kiện live đúng như Bản đồ luồng đang làm (cùng hàm gộp, cùng nguồn, cùng kênh live, không mở kết nối nào thêm), cụ thể các trường `state`, `owner`, `tier`, `updated`; và `regression_evals` ở cấp cao nhất của `dashboard.json`. `hours` của một việc là số giờ từ `updated` tới bây giờ, làm tròn một chữ số thập phân, đúng cách `derive()` đang tính (`t.hours`). Không dùng `holder`, `hours_since_update`, hay `events` để đếm.

**Quy tắc đếm** (mỗi việc rơi vào đúng một dòng của bảng dưới; tầng nào cũng đếm số việc, không đếm sự kiện):

| Trạng thái | owner | Vào đâu |
| --- | --- | --- |
| `new`, `doing`, `rework` | `insight` | Máy bơm (`pump`) |
| `new`, `doing`, `rework` | `product` | Thân cột (`column`) |
| `new`, `doing`, `rework` | `engineering` | Tia (`jet`) |
| `new`, `doing`, `rework` | mọi owner khác (capu, chief-of-staff, reviewer, vendor-ops, growth, finance) | dòng **ngoài đài** |
| `review` | mọi owner | Lưới lọc (`filter`), kèm số theo bậc |
| `spec` | mọi owner | Thân cột (`column`), cộng vào nhãn `về spec` |
| `blocked`, `escalated` | mọi owner | khối **Phía Capu** (không vào tầng nào, không vào ngoài đài) |
| `done` và `hours` ≤ 168 (7 ngày) | mọi owner | Bể (`pool`); nếu owner là `insight` thì đồng thời đếm vào Ống hồi (`return`) |
| `done` và `hours` > 168 | mọi owner | không đếm ở đâu |

- Số của Thân cột = việc product `new/doing/rework` + mọi việc `spec`.
- Lưới lọc hiện thêm bốn số theo `tasks[].tier`: A, B, C, và `?` (giá trị khác `A`, `B`, `C`, kể cả thiếu trường hoặc rỗng). A + B + C + `?` luôn bằng số của Lưới lọc.
- Ống hồi là tập con của Bể: một việc `insight` xong trong 7 ngày được đếm ở cả hai tầng (có chủ ý, xem Câu hỏi mở).
- Phía Capu hiện tổng và hai số con: `bị chặn n`, `leo thang m`.
- Bể hiện thêm số eval hồi quy: một số nguyên ≥ 0 lấy từ `regression_evals`; mọi giá trị khác (thiếu trường, `null`, chuỗi, số âm, số lẻ, boolean) hiện `—`. Thiếu trường không được gây lỗi console.

**Cảnh báo** (áp lên sáu tầng, trừ Bể và Ống hồi không bao giờ cảnh báo):
- **Đứng yên:** việc đang được đếm ở tầng đó, trạng thái khác `done`, `blocked`, `escalated`, có `hours` > 24 (đúng 24,0 chưa đứng yên). Tầng có n ≥ 1 việc như vậy: nhãn `đứng yên n` màu `--warn`, khung tầng màu `--warn`.
- **Về spec:** chỉ Thân cột. Có n ≥ 1 việc `spec`: nhãn `về spec n` màu `--spec`, khung tầng màu `--spec`. Có cả hai: cả hai nhãn hiện, khung màu `--spec`.
- **Phía Capu:** có ít nhất một việc thì khung màu `--bad`. Không có thì khung trung tính.
- Tầng không cảnh báo: khung trung tính (không phải `--warn`, `--spec`, `--bad`), không có nhãn cảnh báo.

**Màu mới:** biến CSS `--spec` ở `:root`, nền sáng `#7a4fc4`, nền tối `#b79af0`; phải khác `--accent`, `--bad`, `--warn`, `--ok`.

**Chuyển động:** nước chảy hay nghẽn có thể có animation, nhưng khi `prefers-reduced-motion: reduce` thì mọi phần tử trong `#dai-phun-nuoc` phải có animation `none`.

### Hợp đồng quan sát (để eval đọc được; không ép cách cài đặt)
| Phần tử | Thuộc tính / nội dung |
| --- | --- |
| Nút nhân vật | `.chr[data-agent][data-state]` (đã có từ T-019); sprite nằm trong `.chr-anim` |
| Nhãn trên bản đồ | phần tử có `data-label` ∈ `name`, `role`, `hiring`, `action` kèm `data-agent="<id>"` (nút Hoàn thành dùng `data-agent="done"`) |
| Đường đang chạy | `.run-edge` (đã có) thêm `data-kind` ∈ `run`, `review`, `rework`, `spec`; `data-from`, `data-to` (đã có) |
| Nhãn trên đường | `data-label` ∈ `tier`, `await-merge`, `spec-edge`, kèm `data-from`, `data-to` của đường |
| Thẻ bảng | `#dai-phun-nuoc` |
| Tầng | `[data-stage]` ∈ `pump, column, jet, filter, pool, return`, đúng thứ tự trong DOM; thuộc tính `data-warn` là danh sách từ `stuck`, `spec` cách nhau bằng dấu cách (rỗng nếu không cảnh báo) |
| Trường trong tầng (`[data-field]`) | `name` (tên tầng: Máy bơm, Thân cột, Tia, Lưới lọc, Bể, Ống hồi), `count` (chữ là số nguyên), `frame` (phần tử viền: SVG dùng `stroke`, HTML dùng `border-top-color`), `stuck` (chữ `đứng yên n`, chỉ có khi n ≥ 1), `spec` (chữ `về spec n`, chỉ ở Thân cột khi n ≥ 1), `tier-a`, `tier-b`, `tier-c`, `tier-none` (chữ `A 2`, `B 1`, `C 1`, `? 1`, chỉ ở Lưới lọc, luôn có), `regression` (chữ là số nguyên hoặc `—`, chỉ ở Bể) |
| Phía Capu | `[data-lane="capu"]` có `data-warn` = `capu` hoặc rỗng, và `[data-field]` ∈ `name` ("Phía Capu"), `count`, `blocked` (chữ `bị chặn n`), `escalated` (chữ `leo thang n`), `frame` |
| Ngoài đài | `[data-field="other"]` trong `#dai-phun-nuoc`, chữ `ngoài đài n` |
| Nhân vật Product | `data-state="revising"`; tooltip `Đang sửa spec` |

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` · Nhánh: `t-0xx-dai-phun-nuoc` (Engineering điền mã việc của mình).
- Một file `index.html` tĩnh, d3 như hiện tại. Không thêm thư viện, không thêm yêu cầu mạng tới host ngoài {cdnjs d3, fonts Google, raw.githubusercontent.com}, không âm thanh, không thêm kết nối live.
- Không sửa `tests/characters.js`. Không sửa eval `eval/T-020/` cho khớp code (nếu eval sai, trả về `spec`).
- Không đổi schema `dashboard.json` trong việc này; chỉ đọc `tier` và `regression_evals` nếu có (xuất hai trường đó là Mục B, việc riêng ở `tohong-hq`).
- Không chạm payment, auth, DB, dữ liệu người dùng.
- Bậc lưới lọc đề xuất: **A** (đúng bậc Capu đã đặt): UI tĩnh, eval tự động phủ cả mười tiêu chí.
- Chạy eval: dùng `d3.min.js` cục bộ (cdnjs có thể bị chặn); `NODE_PATH` trỏ tới nơi cài `playwright`.

## Tiêu chí chấp nhận và eval
Biến dùng cho lệnh: `DASH` = đường dẫn repo dashboard; `D3` = đường dẫn `d3.min.js`; `E` = `node eval/T-020/flow-fountain.js "$DASH"` chạy từ gốc `tohong-hq`, ví dụ
`cd tohong-hq && NODE_PATH=$(npm root -g) D3=/đường/dẫn/d3.min.js node eval/T-020/flow-fountain.js /đường/dẫn/tohong-hq-dashboard`.
Chạy cả bộ in một dòng `PASS` hoặc `FAIL <lý do>` ở cuối, mã thoát 0/1; thêm `--criterion N` để chạy riêng tiêu chí N.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Có nhân vật insight riêng, đúng chỗ, không đè ai; ba vị trí chưa tuyển vẫn là bóng mờ; chín vị trí cũ không đổi toạ độ (1px); roster thiếu insight thì không vẽ; insight Need Hiring thì là bóng mờ | `E --criterion 1` (dùng `eval/T-020/baseline-positions.json`, ghi từ main `d3c855b`) |
| 2 | Mỗi vị trí có nhãn vai đúng bằng `roster[].role`, đổi role trong dữ liệu thì nhãn đổi theo; xếp tên, vai, rồi Need Hiring/hành động; không nhãn nào đè nhãn nào ở 1280px và 390px | `E --criterion 2` |
| 3 | Việc `spec` vẽ đúng một đường `data-kind="spec"` reviewer → product màu `--spec`, tách khỏi đường rework cùng hai đầu, nhãn `Về spec ×2`, tooltip đúng; Product `revising` với chuyển động khác `working`, tooltip `Đang sửa spec`, nhất thời thắng `revising`; không có việc spec thì không có đường spec | `E --criterion 3` |
| 4 | Đường review có nhãn bậc (`A·C`, `B·?`), nhãn `chờ anh merge` đúng chỗ có bậc C, tooltip từng việc có `Bậc X`; ở cả 1280px và 390px | `E --criterion 4` |
| 5 | Mọi thứ của T-019 còn nguyên (số đường bàn giao và trả về, huy hiệu số việc, tooltip, act-ring, upset qua live, 390px không tràn ngang, reduced-motion, không lỗi console) và `tests/characters.js` vẫn qua | `E --criterion 5` |
| 6 | Sáu tầng đúng tên, đúng thứ tự, đếm đúng theo bảng quy tắc cho cả 8 trạng thái và cho owner product / engineering / insight / owner khác, với dữ liệu chính và với 8 bộ dữ liệu mỗi bộ một trạng thái; Phía Capu và ngoài đài đúng | `E --criterion 6` |
| 7 | Cảnh báo đứng yên (>24h, 24,0 chưa) và về spec đúng tầng, đúng nhãn, đúng màu `--warn`/`--spec`/`--bad`; tầng không cảnh báo trung tính; việc `done`, `blocked`, `escalated` không tạo cảnh báo tầng | `E --criterion 7` |
| 8 | Bể hiện `regression_evals` là số nguyên ≥ 0; mọi giá trị khác hoặc thiếu hiện `—`; dữ liệu cũ (không `tier`, không `regression_evals`) không lỗi console và Lưới lọc đếm đủ với toàn bộ ở `?` | `E --criterion 8` |
| 9 | Cùng một nguồn `dashboard.json`, cùng một kết nối live, sự kiện live làm đổi số tầng trong 1 giây không tải lại; 390px: tầng không tràn, không đè nhau, không tràn ngang; reduced-motion: 0 animation trong `#dai-phun-nuoc`; không âm thanh, không script ngoài ngoài d3, không gọi host lạ | `E --criterion 9` |
| 10 | Thư mục `docs/screenshots/T-0xx/` trong repo dashboard có đủ 36 ảnh PNG hợp lệ: mỗi bộ trong `new, doing, review, rework, spec, blocked, escalated, done, all` × `flow`/`fountain` × `wide`/`narrow`, tên `<bộ>-<bảng>-<khung>.png`, và đã được git theo dõi | tạo ảnh: `E --shots "$DASH/docs/screenshots/T-0xx"`; kiểm: `E --criterion 10 --task T-0xx` |

Phần nhìn mà máy không kiểm được (cảm giác nhân vật, dễ đọc ở 390px, nền tối, ảnh có nhúng vào PR) nằm ở `eval/T-020/checklist.md`; checklist **bổ sung** cho tiêu chí 1–4, 7, 9, 10, không thay eval nào ở trên.

## Mục B. Nhu cầu cho `scripts/export_dashboard.py` (việc riêng ở `tohong-hq`, bậc A)

Mục này là spec độc lập. Chief of Staff tạo một việc Engineering ở `tohong-hq` với bốn eval B1 đến B4. Không phụ thuộc thứ tự với việc dashboard: dashboard đã chịu được thiếu cả hai trường.

**Thay đổi bắt buộc**
1. `tasks[].tier`: kiểu chuỗi, một trong `"A"`, `"B"`, `"C"`, hoặc `""` nếu file việc không có dòng `tier`. Lấy nguyên từ phần đầu file `board/T-xxx.md` (`task.read_task` đã trả `meta["tier"]`, rỗng nếu thiếu). Có trong `dashboard.json`, `tasks.json`, và cả bản `--public`.
2. `regression_evals` (cấp cao nhất của `dashboard.json`, cùng cấp `generated_at`): kiểu số nguyên ≥ 0, hoặc `null` khi thư mục `eval/regression/` không tồn tại. Giá trị = số mục **cấp một** trong `eval/regression/` (file hoặc thư mục), **trừ** tên bắt đầu bằng `.` và trừ `README.md`. Mỗi mục là một eval hồi quy (một sự cố một mục). Thư mục chỉ có `.gitkeep` cho `0`. Có ở cả bản thường lẫn `--public`. Không đếm đệ quy.
3. Không đổi hay bỏ trường cũ; bản `--public` vẫn bỏ `detail` và `link` của sự kiện; script vẫn chỉ đọc sổ cái, không ghi vào repo.

Ranh giới: thêm hai trường này không phải thay đổi schema DB hay dữ liệu người dùng; `dashboard.json` công khai chỉ thêm một chữ cái bậc và một con số.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| B1 | `tasks[].tier` đúng với file việc (`A`, `B`, `C`, thiếu thì `""`), kiểu chuỗi, có ở `dashboard.json` và `tasks.json`, bản thường và `--public` | `python3 eval/T-020/export/check_export.py --criterion B1` |
| B2 | `regression_evals` là số nguyên đúng quy tắc đếm (bỏ `.gitkeep`, `README.md`, tên bắt đầu `.`; đếm file lẫn thư mục cấp một; chỉ `.gitkeep` thì `0`), có ở cả hai bản | `python3 eval/T-020/export/check_export.py --criterion B2` |
| B3 | Không có thư mục `eval/regression/` thì `regression_evals` có mặt và bằng `null` (không phải `0`, không bỏ trường) | `python3 eval/T-020/export/check_export.py --criterion B3` |
| B4 | Không làm hỏng cũ: đủ trường cũ của `tasks`, `events`, `roster` còn; `--public` vẫn bỏ `detail`/`link`; không ghi vào sổ cái nguồn | `python3 eval/T-020/export/check_export.py --criterion B4` |

Eval B chạy trên bản sao tạm qua `TOHONG_ROOT`, nên không đụng sổ cái thật. Sau khi B xong, workflow đẩy `dashboard-data` tự mang hai trường sang dashboard; tiêu chí 4, 5 (bậc) và 8 (con số ở Bể) của việc dashboard chỉ hiện đủ trên dữ liệu thật khi B đã merge, nhưng eval của việc dashboard chạy bằng dữ liệu giả nên không phải chờ.

## Không làm
Vẽ lại bố cục Bản đồ luồng (chỉ thêm insight, nhãn vai, đường spec, nhãn bậc); đổi schema `dashboard.json` trong việc dashboard (chỉ đọc); đổi các bảng khác (Đội ngũ, Cảnh báo, Kanban, Dòng thời gian, Hoạt động); âm thanh; thư viện ngoài; đổi tên hay thêm trạng thái ở `task.py`; hiện danh sách việc theo từng tầng (chỉ hiện số).

## Câu hỏi mở
Tầng Ống hồi (sự cố → eval hồi quy → quay lại Máy bơm) chưa có trạng thái nào của `task.py` ứng với nó; em đang đếm là "việc `insight` đã xong trong 7 ngày" (trùng với Bể) và để số eval hồi quy ở Bể đúng như tiêu chí 8. Anh có muốn Ống hồi đếm thứ khác (ví dụ chính số eval hồi quy) không? Nếu anh không trả lời, giữ nguyên cách đếm trên.
