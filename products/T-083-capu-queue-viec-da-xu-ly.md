# Spec T-083: Danh sách chờ Capu không giữ việc đã merge hay Decision Request đã quyết

## Ý định
Capu cần danh sách "việc chờ anh" (`capu_queue`, spec T-076) chỉ chứa cái anh còn phải làm. Việc `board/T-083.md`, bậc B, vùng `hq/ledger`. Sửa hai chỗ sổ cái hở, xảy ra thật 2026-11-06.

## Bằng chứng
- Ca 1: T-082 (bậc C, done) merge qua `phungrk/tohong-hq#26`; sự kiện E-0633 `merged` có `link` đúng URL đó. `handoffs/T-082-v1..v3.md` và các sự kiện `handoff` không chứa URL PR nào (PR do workflow sync tự mở), nên `task.collect_prs` trả rỗng cho T-082, `export_dashboard.build_capu_queue` rơi vào luật 48 giờ (D4 của T-076, cập nhật < 48h) và vẫn xếp T-082 là `merge-c`. Nguyên nhân: `processed` (tập URL đã merged) chỉ được dùng để trừ khỏi `collect_prs`; PR nằm ngoài `collect_prs` thì không được nhìn thấy. Đọc `scripts/export_dashboard.py` dòng 48-124.
- Ca 2: `task.py decide` (`cmd_decide`, scripts/task.py) chỉ cho việc `escalated`; T-070 (done) có Decision Request, Capu đã quyết, không ghi được `decided`. Chief of Staff tạm chuyển file sang `inbox/capu/da-quyet/`. Bước xuất quét `inbox/capu/T-*.md` không đệ quy nên thư mục con đang vô tình "chạy được", nhưng đó là quy ước ngoài sổ cái, không có sự kiện nào.
- `scripts/ok_issue.py` (ADR-027, T-082) gọi `task.py decide` và tự từ chối việc không `escalated` (`not_escalated`).
- Tự tin ~85% đúng ý Capu (đây là lỗi nhất quán với D3/D5 của T-076, không đổi ý định).

## Giả thuyết
Nếu mọi cách "đã xử lý" đều đến từ một sự kiện sổ cái (`merged`, `decided`) thì Capu không còn thấy việc đã xong và Chief of Staff không phải chuyển file tay. Chỉ số bảo vệ: INV-008 (hq/dashboard) và 8 bất biến nêu ở tiêu chí 4 vẫn xanh.

## Hành vi (người dùng thấy gì)
Kế thừa nguyên văn quy ước và D1-D5 của `products/T-076-modal-viec-cho-capu.md` (thứ tự sự kiện = thứ tự dòng, NFC, loại hiển thị, `decide_by`); chỉ các điểm sau đổi.

