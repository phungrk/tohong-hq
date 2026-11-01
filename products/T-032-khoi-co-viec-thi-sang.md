# Spec T-032: Khối có số đếm việc > 0 thì sáng (sửa đổi T-028 mục 4)

<!-- Spec sửa đổi: chỉ thay các câu nêu ở "Câu nào của T-028 bị thay". Mọi câu khác của T-028 giữ nguyên. -->

## Ý định
Capu (2026-11-01, `board/T-032.md`, kèm ảnh): khối Ý định ghi "1 việc product chờ viết spec" mà không sáng. Khối nào đang có việc thì phải sáng như mọi khối khác; Capu không được thấy khối có việc mà vẫn tối.

## Câu nào của T-028 bị thay
Nguyên nhân là spec T-028 (`products/T-028-mo-hinh-dot-chay.md`), mục 4 "Khối đang xử lý", quy tắc A. Hai câu bị thay, cả hai nằm ở dòng 77:
1. "Việc `new`, `blocked`, việc `done` bậc A hoặc quá 48 giờ không làm khối nào sáng" -> **thay bằng**: "Việc `new` của `product` làm khối `nd_intents` sáng (bảng bên dưới). Việc `new` của chủ khác, việc `blocked`, việc `done` bậc A hoặc quá 48 giờ không làm khối nào sáng."
2. "Các khối còn lại (`nd_intents`, `nd_kr`, `nd_rel`, `nd_prod`, `src_*`) không có quy tắc A." -> **thay bằng**: "Các khối còn lại (`nd_kr`, `nd_rel`, `nd_prod`, `src_*`) không có quy tắc A, vì lý do ghi ở mục E2-E6 của spec T-032."
Không đổi: bảng ánh xạ dot, màu, quy tắc B, mục 5 và 6 của T-028 (trừ dòng "Khối rảnh không tô" ở "Hệ quả", vẫn đúng: khối rảnh là khối có số đếm 0).
Hệ quả cho T-028: thêm một hàng vào bảng quy tắc A: `nd_intents` | chủ việc `product`, `state=new` | spec.

## Bằng chứng
- Ảnh Capu gửi + `board/T-032.md`: Ý định hiện "1 việc product chờ viết spec" mà tối.
- `/home/user/tohong-hq-dashboard/index.html` @ main `e184780`, hàm `drawModel` (dòng ~775-807): `setNode('nd_intents', specNew.length, …)` rồi `STATECOL={nd_spec,gt_spec,nd_respec,nd_exec,nd_rework,gt_code,nd_capu,nd_insight,nd_rel:null}`; không có `nd_intents` trong STATECOL nên số đếm 1 không bật được khối. Chạy `eval/T-032/run.sh` trên `e184780`: đỏ ở C1, C2, C4, C5, C6 (đúng chỗ này).
- Vì sao Spec Gate và Adversary không bắt: code đúng từng chữ của T-028 dòng 77; lỗi nằm ở spec, nên tầng 2 và tầng 3 đều xanh. Đây là lỗi của spec (bể thiếu bất biến "số đếm > 0 thì sáng").
- Mức tự tin: cao (~90%) về nguyên nhân; quyết định cho từng khối ở bảng dưới là phán đoán của Spec Writer, tự tin ~75% (Capu chỉ nêu Ý định, các khối khác là suy ra từ cùng nguyên tắc).

## Giả thuyết
Nếu mọi khối có số đếm việc đều sáng khi số > 0 thì Capu nhìn bảng không còn gặp ca "ghi có việc mà tối". Chỉ số bảo vệ: bảng không bị sáng kẹt (inv-004), không thêm dot, không cuộn ngang ở 390px.

## Hành vi (người dùng thấy gì)

### Quy tắc chung (thay cho "chỉ vài khối có quy tắc A")
**Số đếm hiển thị của một khối** là: (a) chữ số lớn `.n` (riêng `nd_exec`: cả số "N chờ" trong chú thích) trong khối `nd_*` kiểu việc (`nd_intents`, `nd_spec`, `nd_respec`, `nd_exec`, `nd_rework`, `nd_capu`); (b) số "N chờ" trong cổng (`gt_spec` ở `#sgateQ`, `gt_code` ở `#gateQ`). Khối có số đếm hiển thị mà là **số việc đang ở khối đó** thì: **số > 0 -> sáng (quy tắc A) màu theo loại; số về 0 -> tắt**, ngay khi trang vẽ lại (qua live hay tải lại), không chờ gì thêm. Số "N chờ" ở chú thích của `nd_exec` cũng là số đếm việc đang ở khối (việc `engineering` `new`) và làm khối sáng (ADR-013); các số tích luỹ trong chú thích thì không (E2-E6).

