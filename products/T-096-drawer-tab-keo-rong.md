# Spec T-096: Drawer Knowledge Reservoir có tay nắm kéo rộng, ba tab và Xem thêm 10

## Ý định
Capu 2026-11-07: "Update UI Knowledge Drawer: width: user có thể nắm kéo để tăng bề rộng của drawer. min là width hiện tại, max = 90% màn hình. Nội dung chia là 3 tab: bất biến, eval đối kháng và hồi quy. Số lượng knowledge sẽ hiển thị trong tab. Có nút load more để hiển thị thêm nội dung danh sách trong tab, mỗi lần hiển thị 10 items." (`board/T-096.md`)

## Bằng chứng
- Drawer hiện tại: `products/T-092-knowledge-reservoir-drawer.md` (mục C, D) và code `origin/main` của `phungrk/tohong-hq-dashboard`: `#kr-drawer`, `krDraw()`, khung `[data-kr-panel]` rộng `min(560px,100%)`, hiện mọi bất biến một lượt (112+ dòng), chỉ có số cho eval đối kháng và hồi quy.
- Exporter `scripts/export_dashboard.py` (`build_model`) chỉ xuất `invariant_list`; `adversarial_evals` và `regression_evals` là số đếm. Đo 2026-11-07 bằng `ls eval/T-*/adv-*`: 136 file `adv-*` ở độ sâu 1 (62 `.py`, 66 `.sh`, 8 `.cjs`); `eval/regression/` chỉ có `.gitkeep` (0 mục).
- Đầu file `adv-*` không theo một khuôn (nên tên lấy từ slug trước, comment sau, xem mục A): shebang rồi `# Eval đối kháng T-023 (adversary). Chạy trong repo…`, hoặc `"""T-052 adv-01 (adversary, tầng 3). Spec …`, hoặc khối `/* … * Eval đối kháng (tầng 3) của T-057, …`. Vì vậy quy tắc tên dưới đây phải bỏ shebang, bỏ "thẻ" `Eval đối kháng`/`T-xxx`/`adv-nn`/`(adversary)` ở đầu dòng, và lọc dòng code bằng mục A của T-094.
- Nút "Xem thêm" đã có ở `products/T-089-kanban-xong-10-gan-nhat.md` (`Xem thêm · còn N việc`, +10 mỗi lần, reset khi đổi bộ chọn). Spec này dùng cùng mẫu chữ `Xem thêm · còn N`.
- Quy tắc lọc sản phẩm `products/T-041-loc-san-pham.md` H3: chỉ bất biến lọc theo sản phẩm; eval đối kháng và hồi quy tính cả công ty.
- Mức tự tin: 90% về hợp đồng dữ liệu và hành vi; 70% rằng Capu thấy tên eval đối kháng đủ đọc (tên lấy từ comment đầu file, chất lượng tuỳ người viết; chưa thấy mẫu thật).

## Giả thuyết
Nếu chia drawer thành ba tab, mỗi tab 10 mục đầu và cho kéo rộng thì Capu đọc được tên dài mà không cuộn qua 112+ dòng một lượt, và thấy được danh sách eval đối kháng/hồi quy (hiện chỉ có số). Chỉ số bảo vệ: mọi eval T-092/T-093/T-041 về drawer còn xanh (xem "Ảnh hưởng tới eval cũ"), INV-009, INV-017 xanh.

## Phụ thuộc và thứ tự merge
- **T-094 merge trước T-096.** Cả hai sửa `scripts/export_dashboard.py` (T-094: `kr_name`, `build_model` phần `area`/`_root`; T-096: `build_model` thêm hai danh sách và tên eval). T-096 **dùng lại** hàm "dòng code/đường dẫn máy" (mục A của T-094, `looks_like_code`) cho tên eval, nên không cài đặt được khi T-094 chưa có. Xung đột `export_dashboard.py` do Engineering của T-096 rebase sau T-094.
- Eval T-096 `export-be.py` nạp `eval/T-094/namerule2.py` (có sẵn khi T-094 vào `main`).
- `index.html` (repo dashboard): T-096 chỉ chạm CSS/HTML/JS của `#kr-drawer` và `krDraw`/`krOpen`/`krClose`/`krInit`; không đổi SVG, bảng, Kanban (T-089/T-090/T-091).

## Hành vi (người dùng thấy gì)

