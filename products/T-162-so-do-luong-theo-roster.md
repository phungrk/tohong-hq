# Spec T-162: Sơ đồ luồng dashboard theo roster; "đang làm" theo việc đang giữ

## Ý định
Capu (2026-11-14, giao qua Chief of Staff): dashboard phản ánh đúng tình trạng hoạt động của team (insight, product, spec-critic, engineering, adversary), không còn bộ phận cũ.

## Bằng chứng
- `/home/user/tohong-hq-dashboard/index.html` dòng 439-440: `POS_WIDE`/`POS_NARROW` viết cứng vị trí cho `product, engineering, vendor-ops, growth, finance, reviewer, done`; không có `insight`, `spec-critic`, `adversary`.
- Cùng file, `drawFlow`: `flows`/`act` lọc bỏ luồng có đầu nào không có vị trí, nên việc ở insight/spec-critic/adversary không hiện.
- Cùng file, `drawFlow`: nhãn "đang làm" chỉ có khi `activeAgents()` (nhịp tohong-live, hạn `ACT_TTL` 120 giây) có agent đó.
- `scripts/export_dashboard.py` dòng ~490: roster lấy nguyên `org/roster.json`, còn `vendor-ops`, `growth`, `finance`.
- Đã chạy 5 eval trên bản trang hiện tại: tiêu chí 1, 2, 3, 4 đỏ, tiêu chí 5 xanh (đúng như kỳ vọng).

## Giả thuyết
Nếu node sơ đồ sinh từ roster và "đang làm" lấy theo việc đang giữ thì Capu nhìn sơ đồ thấy đủ 5 bộ phận và biết ai đang làm mà không cần nhịp live. Chỉ số bảo vệ: T-145 (DATA_URL, realtime) và các bất biến `hq/dashboard` không đỏ.

## Hành vi (người dùng thấy gì)
Bản v3 (sửa theo T-163-D1 của adversary, Chief phân xử): thêm Hành vi 4(c) thiếu CLAUDE.md, 4(d) code block, và tên dài ở Hành vi 1; sửa tên nhánh. Bản v2 (sửa theo defect T-162-D1, Chief phân xử): đã sửa Hành vi 1 (node `done` giữ; "chồng nhau" đo bằng hộp bao), 2 (`done` là đích hợp lệ; đo bằng toạ độ màn hình), 3 (viết lại thành bảng, bỏ mâu thuẫn "khi và chỉ khi … hoặc nhịp" với "thay cho"), 4 (hai ca lỗi), vì bản v1 cho phép nhiều cách hiểu.

1. **Node theo roster.** Sơ đồ luồng có đúng một node cho mỗi phần tử của `roster` trong dashboard.json (thêm bộ phận vào roster thì có node, không sửa trang) và đúng một node "Hoàn thành" (`done`). `done` không thuộc roster nhưng là ngoại lệ được giữ vì là đích của luồng. Không có node nào khác. Ở khung rộng (1200px) và hẹp (390px): hộp bao (`getBoundingClientRect`) của vòng tròn mỗi node, nới 4px mỗi phía, không giao hộp của node khác (nghĩa là cách nhau ít nhất 8px); mỗi node nằm trong khung sơ đồ; trang không cuộn ngang. Tên dài (kể cả phần tử tối thiểu có name = id dài như `qa-kiem-thu-tu-dong`) không làm node vượt khung: chữ tên trên node bị cắt bằng dấu "…" để hộp node (vòng tròn, nhãn) luôn nằm trong khung ở 390px và 1200px; tên đầy đủ hiện trong `title` hoặc tooltip. Ca 320px không bắt buộc. Cách xếp vị trí do cài đặt quyết định.
2. **Luồng đủ.** Mọi luồng mà cả hai đầu là bộ phận trong roster hoặc `done` đều hiện, gồm luồng tới và đi từ `insight`, `spec-critic`, `adversary`, và luồng tới `done`: đường lịch sử (bàn giao, trả về) và đường đang chạy. Luồng có đầu là id ngoài roster và khác `done` (vd `vendor-ops`) thì không vẽ. Đầu mút của đường được xác định bằng toạ độ màn hình: đầu mút nằm trong hộp bao vòng tròn của node, nới 10px.
3. **Chữ và sprite trên node.** Mỗi node hiện tối đa một dòng trạng thái, theo thứ tự ưu tiên:

