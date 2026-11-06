# Spec T-087: board có nháy kép hỏng không làm sập sổ cái

## Ý định
Capu (2026-11-06, qua adversary T-086 v2): một file board ghi tay sai dấu nháy (vd `issue: ""12""`) không được làm dừng task.py, export dashboard hay gate. Hiện `read_task` (scripts/task.py ~dòng 139) gọi `json.loads` khi giá trị bắt đầu và kết thúc bằng `"`; giá trị không phải JSON hợp lệ ném `JSONDecodeError` (không phải `LedgerError`, nên `all_tasks()` và `main()` đều không bắt). Lỗi có từ trước T-086.

## Bằng chứng
- Adversary T-086 v2 (note trong `board/T-087.md`, mục Bối cảnh). Tái hiện: `eval/T-087/check_1_khong_sap.py` hiện đỏ với `JSONDecodeError: Extra data`.
- Nơi gọi chung `read_task`/`all_tasks`: task.py, export_dashboard.py, gate.py, cost.py, mirror_issue.py, mirror_project.py, ok_issue.py (grep, 2026-11-07). Sửa một chỗ trong `read_task` phủ hết.

## Giả thuyết
Nếu `read_task` không ném khi nháy hỏng thì một lỗi gõ tay trong một board không còn dừng cả sổ cái. Chỉ số bảo vệ: giá trị hợp lệ đọc ra y như cũ; INV-001 (issue là số nguyên dương) giữ nguyên.

## Hành vi
Quy trình đọc một file board, theo đúng thứ tự:

**Bước 1, trường hỏng nhẹ.** Với mỗi dòng frontmatter `khoá: giá trị`: nếu giá trị (sau `strip()`) dài từ 2 ký tự, bắt đầu và kết thúc bằng `"`, mà **không** phải một chuỗi JSON hợp lệ theo JSON chặt (`strict=True`: ký tự điều khiển như tab thô nằm trong nháy là hỏng), thì đó là trường hỏng nhẹ. Giá trị dùng là phần còn lại sau khi bỏ **mọi** dấu `"` và khoảng trắng ở hai đầu. Vd `""review""` -> `review`, `""12""` -> `12`, `"Xin "chao" ban"` -> `Xin "chao" ban`, `"\q"` -> `\q`, `"" abc ""` -> `abc`. Mỗi (file, trường) có **một dòng stderr** mỗi tiến trình: `Cảnh báo: board/T-xxx.md · trường <tên>: nháy kép hỏng, đã bỏ nháy ngoài`. Stdout không bị chen gì (JSON của `--json` và exporter còn hợp lệ). Giá trị một ký tự `"` hay nháy một đầu (`"12`, `12"`) không phải trường hỏng: đọc như cũ. Giá trị là chuỗi JSON hợp lệ (kể cả `""`, có `\"`, `:`, `#`), danh sách `eval`, giá trị không nháy: đọc như cũ từng byte, không cảnh báo.
Hệ quả: `issue: ""12""` đọc ra `12`, là số nguyên dương nên **có link issue 12** (khớp INV-001, vì giá trị đọc ra là 12).

**Bước 2, board hỏng nặng.** Sau bước 1, board là *hỏng nặng* nếu một trong: `id` khác tên file (không kể `.md`); `state` không thuộc STATES; `area` không rỗng và không qua `normalize_area` (vùng cũ trong LEGACY_AREAS vẫn hợp lệ); `tier` không rỗng và không thuộc A/B/C. (Áp dụng cả khi trường không hề có nháy hỏng, vd `state: xyz`.) Với board hỏng nặng:
- `read_task` ném `LedgerError` nêu file + trường (không lỗi loại khác). Mọi nơi quét board (`all_tasks`, task.py list/summary, export_dashboard.py, gate.py, mirror_*.py, ok_issue.py, cost.py) **bỏ qua** board đó, không Traceback, và in một dòng stderr `Cảnh báo: board/T-xxx.md · trường <tên>: giá trị không hợp lệ (<giá trị đọc ra>), board bị bỏ qua`. Việc đó không có trong `counts`, `list`, `tasks.json`.
- `gate.py T-xxx` trên chính việc đó: thoát khác 0 kèm `Lỗi:` nêu file + trường, không Traceback.
- Mọi lệnh đổi trạng thái (`start`, `handoff`, `accept`, `reject`, `respec`, `cost`, …) trên việc đó **từ chối**: thoát khác 0, stderr nêu `board/T-xxx.md` + `trường <tên>`, không ghi board, không ghi sổ cái.
- `task.py new` không sập: số mới = 1 + số lớn nhất trong **tên file** `board/T-nnn.md` (kể cả file hỏng nặng), nên không bao giờ trùng một file có sẵn.