### A. Hợp đồng dữ liệu `dashboard.json` → `model` (cả bản thường và `--public`)
Giữ nguyên mọi khoá T-092/T-094. **Thêm hai khoá mảng**:

| Khoá | Định nghĩa |
| --- | --- |
| `adversarial_list` | Mỗi file thường tên bắt đầu `adv-` nằm **trực tiếp** trong `eval/T-<số>/` (đúng tập mà `adversarial_evals` đếm) là một phần tử. `len(adversarial_list) == adversarial_evals`. |
| `regression_list` | Mỗi mục cấp một của `eval/regression/` trừ tên bắt đầu `.` và `README.md` (đúng tập mà `regression_evals` đếm; file hay thư mục) là một phần tử. `len(regression_list) == regression_evals`. Thiếu thư mục thì `[]`. |

Phần tử có **đúng** các khoá `id`, `file`, `name`, `source`, `url`, và thêm `path` **chỉ khi không `--public`**:
- `file`: tên file hoặc thư mục (`adv-01-dieu-huong.sh`).
- `id`: `file` bỏ đuôi sau dấu chấm cuối nếu là file thường (`adv-01-dieu-huong`, `adv-vv`); thư mục thì `file` nguyên văn.
- `source`: adversarial = tên thư mục cha (`T-023`). Regression = mã `T-<số>` đầu tiên trong `file` (khớp phân biệt hoa, `T-` in hoa), không có thì `""`.
- `url`: `https://github.com/phungrk/tohong-hq/blob/main/eval/<T-xxx>/<file>` cho adv; `.../blob/main/eval/regression/<file>` cho file regression; `.../tree/main/eval/regression/<file>` cho thư mục regression.
- `path` (chỉ không `--public`): `eval/<T-xxx>/<file>` hoặc `eval/regression/<file>`.
- `name` của **eval đối kháng** (v2, sau phân xử Chief of Staff theo defect T-096-D1: tên lấy từ slug trước, vì comment đầu file của bể thật cho 6 dòng cùng tên và nhiều mẩu câu). Tên có dạng `<mã> · <nhãn>`, trong đó `<mã>` là `adv-` cộng cụm ký tự đầu tiên sau `adv-` đến dấu `-` kế tiếp hoặc hết tên (đã bỏ đuôi): `adv-03`, `adv-vv`. Nhãn, thử lần lượt:
  1. **Slug:** phần tên file (bỏ đuôi sau dấu chấm cuối) sau `adv-<cụm>-`, tách theo `-`, `_`, khoảng trắng. Từ **2 từ trở lên**: nhãn = các từ nối bằng một dấu cách (`adv-03-nhan-khong-de-chu.sh` → `adv-03 · nhan khong de chu`). Slug rỗng hoặc 1 từ (`adv-01.py`, `adv-vv.cjs`, `adv-01-rewrite.py`) thì bước 2.
  2. **Dòng comment đầu:** lấy 12 dòng đầu (UTF-8, lỗi giải mã thì thay ký tự); bỏ dòng bắt đầu `#!`; làm sạch từng dòng như T-092 mục A (bỏ khoảng trắng, `#`, `//`, ba dấu nháy ở đầu, ba dấu nháy ở cuối) và thêm: bỏ `/*`, `*` (lặp) ở đầu và `*/` ở cuối. Bỏ "thẻ" ở **đầu dòng**, lặp tới khi hết, không phân biệt hoa thường: `eval đối kháng`, `eval tầng 3`, `adversary`, `tầng 3`, `adv-<số>`, `T-<số>`, `của`, `cho`, `lần <số>`, `v<số>`, `<số>:`, một cặp ngoặc tròn `(…)`, khoảng trắng và các ký tự `· : , ; . — – -`. **`của` và `cho` chỉ là thẻ khi là một từ trọn**: ngay sau nó là khoảng trắng, hết dòng, hoặc một ký tự trong `· : , ; . — – -` (`cho kiểm tra …` mất `cho`; `chorus …` và `chodoi …` giữ nguyên). Các thẻ còn lại khớp theo tiền tố, không cần ranh giới. Co mọi dãy khoảng trắng thành một dấu cách. **Cắt** tại dấu chấm đầu tiên có dấu cách theo sau (". "), bỏ dấu `:` và `.` thừa ở cuối. **Thứ tự cố định: bỏ thẻ, co khoảng trắng, cắt tại ". ", rồi mới loại ứng viên, rồi mới cắt 140 ký tự.** (Phần sau ". " như `cd /home/…` không được xét khi loại; vì vậy `Case 1 (xem adv-vv.cjs). cd /home/user/… && bash …` cho nhãn `Case 1 (xem adv-vv.cjs)`, không rơi về tên file. Lý do chọn thứ tự này: nhãn đọc được thay vì tên file trơ, và phần bị cắt vốn không hiện ra.) Ứng viên bị **loại** nếu, sau bước cắt ". " (trước khi cắt 140 ký tự): ngắn hơn 12 ký tự; rơi vào mục A của T-094 (`looks_like_code`, gồm đường dẫn máy); chứa tên biến HOA gán giá trị (khớp `\b[A-Z][A-Z0-9_]*=`); chứa `.md` hoặc `lib/`; bắt đầu bằng `và` hoặc `chạy` là một từ trọn (ngay sau là ký tự không phải chữ cái hay chữ số, hoặc hết dòng; không phân biệt hoa thường; `Chạy: bash …` bị loại, `chạyxong …` thì không); số `(` khác số `)`; số dấu `"` lẻ. Dòng đầu tiên có ứng viên không bị loại cho nhãn; nếu **nhãn** dài hơn 140 ký tự thì giữ 140 ký tự đầu, bỏ khoảng trắng cuối, thêm `…` (nhãn tối đa 141 ký tự). Giới hạn này áp lên **nhãn**, không áp lên cả `name`: `name` = `<mã> · <nhãn>` nên tối đa `len(<mã>) + 3 + 141` ký tự (`adv-vv · ` + 141 = 150). Nhãn slug (bước 1) và tên file (bước 3) không bị cắt.
  3. **Tên file:** không có nhãn thì `name` = tên file đầy đủ, **không có mã** (`adv-02.sh`).
  4. **Không trùng trong một việc** (hai lượt, theo thứ tự): (a) nếu hai file cùng việc có nhãn bước 2 **giống nguyên văn**, cả hai dùng tên file (bước 3). (b) Sau (a), xét mọi `name` đã có trong một việc: **mọi file có `name` trùng một file khác cùng việc dùng tên file, bất kể nhãn đến từ bước 1 hay bước 2** (ca hai file cùng mã và cùng slug, khác đuôi: `adv-01-a-b.sh` và `adv-01-a-b.py` đều thành `adv-01-a-b.sh` / `adv-01-a-b.py`). Không còn ngoại lệ "nhãn slug không đổi". Tên file khác nhau trong một thư mục nên hệ quả luôn đúng: trong một việc không bao giờ có hai mục cùng `name`.
