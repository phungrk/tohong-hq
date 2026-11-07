# Spec T-092: Knowledge Reservoir hiện đúng số và mở drawer liệt kê bể

## Ý định
Capu 2026-11-07: "tại sao trên mô hình KNOWLEDGE RESERVOIR lại hiển thị 0 bất biến · 0 eval đối kháng · 0 hồi quy ?? Trong khi bể kiến thức đã có rất nhiều knowledge... khi user click vào KNOWLEDGE RESERVOIR thì mở drawer KNOWLEDGE RESERVOIR, trong đó hiển thị KNOWLEDGE RESERVOIR đã ghi".

## Bằng chứng
- `board/T-092.md` (nguyên nhân đã điều tra): commit 641f502 (2026-11-04) bỏ khối `model` khỏi `scripts/export_dashboard.py`; trang (`drawModel`, repo dashboard `index.html`) vẫn đọc `D.model` nên mọi số về 0. Bản cũ: `git show 641f502 -- scripts/export_dashboard.py`.
- Bể thật hôm nay (đo 2026-11-07 bằng `find`): 112 file `inv-*` dưới `eval/invariants/`; 36 file `products/`; `eval/regression/` chỉ có `.gitkeep` (0 hồi quy thật, số 0 này đúng); `adv-*` nằm trực tiếp trong `eval/T-*/`: xem tiêu chí 7 (spec không ghi cứng số).
- `.github/workflows/publish-dashboard-data.yml:39` luôn chạy `--public`, nên bản đang chạy trên trang chính là bản công khai.
- Quy tắc lọc đã có: `products/T-041-loc-san-pham.md` H2 (số bất biến = `_shared` + sản phẩm), H3 (số eval đối kháng, hồi quy không lọc), H4 (dòng cây `data-kr-scope`). Spec này giữ nguyên H2-H4.
- Tương tác modal đã có: `products/T-076-modal-viec-cho-capu.md` / T-078 (`#capu-modal`: X, Esc bắt ở window, chạm ngoài, Tab giữ trong modal, trả focus về khối).
- Mức tự tin: 90% về nguyên nhân và hợp đồng dữ liệu; 70% rằng Capu hài lòng với dạng danh sách (chưa thấy mẫu).

## Giả thuyết
Nếu khôi phục khoá `model` và cho bấm khối mở danh sách thì Capu thấy đúng số (112 hôm nay) và đọc được từng bất biến mà không phải mở repo. Chỉ số bảo vệ: mọi eval T-041/T-076/T-078 hiện có vẫn xanh.

## Hành vi (người dùng thấy gì)

### A. Hợp đồng dữ liệu `dashboard.json` -> `model`
Exporter (`scripts/export_dashboard.py`, cả có và không `--public`) xuất khoá cấp gốc `model` là một đối tượng có đúng các khoá sau (giữ khoá cũ để trang hiện tại chạy ngay):

| Khoá | Kiểu | Định nghĩa |
| --- | --- | --- |
| `invariants` | `{vùng: số nguyên}` | Với mỗi **file thường** có tên bắt đầu `inv-` nằm ở bất kỳ độ sâu nào dưới `eval/invariants/`: vùng là thư mục chứa nó, tính từ `eval/invariants/`, dấu `/`, vd `_shared`, `hq/dashboard/model`. Thư mục tên `inv-…` và file không bắt đầu `inv-` (vd `lib/*.cjs`, `README.md`) không tính. Chỉ có vùng có >= 1 file. |
| `invariants_total` | số nguyên | Số file nói trên. Bằng tổng `invariants` và bằng `len(invariant_list)`. |
| `invariant_list` | mảng | Mỗi file `inv-*` một phần tử (xem dưới). |
| `adversarial_evals` | số nguyên | Số file thường có tên bắt đầu `adv-` nằm **trực tiếp** trong `eval/T-<số>/` (độ sâu 1). Không tính `adv-*` trong thư mục con (`lib/`, `bat-bien-cho-merge/`…) và không tính ngoài `eval/T-*/`. |
| `regression_evals` | số nguyên | Số mục cấp một của `eval/regression/` trừ tên bắt đầu `.` và `README.md` (đúng quy tắc hiện có của khoá cấp gốc); 0 nếu thiếu thư mục. |
| `specs` | số nguyên | Số file khớp `products/T-*.md`. |
| `insight_reports` | số nguyên | Số file khớp `insights/*-weekly.md`. |
| `last_insight` | chuỗi | Tên file cuối (sắp tăng dần theo tên) trong số đó; `""` nếu không có. |

