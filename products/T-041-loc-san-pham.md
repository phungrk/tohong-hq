# Spec T-041: Bộ lọc theo sản phẩm trên dashboard

## Ý định
Capu nhìn dashboard theo từng sản phẩm (`planner`, `hq`): lọc việc, thấy số bất biến theo cây sản phẩm; mô hình luồng Eval-Gated vẫn là một hình duy nhất. Nguồn: `board/T-041.md` (Brief của Capu qua Chief of Staff), `decisions/2026-11-02-adr-011-be-tri-thuc-theo-cay-san-pham.md` (hệ quả: "Dashboard: thêm bộ lọc theo sản phẩm").

## Bằng chứng
- ADR-011 mục 3: mọi vùng mới có tiền tố `planner/` hoặc `hq/`; vùng cũ (`front/…`, `dashboard/…`) chỉ còn trong việc đã xong. `scripts/export_dashboard.py` đã xuất `area` cho mỗi việc (dòng 44) và `model.invariants` dạng `{ "<đường dẫn vùng dưới eval/invariants>": số }` (dòng 80-90), trong đó `_shared` là một khoá. Vậy dashboard suy ra sản phẩm từ `area` và từ khoá của `model.invariants`, **không cần đổi `export_dashboard.py`**.
- Cấu trúc trang hiện tại (repo `phungrk/tohong-hq-dashboard`, `index.html`): bảng việc `#board` (bảy cột), thẻ KPI `#k-*`, mô hình `#model` với khối `#nd_*`, `#krTxt`. Tôi đọc mã này để chọn tên phần tử ở mục "Hợp đồng phần tử".
- Không có số liệu người dùng cho việc này; giả thuyết dưới đây là GIẢ ĐỊNH, tự tin ~70%.

## Giả thuyết
Nếu thêm bộ chọn sản phẩm thì Capu không còn phải đọc lẫn việc của hai sản phẩm khi chỉ cần một (số việc phải liếc giảm gần một nửa khi lọc), và thấy bể bất biến thuộc sản phẩm nào. Chỉ số bảo vệ: chế độ mặc định "Tất cả" giống hệt dashboard hiện tại; mô hình luồng không đổi hình.

## Hành vi (người dùng thấy gì)

**Định nghĩa dùng chung**
- *Sản phẩm của một việc* là phần của `area` đứng trước dấu `/` đầu tiên, và chỉ tính khi bằng đúng `planner` hoặc `hq` (so khớp cả chuỗi, không so khớp tiền tố chuỗi: `hqx/…`, `planner-x/…` không thuộc sản phẩm nào). Việc có `area` rỗng, thiếu, vùng cũ không tiền tố (`dashboard/model`, `front/…`), hoặc việc chưa có trong `dashboard.json` (chỉ đến qua kênh live, không có `area`) **không thuộc sản phẩm nào**: chỉ hiện khi chọn "Tất cả".
- *Việc được lọc* khi chọn sản phẩm P là tập việc có sản phẩm bằng P. Khi chọn "Tất cả" là mọi việc, không loại việc nào.

**H1. Bộ chọn.** Phần Kanban có một `<select>` có nhãn "Sản phẩm" với đúng ba lựa chọn theo thứ tự: "Tất cả" (giá trị `all`), "planner" (`planner`), "hq" (`hq`). Đổi lựa chọn có tác dụng ngay, không tải lại trang.

**H2. Cái được lọc.** Khi chọn P, các thứ sau chỉ tính trên *việc được lọc*, và giống hệt những gì dashboard hiện nếu chỉ tồn tại những việc đó (đây là phép thử của eval):
- thẻ việc trên bảng `#board` và số đếm ở đầu mỗi cột;
- năm thẻ KPI: Đang chạy, Chờ anh quyết, Bị chặn hoặc đứng yên, Đã xong, First-pass yield (`#k-wip`, `#k-capu`, `#k-stuck`, `#k-done`, `#k-fpy`);
- số trên các khối mô hình có số đếm việc (Ý định, Spec Writer, Spec rework, Agent code gồm cả "N chờ", Code rework, Capu, và số chờ ở hai cổng), đèn của các khối đó (khối sáng khi và chỉ khi số hiển thị > 0, như INV hq/dashboard/model/inv-009), và tóm tắt khi bấm nhân vật (như inv-023; chưa có eval riêng cho phần tóm tắt khi đang lọc);
- số bất biến ở dòng tiêu đề khối Knowledge Reservoir (`#krTxt`): bằng bất biến `_shared` cộng bất biến của P (đúng tập chạy khi gate một việc của P). Chọn "Tất cả" thì bằng `model.invariants_total`.

**H3. Cái không bị lọc** (kể cả khi chọn P): thẻ "Cần tuyển" (`#k-hiring`), bảng Đội ngũ, bảng Cảnh báo, Dòng thời gian, Feed sự kiện, dot chạy theo sự kiện live và nhân vật. Lý do: đó là lịch sử và nhân sự của cả công ty (ADR-011 mục 4: một sổ cái, một ngưỡng chú ý).

