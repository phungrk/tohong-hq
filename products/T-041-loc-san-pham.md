# Spec T-041: Bộ lọc theo sản phẩm trên dashboard (v2)

## Ý định
Capu nhìn dashboard theo từng sản phẩm (`planner`, `hq`): cả màn hình chỉ nói về một sản phẩm, thấy số bất biến theo cây sản phẩm; mô hình luồng Eval-Gated vẫn là một hình duy nhất. Nguồn: `board/T-041.md` (Brief của Capu qua Chief of Staff), `decisions/2026-11-02-adr-011-be-tri-thuc-theo-cay-san-pham.md`, và **`decisions/2026-11-02-t041-pham-vi-loc-san-pham.md`** (Chief of Staff chốt phạm vi lọc, nguồn sản phẩm, việc không sản phẩm, mô hình không đổi hình; quyết định này thắng spec v1).

## Bằng chứng
- ADR-011 mục 3 và `scripts/task.py:73-90`: `PRODUCTS = {planner, hq}`, `LEGACY_AREAS = {front, back -> planner/…; dashboard -> hq/dashboard}`, `normalize_area` ném `LedgerError` với vùng không thuộc hai nhóm đó. Sổ cái hôm nay (đếm `area:` trong `board/*.md`): 12 việc `dashboard/model`, 3 việc `front/*`, 3 việc `hq/*`, 1 việc rỗng, 0 việc `planner/…`; còn lại T-001…T-022 không có `area`. Lọc theo tiền tố thô sẽ cho bộ lọc `planner` rỗng và `hq` thiếu 12/15 việc (defect `handoffs/T-041-D1.md`, lỗi 1).
- `scripts/export_dashboard.py`: `area` đã xuất cho mỗi việc (dòng 44); `model.invariants` dạng `{ "<vùng dưới eval/invariants>": số }`, `_shared` là một khoá.
- Dashboard (`phungrk/tohong-hq-dashboard`, `index.html`) tính mọi số từ danh sách việc và sự kiện: `derive()`, `drawBoard`, `drawAlerts`, `drawTimeline`, `drawFeed`, `drawFlow`, `drawModel` (đã đọc để chọn tên phần tử ở "Hợp đồng phần tử").
- Không có số liệu người dùng; giả thuyết dưới đây là GIẢ ĐỊNH, tự tin ~70%.

## Giả thuyết
Nếu cả màn hình lọc được theo sản phẩm thì Capu không phải đọc lẫn việc của hai sản phẩm khi chỉ cần một, và không bao giờ gặp cảnh KPI "Bị chặn: 0" đứng cạnh Cảnh báo có việc bị chặn. Chỉ số bảo vệ: "Tất cả" giống hệt dashboard hiện tại; mô hình luồng không đổi hình.

## Hành vi (người dùng thấy gì)

**Định nghĩa dùng chung**
- *Sản phẩm của một việc* là giá trị trường `product` của việc đó trong `dashboard.json`, một trong `planner`, `hq`, `""`. **Dashboard chỉ đọc trường này**, không tự suy từ `area` (quyết định 2). Việc thiếu trường `product` coi như `""`. Việc chỉ đến qua kênh live mà chưa có trong `dashboard.json` cũng là `""`; việc đã có trong `dashboard.json` giữ `product` của nó khi kênh live đổi trạng thái.
- *Việc không sản phẩm* (`product` là `""`): chỉ hiện khi chọn "Tất cả" (quyết định 3).
- *Sự kiện của sản phẩm P*: sự kiện có `task` là một việc thuộc P. Sự kiện không có `task`, hoặc của việc không sản phẩm, chỉ hiện ở "Tất cả".
- *Việc được lọc* khi chọn P là tập việc có sản phẩm bằng P; *sự kiện được lọc* là sự kiện của P. Chọn "Tất cả": mọi việc, mọi sự kiện, không loại gì.
- **Nguyên tắc một con số (quyết định 1).** Khi chọn P, mọi chỗ trên màn hình hiện việc hay đếm việc/sự kiện giống hệt những gì dashboard hiện nếu sổ cái chỉ có *việc được lọc* và *sự kiện được lọc*. Đó là phép thử của eval. Ngoại lệ chỉ là những thứ liệt kê ở H3.