Khoá cấp gốc `regression_evals` (đang có, null khi thiếu thư mục) giữ nguyên, không xoá.

Phần tử của `invariant_list`: `{"area", "id", "slug", "name", "source", "url"}` và thêm `"path"` **chỉ khi không `--public`**:
- `area`: như khoá của `invariants`.
- `id`: `"INV-"` + số trong tên file, giữ nguyên chữ số (`inv-004-x.sh` -> `INV-004`). Tên file chỉ có `inv-` mà không có số: `id` = `"INV-?"`.
- `slug`: tên file bỏ tiền tố `inv-<số>-` và đuôi sau dấu chấm cuối (`inv-004-pool-trung-gian.py` -> `pool-trung-gian`).
- `name`: lấy từ **12 dòng đầu** của file (đọc UTF-8, lỗi giải mã thì thay ký tự), theo thứ tự ưu tiên: (1) dòng đầu tiên chứa `Bất biến` (có thể kèm `(…)` ngay sau) rồi dấu `:`: lấy phần sau dấu `:` đó; (2) nếu không có, dòng đầu tiên có dạng `INV-<số> · <chữ>`: lấy `<chữ>`; (3) nếu không có, `slug` thay `-` bằng dấu cách. Sau đó: bỏ khoảng trắng và dấu `"` thừa hai đầu, cắt tại dấu chấm đầu tiên có dấu cách theo sau (". "), rồi nếu dài hơn 140 ký tự thì giữ 140 ký tự đầu (bỏ khoảng trắng cuối) và thêm `…`. Một dòng, không xuống dòng.
- `source`: trong 12 dòng đầu, dòng đầu tiên chứa `Nguồn:`; lấy mã `T-<số>` đầu tiên trong phần sau `Nguồn:` của dòng đó (vd `T-074`); không có thì `""`.
- `url`: `https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/<area>/<tên file>`.
- `path` (chỉ bản không `--public`): `eval/invariants/<area>/<tên file>`, tương đối so với gốc repo.
Thứ tự: `_shared` đứng trước, các vùng còn lại sắp tăng dần theo chuỗi vùng; trong một vùng sắp theo số nguyên trong tên (`inv-2` trước `inv-10`), hòa thì theo tên file.