**H4. Khối Knowledge Reservoir hiện số bất biến theo cây.** Bên trong khối `#nd_kr`, trong khung của khối, có các dòng, mỗi dòng một phần tử mang thuộc tính `data-kr-scope` và chứa chữ có kết thúc bằng một số nguyên (số bất biến của nhánh đó):
- `_shared`: tổng bất biến có khoá `_shared`.
- `planner`: tổng bất biến có khoá bằng `planner` hoặc bắt đầu bằng `planner/`.
- `hq`: tổng bất biến có khoá bằng `hq` hoặc bắt đầu bằng `hq/`.
- `khac`: tổng bất biến của mọi khoá còn lại (vùng cũ chưa có tiền tố). Dòng này chỉ có khi tổng > 0.
Hai dòng `planner` và `hq` luôn có, kể cả số 0. Mỗi `data-kr-scope` xuất hiện đúng một lần. Tổng mọi dòng bằng `model.invariants_total` của `dashboard.json`. Các dòng này **không đổi theo bộ chọn** (luôn là cả cây); chỉ số ở `#krTxt` đổi như H2. Dòng hiện được (không `display:none`, kích thước > 0, nằm trong khung khối) ở 1280px và 390px.

**H5. Mô hình không đổi hình.** Khi đổi bộ chọn, mọi khối, đường nối, cổng, mũi tên, khung và vị trí chữ của `#model` giữ nguyên toạ độ, kích thước, hiển thị; không khối nào bị ẩn hay thu nhỏ vì số đếm bằng 0. Chỉ nội dung chữ số đếm, màu/đèn theo H2, và số biểu tượng người/robot (`use.ic`, một biểu tượng cho mỗi việc) được đổi. Ngoại lệ: khối `#nd_kr` được phép đổi khung (cao hơn) để chứa các dòng của H4, nhưng khung đó phải **giống nhau** ở mọi lựa chọn bộ chọn.

**H6. Nhớ lựa chọn.** Lựa chọn lưu ở `localStorage` với khoá `tohong.productFilter`, giá trị `all`, `planner` hoặc `hq`. Mở trang: đọc khoá; nếu thiếu, rỗng, hoặc không phải ba giá trị đó (so khớp chính xác, phân biệt hoa thường) thì dùng `all`. Bảng, KPI, khối được lọc ngay ở lần vẽ đầu tiên theo giá trị đọc được. Nếu `localStorage` không dùng được (đọc hay ghi ném lỗi), trang vẫn chạy bình thường, mặc định `all`, bộ chọn vẫn lọc trong phiên đó.

**H7. Điện thoại 390px.** Bộ chọn hiện trọn trong màn hình (không vượt 0..390px), cao ≥ 32px, rộng ≥ 80px, chữ ≥ 14px, có nhãn đọc được, không bị phần tử khác che ở giữa sau khi cuộn tới, và trang không cuộn ngang (kể cả khi đang lọc).

## Hợp đồng phần tử (để eval và code cùng hiểu một thứ)
| Thứ | Phần tử |
| --- | --- |
| Bộ chọn | `select#product-filter`, có `option` với `value` = `all`, `planner`, `hq` |
| Thẻ việc, cột | `#board .col`, `.colh span` (tên, số đếm), `.tcard` (như hiện nay) |
| KPI | `#k-wip`, `#k-capu`, `#k-stuck`, `#k-done`, `#k-fpy` |
| Số trên khối | `#nd_<tên> .n`, `#nd_exec .cap`, `#sgateQ`, `#gateQ`, `#krTxt` (như hiện nay) |
| Dòng cây bất biến | phần tử con của `#nd_kr` có thuộc tính `data-kr-scope` = `_shared` \| `planner` \| `hq` \| `khac` |
| Khoá lưu | `localStorage["tohong.productFilter"]` |

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` (một file `index.html`, d3) · Nhánh: `t-041-loc-san-pham` · Vùng (`area`): `hq/dashboard`
- Bất biến đã đọc: `eval/invariants/_shared/` (inv-001 không secret, inv-002 sổ cái đọc được) và `eval/invariants/hq/dashboard/model/inv-001…031`. Spec không vi phạm: bộ lọc không tạo dot (inv-001/002), không thêm hoạt ảnh (inv-005/012), không tràn ngang 390px (inv-006: bộ chọn nằm trong luồng trang, tiêu chí 4 ép lại), đèn khớp số đếm đã lọc (inv-009, inv-023), mũi tên và hình mô hình không đổi (inv-029/030, tiêu chí 3), không id trùng (inv-017/mục T-039). Không cần đổi bất biến nào.
- Kiến trúc: dữ liệu vẫn từ `dashboard.json`; không đổi `scripts/export_dashboard.py`; không thêm thư viện; d3 giữ nguyên.
- Không chạm: payment, auth, DB, dữ liệu người dùng, dịch vụ trả phí. Dashboard công khai không chứa dữ liệu cá nhân.
- Bậc lưới lọc: **A** (UI dashboard, eval tự động phủ cả bốn tiêu chí, không chạm ranh giới cứng), đúng bậc Chief of Staff đã đặt.

## Tiêu chí chấp nhận và eval
Eval của cả bốn tiêu chí dùng chung một công cụ, dữ liệu giả và d3 cục bộ, Chromium. Tiêu chí 1 và 3 so sánh vi sai: bảng sau khi lọc P trên dữ liệu hỗn hợp phải bằng bảng "Tất cả" trên dữ liệu chỉ có việc của P, nên eval không cần biết công thức từng số đếm.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Có bộ chọn Tất cả / planner / hq (H1); chọn xong, bảng việc và số đếm (H2) chỉ còn việc có sản phẩm đó (định nghĩa mục Hành vi, không lẫn `hqx/`, `planner-x/`, vùng cũ, vùng rỗng); phần H3 không đổi; quay lại Tất cả trả đúng trạng thái đầu | `cd /home/claude/tohong-hq && bash eval/T-041/run.sh /home/claude/tohong-hq-dashboard --criterion 1` |
| 2 | Khối Knowledge Reservoir hiện số bất biến theo cây (H4): `_shared` riêng, mỗi sản phẩm một dòng, `khac` khi có, tổng khớp `invariants_total`, số ở `#krTxt` theo H2; ở 1280px và 390px | `cd /home/claude/tohong-hq && bash eval/T-041/run.sh /home/claude/tohong-hq-dashboard --criterion 2` |
| 3 | Mô hình không đổi hình khi lọc (H5) ở 1280px và 390px; số đếm trên khối đổi khi lọc planner / hq | `cd /home/claude/tohong-hq && bash eval/T-041/run.sh /home/claude/tohong-hq-dashboard --criterion 3` |
| 4 | Lựa chọn nhớ trong `localStorage` và mặc định `all` (H6), kể cả giá trị lạ và `localStorage` bị cấm; đọc được ở 390px (H7) | `cd /home/claude/tohong-hq && bash eval/T-041/run.sh /home/claude/tohong-hq-dashboard --criterion 4` |