**H1. Bộ chọn.** Phần Kanban có một `<select>` có nhãn "Sản phẩm" với đúng ba lựa chọn theo thứ tự: "Tất cả" (giá trị `all`), "planner" (`planner`), "hq" (`hq`). Đổi lựa chọn có tác dụng ngay, không tải lại trang. Mỗi lần đổi lựa chọn, Dòng thời gian trở về việc mặc định của tập mới (cùng quy tắc chọn việc mặc định hiện có), dù trước đó Capu đã bấm thẻ khác.

**H2. Cái được lọc** (tính trên *việc được lọc* và *sự kiện được lọc*):
- thẻ việc trên bảng `#board` và số đếm ở đầu mỗi cột;
- năm thẻ KPI: Đang chạy, Chờ anh quyết, Bị chặn hoặc đứng yên, Đã xong, First-pass yield (`#k-wip`, `#k-capu`, `#k-stuck`, `#k-done`, `#k-fpy`) và câu tổng kết `#takeaway` (riêng số "vị trí cần tuyển" trong câu đó là H3);
- bảng Cảnh báo `#alerts`, Dòng thời gian (`#tl-title`, `#tl-sub`, `#timeline`), Hoạt động gần đây (Feed `#feed`), Bản đồ luồng (`#flow`, `#flow-live`: đường bàn giao, đường đang chạy, nhãn "×N");
- số trên các khối mô hình có số đếm việc: Ý định, Spec Writer, Spec rework, Agent code (gồm "N chờ"), Code rework, Capu, số chờ ở hai cổng (`#sgateQ`, `#gateQ`); chữ Release `#relTxt` ("N release 7 ngày qua") và Production `#resTxt` ("N việc xong · M có lỗi minor", M đếm sự kiện nên cũng là sự kiện được lọc);
- đèn các khối đếm được: khi không có dot nào đang tới, khối sáng khi và chỉ khi số hiển thị > 0 (inv-009). Dot của *việc được lọc* làm sáng khối theo luật hiện hành (inv-004), không đổi;
- **dot**: chỉ chạy dot của sự kiện được lọc, kể cả sự kiện đến qua kênh live. Dot của sản phẩm kia không chạy và không làm khối nào sáng;
- **hoạt động live và nhân vật**: hoạt động live (thông điệp `activity` có trường `task`) chỉ tính khi `task` thuộc P; hoạt động không có `task` hoặc của việc không sản phẩm coi như sản phẩm `""` nên ẩn khi lọc. Chip ở `#activity` và nhân vật trong mô hình chỉ phản ánh phần đó; nhân vật vẫn khớp đèn của khối mình (inv-010: work/wait thì khối sáng, idle thì không), kể cả khi đang lọc;
- tóm tắt khi bấm nhân vật (inv-023) tính trên cùng tập đã lọc (chưa có eval riêng; ghi ở bàn giao v2);
- số bất biến ở `#krTxt` (số đầu tiên): bằng bất biến `_shared` cộng bất biến của P (đúng tập chạy khi gate một việc của P). Chọn "Tất cả" thì bằng `model.invariants_total`;
- chữ dưới tên khối bể `#nd_kr .lbl`: "Tất cả" giữ nguyên "N vùng · M spec trong bể"; chọn P thì đúng `"<z> vùng trong bể"`, z là số khoá `model.invariants` bằng `_shared` hoặc thuộc P (khoá bằng P hoặc bắt đầu bằng `P/`). Số spec không hiện khi lọc vì `dashboard.json` không có số spec theo sản phẩm.

