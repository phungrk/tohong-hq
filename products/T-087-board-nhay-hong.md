# Spec T-087: board có nháy kép hỏng không làm sập sổ cái

## Ý định
Capu (2026-11-06, qua adversary T-086 v2): một file board ghi tay sai dấu nháy (vd `issue: ""12""`) không được làm dừng task.py, export dashboard hay gate. Hiện `read_task` (scripts/task.py ~dòng 139) gọi `json.loads` khi giá trị bắt đầu và kết thúc bằng `"`; giá trị không phải JSON hợp lệ ném `JSONDecodeError` (không phải `LedgerError`, nên `all_tasks()` và `main()` đều không bắt). Lỗi có từ trước T-086.

## Bằng chứng
- Adversary T-086 v2 (note trong `board/T-087.md`, mục Bối cảnh). Tái hiện: `eval/T-087/check_1_khong_sap.py` hiện đỏ với `JSONDecodeError: Extra data`.
- Nơi gọi chung `read_task`/`all_tasks`: task.py, export_dashboard.py, gate.py, cost.py, mirror_issue.py, mirror_project.py, ok_issue.py (grep, 2026-11-07). Sửa một chỗ trong `read_task` phủ hết.

## Giả thuyết
Nếu `read_task` không ném khi nháy hỏng thì một lỗi gõ tay trong một board không còn dừng cả sổ cái. Chỉ số bảo vệ: giá trị hợp lệ đọc ra y như cũ; INV-001 (issue là số nguyên dương) giữ nguyên.

## Hành vi
Định nghĩa **trường hỏng**: dòng frontmatter `khoá: giá trị` mà giá trị (sau `strip()`) dài từ 2 ký tự, bắt đầu và kết thúc bằng `"`, nhưng không phải một chuỗi JSON hợp lệ (vd `""12""`, `"Xin "chao" ban"`, `"\q"`). Giá trị một ký tự `"`, hoặc chỉ có nháy một đầu (`"12`, `12"`), không phải trường hỏng: đọc như cũ (chuỗi thô), không cảnh báo.

H1. **Đọc**: trường hỏng đọc ra là **chuỗi thô, giữ nguyên cả hai nháy ngoài** (`""12""` đọc ra đúng 4 ký tự `""12""`; không bỏ nháy, không đoán lại). Mọi trường khác của việc đọc bình thường. Hệ quả cho `issue`: `""12""` không phải số nguyên dương nên không có link issue (INV-001 giữ).
H2. **Không sập**: `task.py list|summary|summary --json`, `export_dashboard.py`, `gate.py <T>` chạy xong với mã thoát như board lành (gate vẫn có thể thoát 2 vì việc thiếu eval, nhưng không Traceback). Việc có trường hỏng vẫn được đếm và xuất như các việc khác (`tasks.json` chứa nó, title thô).
H3. **Cảnh báo**: mỗi (file, trường) hỏng được cảnh báo **một dòng trên stderr** mỗi tiến trình, đúng dạng `Cảnh báo: board/T-xxx.md · trường <tên>: nháy kép hỏng, đọc như chuỗi thô`. Không in gì lên stdout (stdout của `--json` và exporter phải còn là JSON hợp lệ). Board lành không sinh dòng `Cảnh báo` nào.
H4. **summary**: `task.py summary` in thêm mục `Board hỏng:` ngay sau mục `Cảnh báo`, mỗi file một dòng `  - T-xxx (board/T-xxx.md): <trường1>, <trường2>` (theo thứ tự xuất hiện trong file); `summary --json` có khoá `board_hong`: danh sách `{"task","file","fields":[...]}` (rỗng `[]` khi lành; không in mục `Board hỏng` khi rỗng). summary vẫn thoát 0. Việc hỏng vẫn tính trong `counts`.
H5. **Lệnh đổi trạng thái** (handoff, accept, reject, cost, …) **được chạy** trên việc có trường hỏng, không chặn. Ghi lại (`write_task`) giữ **giá trị** trường hỏng: đọc lại sau lệnh vẫn đúng chuỗi thô cũ (file có thể được ghi dạng JSON hợp lệ `"\"\"12\"\""`, và khi đó cảnh báo/mục `Board hỏng` có thể biến mất; spec không yêu cầu cũng không cấm). Lệnh không đổi trường nào ngoài những trường nó vốn phải đổi.
H6. **Giá trị hợp lệ đọc như cũ**: chuỗi JSON đúng (kể cả `""`, có `\"`, có `:` `#`), danh sách `eval` dạng `[...]`, giá trị không nháy; kết quả giống từng byte trước khi sửa.