Mã eval: `eval/T-041/loc-san-pham.cjs` (chạy qua `eval/T-041/run.sh`). Cần Playwright (`NODE_PATH` mặc định từ `npm root -g`) và d3 cục bộ (`D3`, mặc định `/opt/npm-tools/node_modules/d3/dist/d3.min.js`). Không dùng checklist vì cả bốn tiêu chí đo được bằng máy.

Đã tự kiểm eval: trên bản `index.html` hiện tại cả bốn tiêu chí đỏ (chưa có bộ chọn); trên một bản thử nhanh làm đúng spec (ngoài repo, không giao) cả bốn xanh, nên eval có thể xanh được.

## Bất biến đề xuất (tầng 2), vùng `hq/dashboard`
Đặt ở `eval/invariants/hq/dashboard/` (cha của `model/`), để mọi việc dashboard sau này chạy, spec-critic rút khi spec qua cổng:
1. **INV-P1 "Tất cả luôn đủ"**: với bộ chọn mặc định `all` (và mọi giá trị lạ trong `localStorage`), mọi việc ở bảy cột của `dashboard.json` đều có thẻ trên bảng, kể cả việc có `area` rỗng, vùng cũ hay vùng không thuộc sản phẩm nào. Nguồn: tiêu chí 1, 4 (đo bằng cùng dữ liệu hỗn hợp). Đo được bằng cắt từ `loc-san-pham.cjs`.
2. **INV-P2 "Cây bất biến khớp tổng"**: tổng các dòng `data-kr-scope` bằng `model.invariants_total`, bất kể thêm sản phẩm hay vùng mới. Bắt lỗi ai thêm sản phẩm thứ ba mà quên dòng. Nguồn: tiêu chí 2.
3. **INV-P3 "Điều khiển xem không đổi hình mô hình"**: mọi điều khiển thuần hiển thị (bộ lọc, về sau là thanh trượt thời gian, v.v.) không làm đổi toạ độ/kích thước của khối, đường, cổng trong `#model`. Nguồn: tiêu chí 3 (chữ ký hình học trong `shape()`).

## Không làm
- Không đổi `scripts/export_dashboard.py`, `task.py`, `gate.py`; không thêm trường `product` vào `dashboard.json` (client suy từ `area`).
- Không tách dashboard thành hai trang, không thêm thanh địa chỉ/URL cho bộ lọc.
- Không lọc insight theo sản phẩm trong việc này (xem Câu hỏi mở).
- Không đổi hình mô hình, không thêm khối hay đường.

## Câu hỏi mở
Brief của Capu có vế "insight theo sản phẩm" ở Mục tiêu nhưng không có tiêu chí nào cho nó (hiện dashboard chỉ hiện tên báo cáo insight tuần mới nhất, và `insights/` chưa gắn nhãn sản phẩm). Spec này loại nó ra; có cần mở một việc riêng (đề xuất bậc A, cần `insight` gắn nhãn sản phẩm vào báo cáo) không?