**H3. Cái không bị lọc** (kể cả khi chọn P):
- bảng Đội ngũ `#team` (cả các cột số, vì đây là bảng người của cả công ty) và thẻ "Cần tuyển" `#k-hiring`;
- số eval đối kháng và eval hồi quy ở `#krTxt` (số thứ hai và thứ ba) và chữ khối Insight `#insCap` ("N báo cáo tuần · ngày"): `dashboard.json` chưa có các số này theo sản phẩm, báo cáo insight chưa gắn nhãn sản phẩm (quyết định 5, insight theo sản phẩm không thuộc T-041);
- các dòng cây bất biến của H4.
Mọi chữ số khác trên màn hình thuộc H2.

**H4. Khối Knowledge Reservoir hiện số bất biến theo cây.** Bên trong khối `#nd_kr`, trong khung của khối, có các dòng; mỗi dòng là **một** phần tử mang thuộc tính `data-kr-scope`, chứa **tên nhánh và số** của nhánh đó (số nguyên ở cuối chữ):
- `_shared` (chữ "_shared"): tổng bất biến có khoá `_shared`.
- `planner` (chữ "planner"): tổng bất biến có khoá bằng `planner` hoặc bắt đầu bằng `planner/`.
- `hq` (chữ "hq"): tương tự với `hq`.
- `khac` (chữ "khác"): tổng bất biến của mọi khoá còn lại (vùng chưa có tiền tố). Chỉ có khi tổng > 0.
`planner` và `hq` luôn có, kể cả số 0. Mỗi `data-kr-scope` đúng một lần. Tổng mọi dòng bằng `model.invariants_total`. Các dòng là **các dòng riêng biệt, không chồng nhau**: sắp theo vị trí dọc, hai dòng liên tiếp cách nhau ít nhất bằng cỡ chữ của dòng trên (tính theo đơn vị toạ độ của mô hình). Các dòng **không đổi theo bộ chọn** (luôn là cả cây). Hiện được (không `display:none`, kích thước > 0, nằm trong khung khối) ở 1280px và 390px.

**H5. Mô hình không đổi hình** (quyết định 4). Khi đổi bộ chọn, toạ độ và kích thước của mọi khối, đường nối, cổng, mũi tên, khung và vị trí chữ trong `#model` giữ nguyên, tính từ góc của mô hình (bảng việc phía trên cao thấp tuỳ lọc làm cả mô hình trôi trên trang là bình thường); không khối nào bị ẩn hay thu nhỏ vì số đếm bằng 0. Chỉ được đổi: nội dung chữ số đếm và chữ ở H2, màu/đèn theo H2, dot, nhân vật, hàng biểu tượng người/robot (một biểu tượng mỗi việc) cùng chữ "+N" mà hàng này sinh thêm khi một khối có hơn 8 việc. Khung `#nd_kr` được phép cao hơn bản hiện tại để chứa H4, nhưng **giống nhau ở mọi lựa chọn**.

**H6. Nhớ lựa chọn.** Lựa chọn lưu ở `localStorage` với khoá `tohong.productFilter`, giá trị `all`, `planner` hoặc `hq`. Mở trang: đọc khoá; nếu thiếu, rỗng, hoặc không phải ba giá trị đó (so khớp chính xác, phân biệt hoa thường) thì dùng `all`. Bảng, KPI và mọi thứ ở H2 được lọc ngay ở lần vẽ đầu tiên. Nếu `localStorage` không dùng được (đọc hay ghi ném lỗi), trang vẫn chạy bình thường, mặc định `all`, bộ chọn vẫn lọc trong phiên đó.

**H7. Điện thoại 390px.** Bộ chọn hiện trọn trong màn hình (không vượt 0..390px), cao ≥ 32px, rộng ≥ 80px, chữ ≥ 14px, có nhãn đọc được, không bị phần tử khác che ở giữa sau khi cuộn tới, và trang không cuộn ngang (kể cả khi đang lọc).