Bản `--public`: không có khoá `path`; không trường nào của `model` chứa đường dẫn tuyệt đối của máy (`/home/`, `/root/`, `/tmp/`, `C:\`) và không chứa bất kỳ dòng nào của thân eval (chỉ `name` lấy từ dòng mô tả đầu file là chữ của file được xuất). Bản không `--public` giống bản public trừ khoá `path`.

### B. Khối Knowledge Reservoir trên mô hình (`#nd_kr`)
- `#krTxt` hiện `<a> bất biến · <b> eval đối kháng · <c> hồi quy` với `a` theo T-041 H2 (Tất cả: `invariants_total`; chọn sản phẩm P: bất biến của `_shared` + của P), `b = model.adversarial_evals`, `c = model.regression_evals` (T-041 H3: hai số này không lọc, nhãn `#krNote` như hiện có). Với dữ liệu đúng, số không còn 0 giả.
- Dòng cây `[data-kr-scope]`, `#nd_kr .lbl`, `#insCap` giữ đúng T-041 H2-H4; chúng sống lại nhờ khoá `model` được khôi phục.
- Thiếu khoá `model` trong dữ liệu cũ: giữ hành vi hiện có của trang (không đổi chữ).

### C. Bấm khối mở drawer
- Bấm (chuột/chạm), hoặc Enter/Space khi khối có focus bàn phím, vào `#nd_kr` mở drawer. `#nd_kr` có `tabindex="0"`, `role="button"`, `aria-label` = `Knowledge Reservoir, <a> bất biến, bấm để xem danh sách` (`a` như `#krTxt`, cập nhật theo bộ lọc). Bấm vào **nhân vật** nằm trên khối vẫn mở tóm tắt T-037 như cũ, không mở drawer. Bấm khối không làm đổi bộ chọn sản phẩm, chế độ phóng to hay dữ liệu.
- Drawer là phần tử `#kr-drawer` (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="kr-title"`), ẩn bằng thuộc tính `hidden` khi đóng; dạng ngăn kéo sát mép phải, rộng `min(560px, 100%)`, cao hết khung nhìn; có lớp nền mờ phủ cả trang. Hiện trên cùng: trên `#capu-modal`, trên chế độ phóng to sơ đồ (T-036) và trên tóm tắt nhân vật.
- Khi mở, focus vào nút đóng `#kr-drawer-close` (nhãn `Đóng`, chữ `×`, vùng bấm >= 44x44px).
- Tiêu đề `#kr-title`: `Knowledge Reservoir (<a> bất biến)`, `a` như `#krTxt`.
- Hàng số `[data-kr-stat]` (bốn phần tử, thuộc tính `data-kr-stat` lần lượt `invariants`, `adversarial`, `regression`, `specs`), mỗi phần tử có `data-value` = số nguyên: `invariants` = `a`; `adversarial` = `model.adversarial_evals`; `regression` = `model.regression_evals`; `specs` = `model.specs`. Chọn sản phẩm khác Tất cả thì phần tử `specs` không hiện (không có trong DOM), như T-041 H2.
- Danh sách theo cây vùng: mỗi vùng có >= 1 bất biến trong phạm vi lọc là một phần tử `[data-kr-area="<vùng>"]` (đúng khoá của `invariants`), theo thứ tự `invariant_list`, chứa tên vùng ở đầu và các dòng `[data-kr-inv]`, mỗi bất biến đúng một dòng, thứ tự như `invariant_list`. Phạm vi lọc: Tất cả -> mọi phần tử; chọn P -> phần tử có `area` = `_shared`, hoặc = P, hoặc bắt đầu `P/` (vùng chưa có tiền tố sản phẩm không hiện khi lọc). Tổng số dòng `[data-kr-inv]` = `a` = `data-value` của `invariants`.
- Mỗi dòng `[data-kr-inv]` có thuộc tính `data-area`, `data-id` (`INV-004`) và `data-source` (mã `T-xxx` hoặc rỗng), và hiện: mã (`INV-004`), tên (`name`), `nguồn <T-xxx>` (không hiện chữ nguồn nếu `source` rỗng), và một liên kết `a[data-kr-link]` chữ `Mở trên GitHub`, `href` = `url`, `target="_blank"`, `rel="noopener noreferrer"`. Tên dài không làm tràn ngang (xuống dòng trong khung).
- Khi chọn P, ngay trên danh sách có đúng một phần tử `[data-kr-filter]` với chữ `Đang lọc theo sản phẩm: <P>. Eval đối kháng và hồi quy tính cả công ty.`; chọn Tất cả thì không có phần tử này.
- Dữ liệu thiếu `model.invariant_list` (dữ liệu cũ) hoặc rỗng trong phạm vi lọc: không có dòng `[data-kr-inv]`, có đúng một `[data-kr-empty]` chữ `Chưa có bất biến nào trong phạm vi này`.
- Đổi bộ chọn sản phẩm hay dữ liệu tải lại khi drawer đang mở: nội dung và `a` cập nhật tại chỗ, drawer không tự đóng, vị trí cuộn trong drawer được giữ (không nhảy về đầu) nếu nội dung không đổi.

### D. Đóng và dùng được trên điện thoại
- Đóng bằng: bấm `#kr-drawer-close`; phím `Esc` (bắt ở `window` giai đoạn bắt, `stopImmediatePropagation`, như modal Capu, nên không thoát luôn chế độ phóng to hay đóng tóm tắt nhân vật cùng lúc); bấm/chạm vào lớp nền ngoài khung drawer. Bấm vào trong khung drawer (kể cả chữ, khoảng trống) không đóng.
- Đóng xong: `#kr-drawer` có `hidden`, focus về `#nd_kr`. Phím `Tab`/`Shift+Tab` xoay vòng trong drawer (nút đóng và các liên kết), không ra ngoài.
- Khung nhìn 390px: khung drawer rộng đúng bề rộng khung nhìn (không tràn: `scrollWidth <= clientWidth`, trang không phát sinh cuộn ngang), nút đóng nằm trọn trong khung nhìn, danh sách cuộn dọc trong drawer, mọi liên kết `a[data-kr-link]` cao >= 32px. Ở 1280px khung rộng tối đa 560px, sát mép phải.
- Trong chế độ phóng to sơ đồ (T-036, nút `#model-zoom`): bấm `#nd_kr` vẫn mở drawer và drawer hiện trên cùng; `Esc` đóng drawer, sơ đồ vẫn phóng to; `Esc` lần nữa mới thoát phóng to.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq` (exporter, eval) và `phungrk/tohong-hq-dashboard` (`index.html`). Nhánh: `t-092-knowledge-reservoir`. Vùng (`area`): `hq/dashboard`.
- Bất biến đã đọc: `_shared/` (inv-001 không secret, inv-002 sổ cái đọc được), `hq/` (inv-001, inv-002), `hq/dashboard/` (inv-008, inv-012, inv-014 và `lib/`), `hq/dashboard/model/` (inv-003..inv-033). Spec không vi phạm: không đổi vị trí khối, `data-kr-scope`, `krTxt`, cây T-041 (inv về chữ khối, inv-026/033 không che chữ), không đụng nhân vật (inv-015..019); drawer là lớp mới ngoài `#model` nên không che chữ khối khi đóng. Không đề nghị đổi bất biến nào.
- Phạm vi file: chỉ `scripts/export_dashboard.py`; trong `index.html` chỉ khối `#nd_kr` (thêm thuộc tính), `drawModel` (phần bể), CSS/HTML/JS của `#kr-drawer`. T-090 (sơ đồ) và T-091 (Kanban) đang sửa `index.html`: không đổi bố cục SVG, bảng, cột Kanban; xung đột ở `index.html` do Engineering rebase.
- Không chạm payment, auth, DB, dữ liệu người dùng. Bậc A (eval tự động phủ hết tiêu chí).
- Bản công khai: `url` trỏ tới repo GitHub (như các link PR trong `capu_queue`); không có đường dẫn máy; không có thân eval.

## Tiêu chí chấp nhận và eval
Môi trường chung cho eval trình duyệt: `D3=/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js NODE_PATH=$(npm root -g)` (Playwright, Chromium); trang là `index.html` của repo dashboard (biến `TOHONG_DASHBOARD_REPO`, mặc định `/home/user/tohong-hq-dashboard`) với dữ liệu cố định chặn từ mạng; eval cuộn phần tử vào khung nhìn trước khi bấm và bấm bằng toạ độ chuột thật tại điểm mà `elementFromPoint` trả về phần tử của khối.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Hợp đồng dữ liệu A: trên sổ cái tạm có đủ biến thể (đủ ba dạng dòng mô tả, thiếu mô tả, tên dài, vùng cũ, thư mục `inv-…`, `adv-*` ở độ sâu 1 và sâu hơn, hồi quy, spec, insight) `model` có đúng các khoá, số, `id`, `slug`, `name`, `source`, `url`, `path`, thứ tự như định nghĩa | `cd /home/user/tohong-hq && python3 eval/T-092/export-be.py --criterion 1` |
| 2 | Khối `#nd_kr` hiện số đúng: Tất cả, hq, planner, với `#krTxt`, `[data-kr-scope]`, `#nd_kr .lbl` theo T-041 | `cd /home/user/tohong-hq && D3=… NODE_PATH=$(npm root -g) node eval/T-092/check.cjs --criterion 2` |
| 3 | Bấm khối (chuột, và Enter/Space) mở `#kr-drawer` với đúng tiêu đề, `[data-kr-stat]`, nhóm vùng, dòng bất biến, liên kết GitHub, trạng thái rỗng; bấm nhân vật không mở | `… node eval/T-092/check.cjs --criterion 3` |
| 4 | Đóng bằng X, Esc, chạm ngoài, không đóng khi bấm trong; focus vào/ra; Tab xoay vòng; 390px không tràn; trong chế độ phóng to Esc chỉ đóng drawer | `… node eval/T-092/check.cjs --criterion 4` |
| 5 | Bộ lọc sản phẩm áp vào drawer: số dòng, nhóm, `[data-kr-filter]`, ẩn `specs`; đổi bộ chọn khi drawer mở thì cập nhật tại chỗ, không đóng | `… node eval/T-092/check.cjs --criterion 5` |
| 6 | Bản `--public`: không có `path`, không chuỗi đường dẫn máy, không dòng thân eval (mốc `SECRET_BODY_SENTINEL_92`), số và `name` đúng, `url` đúng dạng; bản thường có `path` tương đối | `cd /home/user/tohong-hq && python3 eval/T-092/export-be.py --criterion 6` |
| 7 | Trên sổ cái thật (cả hai chế độ): `invariants_total` = số file `inv-*` đếm độc lập bằng cách khác = tổng `invariants` = `len(invariant_list)`; từng vùng khớp; `adversarial_evals` khớp đếm độc lập; mọi `path` tồn tại; tổng > 0 | `cd /home/user/tohong-hq && python3 eval/T-092/export-be.py --criterion 7` |

Ánh xạ với 5 tiêu chí trong `board/T-092.md`: (1) -> eval 1, 2, 7; (2) -> eval 3; (3) -> eval 4, 5; (4) -> eval 6; (5) -> eval 7 và bất biến đề xuất.

## Bất biến đề xuất (tầng 2)
1. **`hq/dashboard`: số bất biến trên khối bể bằng số file `inv-*` thật.** Chạy exporter trên sổ cái thật (có và không `--public`): `model.invariants_total` = số file thường `inv-*` dưới `eval/invariants/`, = tổng `model.invariants`, = `len(model.invariant_list)`, > 0; mỗi phần tử có `url`; không có `/home/` hay `/root/` trong `model`. Bản nháp chạy được: `eval/T-092/inv-proposed-so-be-khop-file-that.py` (Spec critic rút vào `eval/invariants/hq/dashboard/` khi spec qua cổng). Chặn đúng lỗi lần này: một lần sửa exporter sau này lỡ bỏ khối `model` làm số về 0 mà không ai thấy.

## Không làm
- Không đổi cấu trúc thư mục bể, không thêm/sửa/xoá bất biến hay eval nào.
- Không đếm eval đối kháng hay hồi quy theo sản phẩm (T-041 H3 giữ nguyên); không tải nội dung eval vào drawer; không có ô tìm kiếm hay mở rộng/thu gọn nhóm.
- Không đổi chữ `#krTxt` khi thiếu `model`; không sửa chữ chân trang `footer` của bản công khai.
- Không đổi bố cục SVG mô hình, bảng, Kanban (T-090, T-091), không đụng modal Capu ngoài việc dùng chung quy ước.
- Không liệt kê bất biến chờ merge ở `eval/T-xxx/bat-bien-cho-merge/` (ADR-028: chưa vào bể).

## Câu hỏi mở
Bản công khai đang đi qua `--public` và hiển thị `name` lấy từ dòng mô tả đầu mỗi file bất biến cùng liên kết GitHub. Nếu repo `phungrk/tohong-hq` là công khai thì mô tả bất biến cũng công khai: mặc định spec cho hiện (đã cho Capu đọc được); nói nếu muốn bản công khai chỉ hiện mã và `slug`.