- `name` của **hồi quy**: không có mã; nhãn từ comment cũng cắt 140 ký tự + `…` như trên (tối đa 141). File: slug = tên file bỏ đuôi, tách như trên; từ 2 từ trở lên thì nhãn = các từ nối bằng dấu cách (`reg-T-050-so-dem.sh` → `reg T 050 so dem`); ngược lại bước 2 (comment) và bước 3 (tên file) như trên. Thư mục: tên thư mục thay `-` và `_` bằng dấu cách (không đọc nội dung).
- `name` không bao giờ rỗng, một dòng, không chứa `/home/`, `/root/`, `/tmp/`, `handoffs/`, `C:\`.
- Đo trên 144 file `adv-*` thật hôm nay (2026-11-07, đếm lại sau khi T-098 thêm 5 file; v2 đo 139), bảng ở `handoffs/T-096-v3.md` (thay bảng v2): 136 có `<mã> · <nhãn>`, 8 là tên file, 0 trùng tên trong một việc; `name` dài nhất 150 ký tự (T-057 `adv-vv.cjs`, T-034 `adv-01.sh`), mọi nhãn ≤ 141.

**Thứ tự.** `adversarial_list`: số trong `source` giảm dần (việc mới nhất trước; `T-100` đứng trước `T-99`), trong một việc theo `file`: tách tên file thành cụm chữ số và cụm khác, so lần lượt từng cụm; cụm số so như số nguyên (`adv-2` trước `adv-10`), cụm khác so không phân biệt hoa thường, và `adv-<số>…` đứng trước `adv-<chữ>…` (`adv-01.sh` trước `adv-vv.cjs`). `regression_list`: `file` theo cùng cách so (cụm số như số nguyên, không phân biệt hoa thường). `invariant_list` giữ thứ tự T-092/T-094.

**Bản `--public`:** không có khoá `path` ở hai danh sách mới; không chuỗi đường dẫn máy; không dòng thân eval nào ngoài dòng mô tả được chọn làm `name`. Bản thường giống bản public trừ `path`.

### B. Bố cục drawer và tab
Giữ nguyên T-092 mục C, D (mở bằng khối, tiêu đề, hàng `[data-kr-stat]`, `[data-kr-filter]`, đóng, focus, 390px), **thêm**:
- Dưới hàng số và `[data-kr-filter]` là `role="tablist"` gồm đúng ba `button[role=tab][data-kr-tab]` theo thứ tự: `invariants` (chữ `Bất biến <n>`), `adversarial` (`Eval đối kháng <n>`), `regression` (`Hồi quy <n>`); chữ đúng "tên, một dấu cách, số nguyên". Mỗi tab có `data-count` = n và `aria-selected`. Cao >= 40px. Chỉ tab đang chọn có `tabindex="0"`, hai tab kia `-1` (roving).
- `n` của `invariants` = số bất biến theo T-041 H2 (= `data-value` của `[data-kr-stat=invariants]` = `a` trong tiêu đề); `n` của `adversarial` = `model.adversarial_evals`; `n` của `regression` = `model.regression_evals`. Số trên tab luôn bằng số trên `[data-kr-stat]` tương ứng.
- **Tab mặc định:** `invariants` mỗi lần trang tải. **Nhớ tab:** đóng rồi mở lại drawer trong cùng lần tải trang giữ tab đã chọn; tải lại trang thì về `invariants`; không lưu ra `localStorage`/`sessionStorage`.
- Chỉ nội dung của tab đang chọn có trong DOM, trong một `role="tabpanel"` có `data-kr-tabpanel="<khoá tab>"`.
- Bấm (chuột/chạm) tab chọn tab đó. Khi một tab có focus: `ArrowRight`/`ArrowLeft` chọn tab kế/trước (vòng tròn) và chuyển focus theo, `Home`/`End` chọn tab đầu/cuối.
- Dòng bất biến giữ y T-092 (`[data-kr-inv]`, `data-area`, `data-id`, `data-source`, mã, tên, `nguồn T-xxx`, `a[data-kr-link]` chữ `Mở trên GitHub`) và nhóm `[data-kr-area]`; nhóm chỉ chứa các dòng **đang hiện**. Dòng eval đối kháng là `[data-kr-adv]`, dòng hồi quy là `[data-kr-reg]`, cùng có `data-id`, `data-source` (mã `T-xxx` hoặc rỗng), tên (`name`), `nguồn <T-xxx>` (không hiện chữ nếu `source` rỗng), đúng một `a[data-kr-link]` `Mở trên GitHub` với `href` = `url`, `target="_blank"`, `rel="noopener noreferrer"`.
- **Bộ lọc sản phẩm (T-041 H3):** chỉ tab `invariants` lọc (số, danh sách, tiêu đề, `specs` ẩn như T-092). Tab `adversarial` và `regression` không đổi theo bộ chọn. `[data-kr-filter]` (chữ T-092) hiện ở **cả ba tab** khi chọn sản phẩm khác Tất cả.
- **Trạng thái rỗng**, mỗi tab đúng một `[data-kr-empty]`, không dòng, không nút: `invariants` rỗng trong phạm vi lọc: `Chưa có bất biến nào trong phạm vi này` (như T-092); `adversarial` rỗng: `Chưa có eval đối kháng nào`; `regression` rỗng: `Chưa có eval hồi quy nào`. Dữ liệu cũ có số nhưng thiếu mảng (`adversarial_list`/`regression_list` không phải mảng): `Chưa có danh sách chi tiết`; tab vẫn ghi số theo `model.*_evals`. Thiếu hẳn `model`: ba tab ghi 0, không lỗi.

### C. Xem thêm (10 mỗi lần)
- Mỗi tab hiện **10 mục đầu** của danh sách của nó (theo thứ tự ở mục A; `invariants` sau khi lọc). `limit` là một số nguyên, lúc đầu 10.
- Còn mục ẩn (`hidden = n - số đang hiện > 0`): ngay dưới dòng cuối có đúng một `button[data-kr-more]` chữ **`Xem thêm · còn N`** (N = `hidden`; `·` là U+00B7; không đơn vị phía sau; cùng mẫu với `#done-more` của T-089). Bấm một lần: `limit` tăng 10, hiện thêm tối đa 10 mục kế tiếp, các dòng cũ giữ nguyên thứ tự và vị trí cuộn không nhảy về đầu. Hết mục ẩn thì nút biến mất (không có "Thu gọn"). Đúng 10 mục hoặc ít hơn: không nút. Nút cao >= 40px, rộng >= 120px, chữ >= 14px, nằm trọn trong khung drawer, không che dòng nào, không mang `data-kr-inv/adv/reg`.
- Focus sau khi bấm: nút còn thì focus ở lại nút; nút vừa biến mất thì focus ở `a[data-kr-link]` của mục mới hiện đầu tiên (không rơi về `body`).
- **Reset `limit` về 10** khi: đổi tab (kể cả quay lại tab cũ), đóng rồi mở drawer, đổi bộ chọn sản phẩm. **Không reset** khi dữ liệu làm tươi (tải lại 60 giây) hay đổi cỡ cửa sổ: số đang hiện giữ nguyên (nếu danh sách mới ngắn hơn thì hiện `min(n, limit)`), vị trí cuộn giữ.