**H8. Sổ cái xuất sản phẩm.** `scripts/export_dashboard.py` thêm vào mỗi việc (trong `dashboard.json` và `tasks.json`) trường `product` = phần trước dấu `/` đầu tiên của `task.normalize_area(area)` (vùng cũ `front/*`, `back/*` -> `planner`; `dashboard/*` -> `hq`; vùng rỗng -> `""`). Nếu `normalize_area` ném `LedgerError` (vùng như `hqx/…`, `planner-x/…` do sửa tay file board) thì `product` là `""` và việc xuất vẫn chạy. `product` luôn thuộc `{planner, hq, ""}`. Không đổi gì khác trong script.

## Hợp đồng phần tử (để eval và code cùng hiểu một thứ)
| Thứ | Phần tử / trường |
| --- | --- |
| Bộ chọn | `select#product-filter`, có `option` với `value` = `all`, `planner`, `hq` |
| Sản phẩm của việc | `dashboard.json` -> `tasks[].product` ∈ {`planner`, `hq`, `""`} |
| Thẻ việc, cột | `#board .col`, `.colh span` (tên, số đếm), `.tcard` (như hiện nay) |
| KPI, tổng kết | `#k-wip`, `#k-capu`, `#k-stuck`, `#k-done`, `#k-fpy`, `#k-hiring`, `#takeaway` |
| Bảng, dòng thời gian, luồng | `#alerts`, `#timeline`, `#tl-title`, `#tl-sub`, `#feed`, `#flow`, `#flow-live`, `#team`, `#activity` |
| Số/chữ trên khối | `#nd_<tên> .n`, `#nd_exec .cap`, `#sgateQ`, `#gateQ`, `#relTxt`, `#resTxt`, `#krTxt`, `#nd_kr .lbl`, `#insCap` (như hiện nay) |
| Dòng cây bất biến | phần tử con của `#nd_kr` có thuộc tính `data-kr-scope` = `_shared` \| `planner` \| `hq` \| `khac` |
| Khoá lưu | `localStorage["tohong.productFilter"]` |

## Ràng buộc (vòi)
- Repo dashboard: `phungrk/tohong-hq-dashboard` (một file `index.html`, d3) · Nhánh: `t-041-loc-san-pham`. Repo này: `scripts/export_dashboard.py` (chỉ thêm `product`, H8).
- Vùng (`area`): **`hq/dashboard/model`** (Chief of Staff đổi sau Spec Gate D1: việc sửa trực tiếp mô hình nên phải chạy 31 bất biến `model/`).
- Bất biến đã đọc: `eval/invariants/_shared/` (inv-001 không secret, inv-002 sổ cái đọc được) và `eval/invariants/hq/dashboard/model/inv-001…031`. Điểm tựa: bộ lọc không tạo dot ngoài sự kiện thật (inv-001/002); không thêm hoạt ảnh (inv-005/012); không tràn ngang 390px (inv-006); đèn khớp số đã lọc (inv-009) và nhân vật khớp đèn kể cả khi lọc (inv-010, H2 + eval C5); tóm tắt khớp đèn (inv-023); mũi tên và hình mô hình không đổi (inv-029/030, H5); không id trùng (inv-017). Spec **không** đổi bất biến nào; phép "nhân vật/dot lọc theo sản phẩm" được chọn đúng để không phải thu hẹp inv-010.
- Kiến trúc: dữ liệu vẫn từ `dashboard.json`; không thêm thư viện; d3 giữ nguyên.
- Không chạm: payment, auth, DB, dữ liệu người dùng, dịch vụ trả phí. Dashboard công khai không chứa dữ liệu cá nhân (`product` là nhãn công khai).
- Bậc lưới lọc: **A** (UI dashboard, eval tự động phủ cả sáu tiêu chí, không chạm ranh giới cứng), đúng bậc Chief of Staff đã đặt.