### Quyết định từng khối

| Khối | Số đếm hiển thị | Quyết định | Màu khi chỉ có A | Ghi chú |
| --- | --- | --- | --- | --- |
| `nd_intents` | `.n` = số việc chủ `product`, `state=new` ("việc product chờ viết spec") | **Sáng khi > 0, tắt khi 0** (thay đổi chính của T-032) | spec `#14754d` | Vẫn nháy 0,6 giây (B) khi dot tới. Nếu số > 0 thì nháy xong về màu spec, không tắt; số = 0 thì nháy xong tắt (như T-028). |
| `nd_spec` | `.n` = chủ `product`, `doing`/`rework` | Giữ như T-028 | spec | Không đổi |
| `gt_spec` | `#sgateQ` = chủ `product`, `review` | Giữ | spec | Không đổi |
| `nd_respec` | `.n` = `state=spec` | Giữ | back | Không đổi |
| `nd_exec` | `.n` = chủ `engineering`, `doing`; chú thích "N chờ" = chủ `engineering`, `new` | **Sáng khi `.n` > 0 hoặc "N chờ" > 0** (ADR-013 bỏ E1); tắt khi cả hai bằng 0. Con số hiển thị giữ nguyên, không gộp | code | Việc `engineering` `rework` thuộc `nd_rework`, không làm `nd_exec` sáng. Việc `engineering` `new` cũng là việc chưa ai nhận như việc `product` `new`, nên cùng quy tắc. |
| `nd_rework` | `.n` = chủ `engineering`, `rework` | Giữ | back | Không đổi |
| `gt_code` | `#gateQ` = chủ `engineering`, `review` | Giữ | code | Không đổi |
| `nd_capu` | `.n` = leo thang + diff chờ đọc | Giữ | bad nếu có leo thang, ngược lại code | Không đổi |
| `nd_insight` | `.n` không có; chú thích "N báo cáo tuần" là **tích luỹ** | Giữ: sáng theo việc `insight` `doing`/`rework`, **không** theo số báo cáo | ins | **E5**: số báo cáo tăng mãi, sáng theo nó thì sáng vĩnh viễn. |
| `nd_prod` | "N việc xong · M có lỗi minor": **tích luỹ** | **Ngoại lệ E2**: không có quy tắc A; chỉ nháy 0,6 giây khi release tới (B, như T-028) | (không) | Số đếm việc đã xong chỉ tăng, luôn > 0 sau việc đầu tiên: sáng theo nó thì sáng mãi, không còn mang thông tin. "Đang có release" không có trạng thái nào trong sổ cái, nên không có việc nào để sáng theo. |
| `nd_rel` | "N release 7 ngày qua": đếm theo **cửa sổ thời gian**, không phải việc đang ở khối | **Ngoại lệ E3**: không có quy tắc A; sáng theo B trong chuỗi M9 (như T-028) | (không) | Cùng lý do E2: gần như luôn > 0 khi công ty đang chạy, và đã xong nghĩa là đã deploy, không còn "đang xử lý". |
| `nd_kr` | "N bất biến · M eval đối kháng · K hồi quy": **tích luỹ** | **Ngoại lệ E4**: không có quy tắc A; nháy 0,6 giây khi dot tới (B) | (không) | Bể chỉ lớn lên, không bao giờ về 0. |
| `src_data`, `src_inc`, `src_fb` | **Không có số đếm** | **E6**: không có quy tắc A, chỉ nháy khi dot tới (B) | (không) | Không có con số nào để đối chiếu; nguồn dữ liệu không phải việc. |

Quy ước cho ngoại lệ: khối có số đếm **tích luỹ hoặc theo cửa sổ thời gian** (không phải "số việc đang ở khối này") thì ngoại lệ; thêm khối mới có số đếm thì phải xếp vào một trong hai loại và ghi vào bảng này.