## Ràng buộc
- Repo: `tohong-hq` · Vùng: `hq/ledger` · chỉ sửa `read_task` (và nơi tổng hợp cho summary); không sửa tay board thật.
- Bất biến đã đọc: `eval/invariants/_shared/`, `hq/ledger/` INV-001..005, `hq/dashboard/` INV-001..013. Không vi phạm; INV-001 và dashboard INV-005 (export không sập vì area sửa tay) được mở rộng tinh thần, không mâu thuẫn.
- Không chạm: payment, auth, DB, dữ liệu người dùng. Bậc **A**: tiêu chí đều có eval tự động, chỉ sổ cái nội bộ.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | H1+H2+H3: nháy hỏng không làm list/summary/export/gate sập; trường đọc thô; stderr nêu file + trường; việc lành không bị cảnh báo | `python3 eval/T-087/check_1_khong_sap.py` |
| 2 | H6: giá trị hợp lệ (chuỗi JSON, `""`, `\"`, danh sách eval, không nháy) đọc như cũ, không cảnh báo | `python3 eval/T-087/check_2_hop_le_nhu_cu.py` |
| 3 | H4: summary (text + json) báo file board có trường hỏng; board lành thì không | `python3 eval/T-087/check_3_summary_bao_hong.py` |
| 4 | Bất biến `_shared`, hq/ledger, hq/dashboard xanh (bỏ qua file shell thiếu D3 trong môi trường; Code Gate tầng 2 chạy đủ) | `python3 eval/T-087/check_4_bat_bien.py` |
| 5 | H5: handoff/cost chạy được trên việc có trường hỏng; giá trị trường hỏng và các trường khác không đổi ngoài ý lệnh | `python3 eval/T-087/check_5_lenh_doi_trang_thai.py` |

Mỗi eval chạy trên sổ cái tạm (`TOHONG_ROOT`), không đụng board thật. Tiêu chí 5 là làm rõ tiêu chí 1 (Capu hỏi "ghi lại có làm hỏng thêm không"); Capu nêu 4 tiêu chí, đây là tiêu chí thứ 5 do Spec Writer thêm.

## Bất biến đề xuất (tầng 2, hq/ledger)
INV mới: mọi `board/T-*.md` thật đọc được bằng `read_task` không ném lỗi, và một board tạm có nháy hỏng cũng không làm nó ném. Bản nháp chạy được: `eval/T-087/proposed-inv-board-doc-duoc.py` (đỏ hôm nay vì board tạm hỏng; spec-critic rút vào bể khi spec qua).

## Không làm
- Không sửa tay hay "chữa" file board; không tự bỏ nháy ngoài của trường hỏng.
- Không xử lý trường số (`rounds`, `version`, `spec_returns`, `evals_added`, `cost`) có giá trị không phải số: `int()`/`float()` vẫn ném. Cùng lớp lỗi nhưng khác nguyên nhân.
- Không đổi `FIELDS`, format ghi của giá trị hợp lệ, hay INV-001.

## Câu hỏi mở
Có mở rộng sang trường số hỏng (`rounds: abc`) trong cùng việc này, hay tách việc mới? (Spec mặc định: tách.)