**M1. PR của một việc** (thay D3, thêm nguồn): = các URL PR (`https://github.com/phungrk/<repo>/pull/<n>`) của D3 (handoff từ engineering và `handoffs/<task>-v*.md`) **cộng** mọi `link` của sự kiện `merged` có `task` = việc đó và `link` khớp mẫu URL PR trên (sự kiện `merged` với `link` rỗng hay không phải URL PR bị bỏ qua). Bỏ trùng. PR **đã xử lý** khi có sự kiện `merged` (detail `merged` hoặc `closed`) với `link` đúng URL đó, thuộc việc nào cũng được (giữ như hôm nay).
**M2. Loại (iv)** (thay D4): việc B/C `done` của engineering vào (iv) khi có ít nhất một PR (M1) chưa xử lý. Luật 48 giờ chỉ áp khi tập PR (M1) **rỗng**. Hệ quả: (a) T-082 (PR duy nhất ngoài handoff, đã `merged`) ra ngay, không phụ thuộc tuổi; (b) PR ngoài handoff đã `merged` **không che** PR trong handoff còn mở: việc vẫn vào, `links` chỉ gồm PR chưa xử lý; (c) việc không PR và không `merged` vẫn theo 48 giờ.
**M3. `task.py decide` cho việc `done` và `blocked`** (thay cmd_decide chỉ-escalated): với việc ở `done` hoặc `blocked`, `decide <T> --note <n> [--link <url>]` ghi **một** sự kiện `decided` (`from` = `capu`, `detail` = note, `link` = link nếu có), **chỉ ghi sự kiện, không chạm file board** (như `cmd_merged`, `log_event(..., with_state=False)`): state/holder/owner/tier/rounds/version/prev_state và **`updated`** đều không đổi, và **không thêm dòng lịch sử** vào board (đã chọn: không thêm). Lý do: luật 48 giờ (M2c) và cảnh báo đứng yên đọc `updated`; quyết định DR không được làm việc `done` không PR vào lại hàng. File `board/<T>.md` giống hệt từng byte trước và sau lệnh. Không idempotent: mỗi lệnh là một quyết định, ghi thêm sự kiện. Từ chối (thoát khác 0, không ghi gì): thiếu `--note`; `--close` trên việc `done`/`blocked` (không có gì để đóng; việc `blocked` muốn đóng thì Capu quyết xong, người giữ việc dùng lệnh riêng); việc ở trạng thái khác `escalated`/`done`/`blocked`; việc không tồn tại. Việc `escalated`: hành vi hiện tại giữ nguyên (`--close` -> done, không `--close` -> doing). `decide` **không** gỡ chặn việc `blocked`; gỡ chặn vẫn là `task.py unblock`.
**M4. Đã trả lời** (thay một câu trong (i) và (iii) của T-076): quy tắc "đã trả lời" của (i) giữ nguyên (sự kiện `decided`/`unblocked` đứng sau sự kiện hỏi Capu cuối cùng; việc chưa hỏi thì chỉ `decided`). Thêm: nếu việc `blocked` thoả (iii) mà **đã trả lời** theo quy tắc đó thì (iii) **không** tính (việc không còn loại `blocked`). Hỏi lại (sự kiện `escalated` hay `blocked` "Chờ Capu" mới, đứng sau) thì vào lại. Việc đã trả lời DR nhưng còn PR chưa xử lý: ra khỏi `decision`, còn `diff-b`/`merge-c`, `links` chỉ gồm PR (không còn link Decision Request).
**M5. Thư mục `inbox/capu/da-quyet/` bỏ.** Quy ước "chuyển DR đã quyết sang `da-quyet/`" không còn; trạng thái DR chỉ đến từ sổ cái (M4). File DR đã quyết **ở nguyên** `inbox/capu/` (như T-015). Bước xuất chỉ đọc file ngay dưới `inbox/capu/`, không đệ quy: file trong thư mục con không được quét, không tạo dòng, không thành link, không đọc `decide-by`. Backfill một lần: chuyển `inbox/capu/da-quyet/T-070-nguon-anh-vendor-thay-the.md` về `inbox/capu/`, xoá thư mục `da-quyet/` rỗng, và ghi quyết định Capu bằng đúng lệnh `task.py decide T-070 --note "Capu chọn A: chạy mirror với wayback trước, đọc SUMMARY rồi quyết tiếp"` (nguyên văn, giữ dấu; Capu nói trong chat 2026-11-06; Engineering không đổi chữ). Chạy đúng một lần.
**M6. `/ok` (ADR-027, `scripts/ok_issue.py`): chỉ nêu, không đổi.** `/ok` dùng cùng đường `task.py decide`, nên bất kỳ việc nào sau này mở cho `/ok` ở `done`/`blocked` chỉ cần bỏ kiểm `not_escalated` ở `ok_issue.py`. T-083 **không** làm việc đó (đổi workflow/quyền là bậc C, ngoài phạm vi); `/ok` vẫn chỉ nhận `escalated`, `adv-*` của T-082 không đổi.

## Ràng buộc (vòi)
- Repo `phungrk/tohong-hq`: `scripts/task.py` (`cmd_decide`; `collect_prs` giữ chữ ký), `scripts/export_dashboard.py` (`build_capu_queue`), backfill M5. Không chạm `ok_issue.py`, workflow, dashboard (`tohong-hq-dashboard`; `capu_queue` giữ đúng khuôn D1, chỉ đổi tập phần tử).
- `scripts/task.py` là file ngoài sổ cái nên workflow sync mở PR cho Capu duyệt. Bậc B giữ nguyên; `decide` ghi sự kiện `decided` thay quyết định của Capu nên nhắc `adversary` soi: chỉ `from: capu`, không đoán note.
- Bất biến đã đọc: `_shared/` INV-001/002; `hq/inv-001` (merged không đổi trạng thái); `hq/ledger` INV-001..004 (INV-002/003: `decided` có link `#issuecomment-` phải hợp lệ; `decided` không link không bị ràng buộc, M3 không mâu thuẫn); `hq/dashboard` INV-001..009. Không bất biến nào cấm M1-M5. INV-008 cũ đo trên "link PR trong capu_queue" và "decision đã trả lời": vẫn đúng; M2/M4 chỉ làm hẹp tập. Không đổi bất biến nào.
- Không chạm: payment, auth, DB, dữ liệu người dùng.