### Tình huống
- **Ảnh của Capu:** sổ cái có 1 việc `product` `new`, không việc nào khác: Ý định ghi "1", sáng viền 3px màu `#14754d`, nền `color-mix(in srgb, #14754d 18%, var(--panel))`; không khối nào khác sáng.
- **Về 0:** việc đó chuyển `doing` (qua live hoặc tải lại): Ý định ghi "0" và tắt; Spec Writer sáng spec.
- **Giao việc mới qua live:** `assigned` tới `product`: Ý định nháy rồi **ở lại sáng spec** (số đếm 1), không tắt sau 0,6 giây; hai việc `new` thì ghi "2" và vẫn sáng.
- **Dot insight tới Ý định khi số > 0:** màu B (ins) trong 0,6 giây rồi về spec. Khi số = 0: nháy rồi tắt.
- **Việc `new` của `engineering`/`insight`/`chief-of-staff`:** Ý định ghi "0", tắt. Riêng `engineering` `new`: Thực thi ghi "0 đang code · 1 chờ" và sáng màu code; về 0 cả hai thì tắt.
- **`prefers-reduced-motion: reduce`:** Ý định vẫn sáng/tắt theo số đếm như trên; vẫn không `circle` nào.
- **390px:** như T-028: không cuộn ngang, `.n` hiển thị >= 9px; Ý định sáng/tắt giống desktop.
- **Dữ liệu thiếu:** như T-028, không ném lỗi.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` · Nhánh: `t-032-…` (Engineering điền) · Vùng (`area`): `dashboard/model`.
- Bất biến của vùng đã đọc: `eval/invariants/dashboard/model/` inv-001..008. Spec này không vi phạm inv-001, 002, 003, 005, 006, 007, 008. **`inv-004` (không kẹt sáng) cần cập nhật**: dữ liệu "rảnh" của nó chứa `T('T-3','new','product')` và kỳ vọng không khối nào sáng; theo spec này khối Ý định phải sáng với dữ liệu đó, nên sau T-032 inv-004 sẽ đỏ oan. Đề xuất cụ thể ở "Bất biến đề xuất". Chief of Staff phân xử, ghi `decisions/`.
- Eval cũ sẽ đỏ sau khi T-032 merge (mô tả hành vi bị thay, không phải lỗi code): `eval/T-028/model-dots.cjs` kịch bản S1 (khối `nd_intents` "rảnh không tô" với `T-9` là `new` của product, dòng ~313, 320) và S4 (`T-5` `new` của product và `T-3` `new` của engineering, dòng ~336: sau ADR-013 Thực thi cũng sáng). Chief of Staff phân xử như ADR-010, không sửa test cho khớp code.
- Kiến trúc: một file `index.html`, không thêm thư viện, không đổi schema `dashboard.json`, không đổi bảng ánh xạ dot, không đổi màu. (Gợi ý, không ép: thêm một khoá vào bảng màu theo sổ cái là đủ cho Ý định.)
- Không chạm payment, auth, DB, dữ liệu người dùng. Không gửi gì ra ngoài.
- Bậc lưới lọc: **A** (đúng bậc Capu đặt): UI tĩnh, eval tự động phủ cả 6 tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ `cd /home/user/tohong-hq`; `<repo>` là thư mục repo dashboard. Cần Playwright (`NODE_PATH=$(npm root -g)`) và d3 cục bộ (`D3=…/d3.min.js` nếu không tìm thấy).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Ý định ghi đúng số việc `product` `new`; số > 0 thì sáng viền 3px màu spec `#14754d`, nền 18%; về 0 thì tắt (qua live, và lúc mở trang); việc `new` của chủ khác không làm nó sáng; giao việc mới qua live thì ở lại sáng. Tái hiện đúng ảnh của Capu | `bash eval/T-032/run.sh <repo> --criterion 1` |
| 2 | Mọi khối có số đếm "việc đang ở khối" (`nd_intents`, `nd_spec`, `gt_spec`, `nd_respec`, `nd_exec`, `nd_rework`, `gt_code`, `nd_capu`): số > 0 thì sáng đúng màu loại, số = 0 thì tối, khối khác không sáng oan (dữ liệu đầy đủ và từng khối riêng lẻ) | `bash eval/T-032/run.sh <repo> --criterion 2` |
| 3 | Các ngoại lệ E2-E6 đúng: với số tích luỹ > 0, `nd_prod`, `nd_rel`, `nd_kr`, `nd_insight` (khi không có việc insight đang làm), `src_*` đều không sáng; dot vẫn nháy rồi tắt trong 13 giây | `bash eval/T-032/run.sh <repo> --criterion 3` |
| 4 | Dot (B) đè lên khối đang sáng theo A rồi trả về màu spec, không tắt; khối số 0 nhận dot thì nháy rồi tắt | `bash eval/T-032/run.sh <repo> --criterion 4` |
| 5 | `prefers-reduced-motion: reduce`: Ý định sáng/tắt theo số đếm, không tạo `circle` nào | `bash eval/T-032/run.sh <repo> --criterion 5` |
| 6 | 390px: Ý định sáng/tắt đúng, không cuộn ngang, `.n` hiển thị >= 9px | `bash eval/T-032/run.sh <repo> --criterion 6` |
| 7 | Không vi phạm bất biến inv-001..008 (với inv-004 đã cập nhật theo đề xuất) | `for f in eval/invariants/dashboard/model/inv-*.sh; do TOHONG_DASHBOARD_REPO=<repo> bash $f; done` (tầng 2, máy chạy ở Code Gate) |
| 8 | Eval T-032 đỏ trên main `e184780` (tái hiện lỗi) | `bash eval/T-032/run.sh /home/user/tohong-hq-dashboard` khi repo ở `e184780` phải in `FAIL` (đã chạy: đỏ C1, C2, C4, C5, C6) |