### D. Tay nắm kéo bề rộng
- Phần tử `#kr-drawer-resize` nằm ở **mép trái** khung drawer (`role="separator"`, `aria-orientation="vertical"`, `tabindex="0"`, `aria-label` không rỗng), cao gần hết khung (>= 90%), rộng >= 12px, con trỏ `col-resize`, `touch-action: none`. Có `aria-valuemin`, `aria-valuemax`, `aria-valuenow` = min, max, bề rộng hiện tại (px, làm tròn).
- **min** = bề rộng mặc định hiện tại = `min(560px, bề ngang khung nhìn)`. **max** = `max(min, 90% bề ngang khung nhìn)`. Bề rộng luôn nằm trong [min, max]; vượt thì kẹp.
- **Chuột và chạm** (pointer events, bắt con trỏ): giữ rồi kéo sang trái tăng, sang phải giảm; `bề rộng = bề rộng lúc bắt đầu + (x lúc bắt đầu − x hiện tại)`, kẹp [min, max]. Kéo xong (thả ở đâu, kể cả trên lớp nền ngoài khung) **không đóng drawer**.
- **Bàn phím** (khi tay nắm có focus): `ArrowLeft` +20px, `ArrowRight` −20px, `Home` = min, `End` = max; kẹp [min, max]; focus giữ ở tay nắm; không đóng drawer. Tay nắm nằm trong vòng `Tab` của drawer (cùng nút đóng, tab đang chọn, liên kết, nút Xem thêm).
- **Nhớ bề rộng (thêm ngoài ý định của Capu; Capu chỉ nói kéo, min, max):** giá trị người dùng đặt được lưu ở `localStorage` khoá `kr-drawer-width` (px, số nguyên; lỗi ghi/đọc thì bỏ qua và dùng bộ nhớ trong). Mở drawer và đổi cỡ cửa sổ áp lại giá trị đã lưu **kẹp** theo [min, max] của khung nhìn lúc đó (lưu 800 rồi thu cửa sổ còn 700 → 630; phóng lại 1280 → 800). Chưa lưu: bề rộng = min.
- **≤ 480px** (khung nhìn): drawer full màn như T-092; `#kr-drawer-resize` không hiện (không có hộp, không focus, không nhận sự kiện); bề rộng đã lưu bị bỏ qua. Từ 481px trở lên tay nắm có.
- Ở mọi bề rộng: trang không cuộn ngang; khung và danh sách không tràn; nút đóng nằm trọn trong khung nhìn.