| Tình huống của agent | Chữ trên node | Sprite |
| --- | --- | --- |
| Có nhịp tohong-live còn hạn (trong `ACT_TTL`; nhịp mới nhất theo `at`, không theo thứ tự trong danh sách) và việc của nhịp thuộc phạm vi bộ lọc sản phẩm | Hành động của nhịp đó. Không có chữ "Đang làm" | `working` |
| Không có nhịp nào như trên, và giữ (`holder`) ít nhất một việc `doing`, `review`, `spec` hoặc `rework` thuộc phạm vi bộ lọc sản phẩm | "Đang làm" | `working` |
| Còn lại (gồm: chỉ giữ việc `new`, `escalated`, `blocked`, `done`; nhịp quá hạn mà không giữ việc hợp lệ; nhịp hoặc việc nằm ngoài bộ lọc) | Không có chữ | không phải `working` |

   Sprite đổi theo đúng bảng này, khớp với chữ (chỉ áp cho nhân vật trên sơ đồ luồng; hình #model không đổi). Việc `new` không còn làm sprite "working" trên sơ đồ luồng: đây là thay đổi có chủ ý. Cả hai luật (giữ việc và nhịp) áp bộ lọc sản phẩm như nhau: chọn lọc `hq` thì việc và nhịp của sản phẩm khác không tính.
4. **Roster xuất ra.** `export_dashboard.py` chỉ đưa vào `roster` (trong `dashboard.json` và `roster.json`): `capu`, `chief-of-staff`, và các id có trong danh sách bộ phận của `CLAUDE.md` (các dòng khớp ``^- `id` — ``; đọc lúc chạy, không viết cứng). Bỏ phần còn lại của `org/roster.json` (hiện: `vendor-ops`, `growth`, `finance`).
   - (a) Không có dòng bộ phận nào khớp mẫu: export in lỗi, thoát mã khác 0, không ghi đè `dashboard.json` đang có (workflow đỏ, dữ liệu cũ còn nguyên). `capu` và `chief-of-staff` không tính là dòng khớp.
   - Danh sách bộ phận chỉ gồm các dòng khớp mẫu và nằm ngoài fenced code block (```); dòng khớp mẫu trong code block không tính (d).
   - (b) Có id trong CLAUDE.md mà `org/roster.json` không có: tạo một phần tử roster tối thiểu (`id`, `name` = id) và in dòng `::warning::` (không lỗi).
   - (c) Thiếu file CLAUDE.md: nếu có biến môi trường `TOHONG_ROOT` (môi trường thử mà các bất biến `hq/dashboard`, `check_4` và `ledger/inv-007` đặt) thì giữ nguyên `org/roster.json` và in `::warning::`, thoát 0. Nếu không có `TOHONG_ROOT` (workflow thật) thì xếp vào (a): in lỗi, thoát khác 0, không ghi đè `dashboard.json`. Không phải sửa bất biến nào.
   - (d) Dòng ``- `id` — `` nằm trong code block không tính là bộ phận: id đó không vào roster và không có `::warning::` cho nó.
   - `chatgpt` không có node: bộ phận ngoài phiên, không ghi sổ cái (ADR-058, ADR-059), nên sẽ luôn rảnh và không có luồng nào; nó không nằm trong danh sách ``- `id` —`` của CLAUDE.md. Đổi ý thì thêm một dòng vào danh sách đó.
5. **Không đổi.** `DATA_URL` vẫn là `https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json` (INV-019); trang vẫn nối WebSocket `tohong-live` mặc định và `?live=` vẫn đổi host; `#live` hiện "Trực tiếp" khi kênh mở.

## Ràng buộc (vòi)
- Hai PR, hai repo:
  - **`phungrk/tohong-hq-dashboard`** (trang công khai), nhánh `t-162-roster-luong`: `index.html` (bỏ `POS_WIDE`/`POS_NARROW` viết cứng, "đang làm" theo việc giữ, lọc luồng theo roster) và `tests/` nếu cần.
  - **`phungrk/tohong-hq`** (sổ cái, private): chỉ `scripts/export_dashboard.py`. File này nằm ngoài sổ cái nên workflow tự mở PR để Capu duyệt (không tự merge).
- Vùng `hq/dashboard`. Bất biến đã đọc: `eval/invariants/_shared/`, `eval/invariants/hq/dashboard/` (inv-001..017, `model/`: đặc biệt `inv-003` hình #model không đổi, `model/inv-006` không cuộn ngang 390px, `model/inv-037` tải lần đầu ở màn hẹp, `model/inv-010` nhân vật khớp khối sáng) và INV-019 của T-145. Spec không vi phạm bất biến nào. Chỗ cần lưu ý: sprite nhân vật (`ROLES`) có thể chưa có vai cho bộ phận mới; đã có nhánh dự phòng `_`, giữ nguyên.
- Không chạm: `org/roster.json` (nguồn sơ đồ tổ chức; chỉ lọc ở đầu ra), `dashboard-data`, payment, auth, DB, dữ liệu người dùng.
- Bậc đề xuất: A (UI dashboard, eval tự động phủ đủ). Riêng PR của `export_dashboard.py` nằm ngoài sổ cái nên Capu duyệt theo workflow.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; trang đọc `${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}`, d3 qua biến `D3`.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mỗi phần tử roster (kể cả một id mới thêm trong fixture) và `done` có node, không node khác; hộp bao vòng tròn không chồng/không sát hơn 8px; trong khung; không cuộn ngang; ở 1200px và 390px | `bash eval/T-162/check_1.sh`; tên dài và dữ liệu biên: `bash eval/T-162/check_1_ten_dai.sh` |
| 2 | Luồng lịch sử và đang chạy tới/đi từ insight, spec-critic, adversary và tới `done` hiện ở cả hai khung (đo bằng toạ độ màn hình); luồng của agent cũ không vẽ | `bash eval/T-162/check_2.sh` |
| 3 | Đúng bảng chữ/sprite ở Hành vi 3: có nhịp thì hành động mới nhất và KHÔNG có "Đang làm"; không nhịp + giữ việc thì "Đang làm"; còn lại không chữ; sprite khớp; nhịp quá hạn; bộ lọc hq/planner áp cho cả hai luật | `bash eval/T-162/check_3.sh` |
| 4 | Roster xuất ra = capu, chief-of-staff + bộ phận trong CLAUDE.md (đọc lúc chạy); (a) không dòng nào khớp -> thoát khác 0, không ghi đè dashboard.json; (b) id vắng trong org/roster.json -> phần tử tối thiểu + `::warning::` | `python3 eval/T-162/check_4.py`; thêm `python3 eval/T-163/adv-01-thieu-claude-md-so-cai-that.py` (4c), `python3 eval/T-163/adv-03-dong-bo-phan-trong-code-block.py` (4d) |
| 5 | `DATA_URL` đúng, banner lỗi ẩn, WebSocket `tohong-live` mở, `#live` = "Trực tiếp", `?live=` đổi host | `bash eval/T-162/check_5.sh` |

Mỗi tiêu chí đúng một eval. Dạng 2 (script) vì kiểm được bằng trình duyệt giả lập. Tiêu chí 5 xanh sẵn: là eval giữ nguyên hành vi T-145, không phải tính năng mới.

## Bất biến đề xuất (tầng 2)
- `hq/dashboard`: "Mọi phần tử roster có node trong sơ đồ luồng ở 1200px và 390px, không node ngoài roster" (= `check_1`, đổi fixture về roster 7 bộ phận).
- `hq/dashboard`: "Chữ và sprite của node theo bảng Hành vi 3" (= `check_3`).
Spec Critic quyết rút vào bể hay không.

## Không làm
- Không đổi hình #model (khối, đường, cổng) và nhân vật trong #model, KPI, kanban.
- Không đổi cách tohong-live phát nhịp hay hook ghi nhịp.
- Không sửa `org/roster.json`; không đổi định dạng `dashboard.json` ngoài việc bớt phần tử roster.
- Không thêm sprite mới cho bộ phận mới.

## Câu hỏi mở
Không.