## Tiêu chí chấp nhận và eval
Chạy từ `cd /home/user/tohong-hq`; eval tự dựng sổ cái tạm (`TOHONG_ROOT`) và `TOHONG_NOW` cố định (dùng lại `eval/T-076/_export_lib.py`), trừ eval 4 đọc sổ cái thật nhưng chỉ kiểm sự kiện/tệp, không theo thời điểm.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Việc B/C done có sự kiện `merged` cho mọi PR đã biết (kể cả PR không có trong handoff, cập nhật < 48h) không vào `capu_queue`; PR ngoài handoff không che PR còn mở; luật 48h cho việc không PR giữ nguyên | `python3 eval/T-083/check_1_viec_da_merged_khong_cho_capu.py` |
| 2 | `decide` việc done/blocked ghi `decided` (from capu, note, link), không đổi file board kể cả `updated`; việc done không PR cũ 50 giờ có DR ra khỏi hàng sau quyết; từ chối ca sai; escalated không hồi quy; DR rời `capu_queue` (cả `decision` lẫn `blocked`), việc còn PR chỉ còn dòng PR; hỏi lại thì vào lại | `python3 eval/T-083/check_2_decide_viec_done_blocked.py` |
| 3 | `inbox/capu/da-quyet/` không được quét và không còn trong sổ cái thật, DR đã quyết ở nguyên `inbox/capu/` vẫn không vào hàng, không còn tham chiếu `da-quyet` trong scripts/templates/handbook/.claude/CLAUDE.md | `python3 eval/T-083/check_3_da_quyet_khong_quet.py` |
| 4 | Ca thật: sổ cái có đúng một `decided` của capu cho T-070 với note nguyên văn, xuất thật không chứa T-082 và T-070 | `python3 eval/T-083/check_4_ca_that.py` |
| 5 | INV-006..009 `hq/dashboard`, INV-001..004 `hq/ledger` xanh (cần `D3=/đường/dẫn/d3.min.js` cho INV-006/007/009) | `python3 eval/T-083/check_5_bat_bien_xanh.py` |

Brief gốc tiêu chí 3 ("`da-quyet/` không được quét") là eval 3; tiêu chí 1 và 2 tách thành eval 1 và 2; tiêu chí 4 là eval 5. Eval 4 là ca thật, bổ sung. Hôm nay (trước khi làm): eval 1, 2, 3, 4 đỏ, eval 5 xanh khi có D3.

## Bất biến đề xuất (tầng 2)
- **INV-P7 (hq/dashboard):** việc B/C `done` mà mọi PR (handoff, `handoffs/`, và `link` của sự kiện `merged` của chính việc) đã có `merged` không có trong `capu_queue`, bất kể tuổi. Mở rộng INV-008 (a). Gốc: eval 1, 4.
- **INV-P8 (hq/ledger):** `task.py decide` trên việc `done`/`blocked` không bao giờ đổi state/holder/owner/tier/rounds/version/prev_state, và từ chối khi thiếu `--note`. Gốc: eval 2. Gần INV-P4 của T-076 (`hq/inv-001`).
- **INV-P9 (hq/dashboard):** `capu_queue` không phụ thuộc thư mục con của `inbox/capu/` và Decision Request đã `decided` sau lần hỏi cuối không còn dòng, dù file nằm ở đâu trong `inbox/capu/`. Gốc: eval 3.

## Không làm
- Sửa `ok_issue.py`, workflow, quyền `/ok`; mở `/ok` cho việc done/blocked (M6).
- Tự gỡ chặn việc `blocked` khi Capu quyết; thêm lệnh `unblock` mới.
- Gọi GitHub/mạng; tự suy ra PR merged từ workflow sync; đổi khuôn `capu_queue` hay dashboard.
- Chạm bất biến hiện có (chỉ đề xuất INV-P7..P9 thêm).

## Câu hỏi mở
Không.

## Lịch sử sửa
### Vòng 1 (D1)
- M3 bỏ sót `updated`/lịch sử board nên ba cách cài cho `capu_queue` khác nhau (việc done không PR >48h vào lại hàng sau khi Capu quyết). Sửa: chọn cách chỉ ghi sự kiện, không chạm board; eval 2 thêm ca 50 giờ và so board từng byte.
- M5 để trống note T-070. Sửa: ghi nguyên văn; eval 4 so đúng (NFC); bỏ câu hỏi mở.