## Tiêu chí chấp nhận và eval
Eval 1-5 dùng chung một công cụ (Chromium, dữ liệu giả, d3 cục bộ); eval 6 chạy `export_dashboard.py` thật. Tiêu chí 1 và 3 so sánh vi sai: màn hình sau khi lọc P trên dữ liệu hỗn hợp phải bằng màn hình "Tất cả" trên dữ liệu chỉ có việc và sự kiện của P, nên eval không cần biết công thức từng số đếm. Dữ liệu thử có việc vùng cũ `dashboard/model` (-> hq) và `front/layout` (-> planner), ca `area` lệch `product` (dashboard phải theo `product`), ca thiếu trường `product`, và `hqx/`, `planner-x/`, vùng rỗng.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Bộ chọn Tất cả / planner / hq (H1); chọn P thì **cả màn hình** theo H2 chỉ còn việc và sự kiện của P (kể cả việc vùng cũ), các thứ ở H3 không đổi, việc không sản phẩm chỉ ở Tất cả, quay lại Tất cả trả đúng trạng thái đầu, Dòng thời gian về mặc định khi đổi | `bash eval/T-041/run.sh $TOHONG_DASHBOARD_REPO --criterion 1` |
| 2 | Khối Knowledge Reservoir: dòng cây có nhãn, không chồng nhau, tổng khớp (H4); `#krTxt`, `#nd_kr .lbl`, `#insCap` theo H2/H3; ở 1280px và 390px | `bash eval/T-041/run.sh $TOHONG_DASHBOARD_REPO --criterion 2` |
| 3 | Mô hình không đổi toạ độ/kích thước khi lọc (H5), kể cả khi một khối có hơn 8 việc; ở 1280px và 390px; số đếm trên khối đổi | `bash eval/T-041/run.sh $TOHONG_DASHBOARD_REPO --criterion 3` |
| 4 | Lựa chọn nhớ trong `localStorage`, mặc định `all`, kể cả giá trị lạ và `localStorage` bị cấm (H6); đọc được ở 390px (H7) | `bash eval/T-041/run.sh $TOHONG_DASHBOARD_REPO --criterion 4` |
| 5 | Dot, hoạt động live và nhân vật theo sản phẩm; đèn khớp số, nhân vật khớp đèn khi đang lọc (H2: dot, hoạt động live, nhân vật) | `bash eval/T-041/run.sh $TOHONG_DASHBOARD_REPO --criterion 5` |
| 6 | `export_dashboard.py` xuất `product` ∈ {planner, hq, ""} cho mỗi việc, khớp `normalize_area(area)`, vùng cũ về đúng sản phẩm, vùng lạ không làm sập (H8) | `python3 eval/T-041/export-product.py` |

Mã eval: `eval/T-041/loc-san-pham.cjs` (qua `eval/T-041/run.sh`) và `eval/T-041/export-product.py`. Cần Playwright (`NODE_PATH` mặc định từ `npm root -g`) và d3 cục bộ (`D3`, mặc định `/opt/npm-tools/node_modules/d3/dist/d3.min.js`). Không dùng checklist vì cả sáu tiêu chí đo được bằng máy. Phần "nhân vật khớp đèn" của eval 5 chỉ chạy khi trang đã có nhân vật trong mô hình (`g.mch[data-block]`, T-031); chưa có thì eval in INFO và bỏ phần đó (đúng như inv-010 "chưa áp dụng").

Đã tự kiểm eval: trên `index.html` hiện tại (chưa có bộ chọn) 1-5 đỏ và 6 đỏ trên exporter hiện tại; trên bản thử nhanh ngoài repo làm đúng spec (chỉ tiêu chí 1-5, chưa có đèn T-032) thì 2, 3, 4 xanh, 1 và 5 chỉ còn đỏ ở "đèn khớp số" (nền thiếu khối đèn); bản thử cố ý đổi khung `#nd_kr` theo bộ lọc làm 3 đỏ; bản thử lọc bằng tiền tố thô của `area` làm 1 đỏ; exporter thử thêm `product` theo spec làm 6 xanh, bản thử so tiền tố thô làm 6 đỏ.