**summary.** `task.py summary` in mục `Board hỏng:` ngay sau mục `Cảnh báo` (không in khi rỗng), mỗi file một dòng `  - T-xxx (board/T-xxx.md) [nhẹ|nặng]: <trường1>, <trường2>` (mọi trường bị gắn cờ, theo thứ tự trong file; `nặng` nếu có ít nhất một trường nặng). `summary --json` có khoá `board_hong`: danh sách `{"task","file","fields":[...],"severity":"nhe"|"nang"}`, `[]` khi lành. summary thoát 0. Việc hỏng nhẹ được đếm (bằng giá trị đã chuẩn hoá); hỏng nặng thì không.

**Ghi lại (hỏng nhẹ).** `write_task` luôn ghi giá trị thành JSON hợp lệ, nên sau lệnh đổi trạng thái đầu tiên trên việc hỏng nhẹ, giá trị đã là bản chuẩn hoá của bước 1, cảnh báo và mục `Board hỏng` của việc đó **biến mất**. Đây là hành vi đúng, không phải lỗi. Lệnh không đổi trường nào ngoài những trường nó vốn phải đổi.

## Ràng buộc
- Repo: `tohong-hq` · Vùng: `hq/ledger` · được sửa `read_task`, `all_tasks`, `next_id`, `build_summary` và các nơi gọi cần thiết (task.py, gate.py, export_dashboard.py, mirror_*.py, ok_issue.py, cost.py). Không sửa tay board thật.
- Bất biến đã đọc: `eval/invariants/_shared/`, `hq/` (INV-001, 002), `hq/ledger/` INV-001..005, `hq/dashboard/` INV-001..013. Không vi phạm. INV-001 giữ: issue chỉ có link khi giá trị đọc ra là số nguyên dương (`""12""` đọc ra 12 nên có link).
- Không chạm: payment, auth, DB, dữ liệu người dùng. Bậc **A**: eval tự động phủ hết, chỉ sổ cái nội bộ.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Bước 1: nháy hỏng ở id/title/state/area/issue/budget không làm list/summary/export/gate sập; giá trị đọc ra đã chuẩn hoá; stderr nêu file + trường; issue 12 có link; việc lành không bị cảnh báo | `python3 eval/T-087/check_1_khong_sap.py` |
| 2 | Giá trị hợp lệ đọc như cũ, không cảnh báo | `python3 eval/T-087/check_2_hop_le_nhu_cu.py` |
| 3 | summary (text + json) báo board hỏng nhẹ kèm mức; board lành thì không | `python3 eval/T-087/check_3_summary_bao_hong.py` |
| 4 | Bất biến `_shared`, `hq`, `hq/ledger`, `hq/dashboard` xanh (bỏ qua file shell thiếu D3 trong môi trường; Code Gate tầng 2 chạy đủ) | `python3 eval/T-087/check_4_bat_bien.py` |
| 5 | Lệnh đổi trạng thái chạy trên việc hỏng nhẹ; sau lệnh giá trị đã chuẩn hoá, cảnh báo biến mất | `python3 eval/T-087/check_5_lenh_doi_trang_thai.py` |
| 6 | Bước 2: state/area/id/tier hỏng nặng bị bỏ qua ở list/summary/export/gate, summary liệt kê mức nặng, lệnh đổi trạng thái từ chối không ghi gì, `new` cấp số đúng, read_task ném LedgerError | `python3 eval/T-087/check_6_hong_nang.py` |

Mọi eval chạy trên sổ cái tạm (`TOHONG_ROOT`). Capu nêu 4 tiêu chí; 5 và 6 do Spec Writer thêm theo phân xử của Chief of Staff. mirror_*.py/ok_issue.py/cost.py không có eval riêng (cần mạng/hook): chúng dựa vào hợp đồng `read_task` ném `LedgerError` ở tiêu chí 6 và phải bắt nó khi lặp qua board.

## Bất biến đề xuất (tầng 2, hq/ledger)
INV mới. Phát biểu: sổ cái thật có `summary --json` thoát 0 và `board_hong` rỗng; sổ cái tạm có board hỏng nhẹ và nặng thì list/summary/export thoát 0, không Traceback. Bản nháp: `eval/T-087/proposed-inv-board-doc-duoc.py`.

## Không làm
- Không sửa tay hay "chữa" file board thật (việc bỏ nháy chỉ xảy ra khi đọc và khi lệnh ghi lại).
- Không xử lý trường số (`rounds`, `version`, `spec_returns`, `evals_added`, `cost`) có giá trị không phải số: `int()`/`float()` vẫn ném. Cùng lớp lỗi nhưng khác nguyên nhân.
- Không đổi `FIELDS`, format ghi của giá trị hợp lệ, hay INV-001.

## Câu hỏi mở
Có mở rộng sang trường số hỏng (`rounds: abc`) trong cùng việc này, hay tách việc mới? (Spec mặc định: tách.)