### E. Giữ nguyên
Đóng bằng X, Esc (bắt ở `window`, giai đoạn bắt, `stopImmediatePropagation`), chạm lớp nền; focus vào `#kr-drawer-close` khi mở và về `#nd_kr` khi đóng; Tab xoay vòng **chỉ qua phần tử đang tab được** (nút đóng, tab đang chọn, tay nắm, liên kết, nút Xem thêm; tab `tabindex=-1` không nằm trong vòng); bấm khối/Enter/Space mở; nhân vật; chế độ phóng to (T-036); khối `#nd_kr`, `#krTxt`, cây `data-kr-scope` không đổi.

## Ảnh hưởng tới eval cũ (cần Chief of Staff biết)
- `eval/T-092/check.cjs` tiêu chí 3, 5 so số dòng `[data-kr-inv]` với toàn bộ danh sách; fixture `MODEL` của nó có 10 bất biến nên vẫn khớp, nhưng fixture `BIG` (112) và `eval/T-093/lib/adv-02-drawer.cjs` đếm dòng sẽ lệch vì mỗi tab chỉ hiện 10. Engineering **không** sửa eval cũ; nếu các lệnh đó đỏ vì tiêu chí C, Spec Writer cập nhật eval cũ theo spec này (đây là thay đổi spec có chủ ý, không phải lỗi code).
- Mục C của T-092 ("Tổng số dòng `[data-kr-inv]` = `a`") được thay bằng: tổng dòng hiện = `min(a, limit)`; tổng cộng dồn tới `a` khi bấm hết Xem thêm.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq` (exporter) và `phungrk/tohong-hq-dashboard` (`index.html`). Nhánh: `t-096-drawer-tab`. Vùng (`area`): `hq/dashboard/model`.
- Bất biến đã đọc: `_shared/`, `hq/`, `hq/dashboard/` (INV-001..017, gồm **INV-009** bản công khai không rò: hai danh sách mới không đưa `path`, đường dẫn máy, thân eval; **INV-017** số bất biến khớp file thật: không đổi) và `hq/dashboard/model/` (inv-001..038, gồm **inv-021/027** Esc từng lớp: Esc đóng drawer trước, sơ đồ vẫn phóng to; **inv-006/033/037** không cuộn ngang, cỡ chữ khối, màn hẹp). Spec không vi phạm. Không đề nghị đổi bất biến nào. ADR-032: mô tả bất biến không ghi đường dẫn máy; áp dụng cùng tinh thần cho `name` eval qua `looks_like_code`.
- Không chạm: payment, auth, DB, dữ liệu người dùng; không thêm thư viện; `localStorage` chỉ chứa một số px (không dữ liệu cá nhân).
- Bậc A: UI dashboard và exporter thuần, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Môi trường chung cho eval trình duyệt: `D3=/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js NODE_PATH=$(npm root -g)`; trang là `index.html` của repo dashboard (`TOHONG_DASHBOARD_REPO`, mặc định `/home/user/tohong-hq-dashboard`), dữ liệu cố định chặn từ mạng (25 bất biến, 23 eval đối kháng, 11 hồi quy). Eval cuộn phần tử vào khung nhìn rồi bấm bằng toạ độ chuột thật (kiểm `elementFromPoint`). Ánh xạ với 5 tiêu chí của `board/T-096.md`: (1) → eval 5 (tay nắm), (2) → eval 3, (3) → eval 4, (4) → eval 1, 2, 6, (5) → eval 7 và bất biến 2 tầng (INV-009/017 chạy ở Code Gate).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Hợp đồng dữ liệu A trên sổ cái tạm nhiều biến thể (`--public` và thường): hai khoá mảng, đủ khoá phần tử, `id`, `file`, `name` theo quy tắc (comment shebang, docstring, khối `/* */`, dòng code/đường dẫn máy bị bỏ, cắt ". " trước khi loại, thẻ `của`/`cho` trọn từ, nhãn dài cắt 140 + `…` thành `name` 150 ký tự, slug, tên file, hai file cùng mã và slug khác đuôi), `source`, `url`, `path`, thứ tự (`T-100` trước `T-99`, `adv-2` trước `adv-10`), `len` = số đếm, mốc thân eval không lọt | `cd /home/user/tohong-hq && python3 eval/T-096/export-be.py --criterion 1` |
| 2 | Sổ cái thật (cả hai chế độ): `len(list)` = số = đếm độc lập; `name` không rỗng, không là code/đường dẫn máy; nhãn (phần sau `<mã> · `, trừ nhãn slug và tên file) ≤ 141 ký tự, không giới hạn riêng cho cả `name`; mọi `path` tồn tại; public không `path`/đường dẫn máy | `cd /home/user/tohong-hq && python3 eval/T-096/export-be.py --criterion 2` |
| 3 | Ba tab đúng thứ tự, chữ có số, khớp `[data-kr-stat]`, mặc định `invariants`, nhớ tab khi đóng/mở và về mặc định khi tải lại, phím mũi tên/Home/End, nội dung từng tab đúng 10 mục đầu (id, tên, nguồn, link), bộ lọc chỉ áp bất biến và `[data-kr-filter]` ở cả ba tab | `cd /home/user/tohong-hq && D3=… NODE_PATH=$(npm root -g) node eval/T-096/check.cjs --criterion 3` |
| 4 | 10 mục đầu, `Xem thêm · còn N`, +10 mỗi lần, lần cuối ít hơn, hết thì nút mất, focus, không nhảy cuộn, nhóm vùng; reset khi đổi tab/đóng mở/đổi bộ lọc; làm tươi giữ nguyên; biên đúng 10 mục không nút | `… node eval/T-096/check.cjs --criterion 4` |
| 5 | Tay nắm mép trái: thuộc tính a11y, min 560/max 1152 ở 1280, kéo chuột, kéo chạm (CDP), bàn phím ±20/Home/End, kẹp min/max, thả ngoài khung không đóng, nhớ qua đóng/mở và tải lại, kẹp khi thu cửa sổ, không có tay nắm ở 390 và 480, có ở 481 | `… node eval/T-096/check.cjs --criterion 5` |
| 6 | Trạng thái rỗng (hồi quy, đối kháng, bất biến trong phạm vi lọc), dữ liệu cũ thiếu mảng, thiếu `model`: chữ đúng, không lỗi JS | `… node eval/T-096/check.cjs --criterion 6` |
| 7 | Tương tác cũ: Esc ở từng tab/khi tay nắm có focus, X, chạm nền, bấm trong không đóng, focus vào/ra, vòng Tab (không ra ngoài, bỏ tab không chọn), 390px full màn không tràn, tab và Xem thêm bấm được | `… node eval/T-096/check.cjs --criterion 7` |

## Bất biến đề xuất (tầng 2)
1. **`hq/dashboard/model`: số eval đối kháng/hồi quy trên tab bằng số mục thật của danh sách.** `eval/T-096/inv-proposed-danh-sach-khop-so.py`: exporter thật trên sổ cái thật, cả hai chế độ: `adversarial_evals` = `len(adversarial_list)` = đếm độc lập; `regression_evals` = `len(regression_list)` = đếm độc lập; mỗi mục có `name`, `url`; public không `path` hay đường dẫn máy trong hai danh sách. Chặn lỗi một lần sửa exporter làm tab ghi số này mà danh sách số khác (Capu bấm "Xem thêm" thấy hết mục khi nút còn "còn N").

## Không làm
- Không lọc eval đối kháng/hồi quy theo sản phẩm; không tải thân eval vào drawer; không ô tìm kiếm; không "Thu gọn"; không kéo cao drawer; không kéo ở ≤ 480px.
- Không liệt kê `adv-*` ở thư mục con (`lib/`, `bat-bien-cho-merge/`) hay ngoài `eval/T-*/`.
- Không sửa eval/bất biến cũ; không đổi SVG mô hình, bảng, Kanban.

## Câu hỏi mở
Không còn. Ghi chú: "nhớ bề rộng bằng `localStorage`" (mục D) là điều Spec Writer thêm ngoài lời Capu (đảo ngược được, bậc A); Capu muốn bỏ thì xoá một câu và một nhánh eval 5.

## Lịch sử spec rework
- v2 (2026-11-07, defect T-096-D1, kind spec): quy tắc `name` mục A bước 3 cũ ("dòng đầu tiên ≥ 12 ký tự không phải code") cho 6 tên giống nhau ở T-095, mẩu câu `của T-093 (adversary): …` và 5 tên trùng ở T-033. Đã thay bằng slug trước, comment sau, tên file cuối, có mã `adv-NN` và luật không trùng trong một việc. Cũng sửa: thứ tự cụm số trước cụm chữ (`adv-vv`), ngưỡng 12 ký tự tính sau khi cắt, ghi rõ nhớ bề rộng là thêm ngoài ý định.
- v3 (2026-11-07, defect T-096-D2, kind spec; spec_returns=2): (1) giới hạn 140 ký tự + `…` áp lên **nhãn**, `name` tối đa `len(mã)+3+141` = 150; eval 2 đo nhãn chứ không đo `name` (trước: `len(name) > 141`). (2) thứ tự ghi cố định: cắt ". " rồi mới loại ứng viên (khớp spec cũ; script tham chiếu sửa theo, 4 file đổi từ tên file sang nhãn). (3) `của`/`cho` là thẻ khi là từ trọn; `và`/`chạy` cũng là từ trọn. (4) bước 4 còn một câu: mọi `name` trùng trong một việc dùng tên file, kể cả nhãn slug. Eval 1 thêm fixture T-904 (6 file).