## Bất biến đề xuất (tầng 2), vùng `hq/dashboard`
Đặt ở `eval/invariants/hq/dashboard/` (cha của `model/`); spec-critic rút khi spec qua cổng:
1. **INV-P1 "Tất cả luôn đủ"**: với bộ chọn mặc định `all` (và mọi giá trị lạ trong `localStorage`), mọi việc ở bảy cột của `dashboard.json` có thẻ trên bảng, kể cả việc có `product` rỗng hoặc thiếu. Sản phẩm của một việc chỉ do trường `product` quyết định. Nguồn: tiêu chí 1, 4.
2. **INV-P2 "Cây bất biến khớp tổng"**: tổng các dòng `data-kr-scope` bằng `model.invariants_total`, bất kể thêm sản phẩm hay vùng mới. Nguồn: tiêu chí 2.
3. **INV-P3 "Đổi bộ lọc không đổi hình mô hình"**: đổi bộ lọc sản phẩm không đổi toạ độ/kích thước khối, đường, cổng trong `#model`. Nguồn: tiêu chí 3.
4. **INV-P4 "Sản phẩm của việc do sổ cái xuất"**: mọi việc trong `dashboard.json` có `product` ∈ {planner, hq, ""} và khớp `normalize_area(area)`. Nguồn: tiêu chí 6; bắt lỗi thêm sản phẩm mới ở `task.py` mà quên exporter.

## Không làm
- Không đổi `scripts/export_dashboard.py` ngoài việc thêm trường `product` (H8); không đổi `task.py`, `gate.py`. Không thêm số spec/eval đối kháng/hồi quy theo sản phẩm vào `dashboard.json` (xem Câu hỏi mở).
- Không tách dashboard thành hai trang, không thêm thanh địa chỉ/URL cho bộ lọc.
- Không lọc insight theo sản phẩm (quyết định 5: charter Insight sẽ yêu cầu mục `planner/` và `hq/` trong báo cáo tuần).
- Không đổi hình mô hình, không thêm khối hay đường.

## Đã sửa so với v1 (spec rework lần 1, defect `handoffs/T-041-D1.md`)
- Câu "vùng cũ không tiền tố … không thuộc sản phẩm nào" (Định nghĩa dùng chung v1) -> bỏ. Sản phẩm của việc là trường `product` do exporter xuất bằng `normalize_area` (lỗi 1; quyết định 2, 3). Thêm H8 và tiêu chí 6.
- H3 v1 "nhân vật, dot, Cảnh báo, Dòng thời gian, Feed không bị lọc" -> chuyển hết vào H2 (lỗi 2, lỗi 3; quyết định 1). Thêm eval 5.
- `#relTxt`, `#resTxt`, `#nd_kr .lbl`, `#insCap`, `#krTxt` nay được xếp rõ vào H2 hoặc H3 (lỗi 3); thêm vào `snap()` của eval.
- H4: mỗi dòng phải có tên nhánh và số, không chồng nhau (lỗi 4).
- INV-P3 thu hẹp theo lỗi 5 và quyết định 4; INV-P1 viết lại theo định nghĩa sản phẩm mới; thêm INV-P4.
- H5: thêm chữ "+N" của hàng biểu tượng vào ngoại lệ (lỗi 5, phần cuối); chỉ rõ toạ độ tính từ góc mô hình.
- Mới (tự thấy khi viết eval): đổi bộ chọn thì Dòng thời gian về việc mặc định, vì nếu giữ việc đã bấm thì hai cách cài đặt cho hai màn hình khác nhau; các số 2 và 3 của `#krTxt` không lọc vì exporter không xuất theo sản phẩm.

## Câu hỏi mở
Số spec, eval đối kháng, eval hồi quy ở khối bể (và chữ Insight) hiện không lọc theo sản phẩm vì `dashboard.json` không có chúng theo sản phẩm; muốn "một con số" trọn vẹn phải mở rộng exporter (ngoài phạm vi brief "chỉ thêm trường product"). Có mở một việc riêng cho việc đó không (đề xuất bậc A, phụ thuộc insight gắn nhãn sản phẩm cho phần insight)?