Cả sáu tiêu chí 1-6 chạy một lệnh `bash eval/T-032/run.sh <repo>` (in từng `PASS Cn` / `FAIL Cn.<ý>`, dòng cuối `PASS` hoặc `FAIL`, mã thoát 0/1). Chụp ảnh: `bash eval/T-032/run.sh <repo> --shots <thư-mục> --task T-032` ghi PNG vào `<thư-mục>/T-032/`.
Đã kiểm eval xanh khi có bản vá tối thiểu (thêm `nd_intents` vào bảng màu theo sổ cái trên bản sao của `e184780`, ngoài repo): `PASS` cả sáu tiêu chí, nên eval khả thi.

## Bất biến đề xuất (tầng 2)
1. **Sửa inv-004** (`eval/invariants/dashboard/model/lib/model_inv.cjs`, check `no-stuck-lit`; và dòng mô tả ở đầu `inv-004-khong-ket-sang.sh`). Lý do: dữ liệu "rảnh" hiện chứa việc `new` của `product`, sau T-032 Ý định phải sáng với dữ liệu đó. Đề xuất cụ thể:
   - Trong dữ liệu rảnh, đổi `T('T-3','new','product')` thành `T('T-3','new','insight')` (việc `new` của insight không đếm vào khối nào; KHÔNG dùng `engineering`, vì sau ADR-013 việc đó làm Thực thi sáng) và thêm `T('T-5','new','chief-of-staff')`. Mọi phần còn lại của check giữ nguyên (không khối nào sáng lúc mở; sau dot `assigned -> insight` 14,5 giây vẫn không khối nào sáng).
   - Đổi dòng mô tả thành: "khối có số đếm việc đang ở khối bằng 0 thì không sáng; khối giữ dot nhận dot mà sổ cái không có việc thì tắt trong 10 giây".
   Bản chất bất biến không đổi (không kẹt sáng); chỉ bỏ một dữ liệu nay không còn "rảnh".
2. **Bất biến mới inv-009 "số đếm > 0 thì sáng"**: với mọi khối trong bảng "Quyết định từng khối" có loại "sáng khi > 0" (8 khối đầu), khối sáng khi và chỉ khi số đếm hiển thị của nó > 0, đúng màu loại. Ghép được từ tiêu chí 2 của `eval/T-032/khoi-sang.cjs` (hàm `c2`). Ngoại lệ E2-E6 chỉ tồn tại nếu liệt kê trong bảng; thêm khối có số đếm mới mà không xếp loại thì đỏ. Đây là chỗ T-028 thiếu nên Spec Gate không bắt được.

## Không làm
- Đổi bảng ánh xạ dot, màu, quy tắc B, chú giải.
- Làm Production/Release/Reservoir sáng theo bất kỳ cách nào khác ngoài nháy khi dot tới (E2-E4); muốn "Production sáng khi đang deploy" thì cần trạng thái deploy trong sổ cái, việc riêng.
- Gộp "đang code" và "chờ" thành một con số trên khối Thực thi (ADR-013: giữ nguyên hai số).
- T-031 (nhân vật), T-030.

## Câu hỏi mở
Không. (Capu có thể đảo E2-E4: các khối tích luỹ không sáng. Đổi thì sửa một dòng trong bảng và một ý trong eval.)
