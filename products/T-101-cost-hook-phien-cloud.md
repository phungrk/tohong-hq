# Spec T-101: Chi phí token được ghi đủ ở phiên cloud (hook cost.py không phụ thuộc thư mục mở phiên)

## Ý định
Capu cần số chi phí thật đầy đủ để đo thử Graphify (T-102): mọi lượt agent trong phiên cloud, kể cả khi phiên không mở ở tohong-hq, phải thành sự kiện `cost` trong ledger.

## Bằng chứng
- Sự kiện cost cuối của phiên `86243faa-8dbf-5631-b32b-051ad4d92b1e` là E-0090 (2026-10-25T18:55, bù tay bằng `sync`). Sự kiện cost cuối của cả sổ cái là E-0663 (2026-11-07T04:57), thuộc phiên khác `ec1ccb69` (hook chạy được ở đó). `ledger/events.jsonl`.
- `/root/.claude/sessions/94.json`: phiên đang chạy khởi động với `"cwd":"/home/user"`; dòng đầu transcript cũng `cwd=/home/user`. `/home/user/.claude/` không tồn tại, nên Claude Code không có `settings.json` dự án nào để nạp cho phiên này.
- Transcript phiên chính có 672 dòng `stop_hook_summary`. Kể cả 558+47 lần khi cwd đã chuyển vào `tohong-hq`, số hook chạy ở Stop chỉ là 1 (hook `git-check` của người dùng, lỗi trả về là chữ của `stop-hook-git-check.sh`) hoặc 2 (git-check + một prompt hook "em hãy tự quyết định…", ngày 28-29/10). Không một lần nào có hook thứ hai là `cost.py`. Tái hiện: `python3 eval/T-101/tim_nguyen_nhan.py`. Cwd đổi giữa phiên không nạp lại settings.
- Transcript còn nguyên: 238 file subagent + phiên chính. Chạy thử đọc-không-ghi bằng `cost.py` (con trỏ hiện có): phiên chính còn 2012 tin chưa ghi (~$384.5), 219 subagent chưa ghi (~$443.3), 0 lỗi con trỏ. Tức khoảng $828 theo bảng giá hiện hành chưa vào sổ cái.
- Kết luận: phỏng đoán của Capu **đúng**. Hook khai báo ở `tohong-hq/.claude/settings.json` chỉ có hiệu lực với phiên mở ở tohong-hq; `$CLAUDE_PROJECT_DIR` cũng là thư mục mở phiên (`/home/user`), nên dù có nạp thì `$CLAUDE_PROJECT_DIR/scripts/cost.py` cũng không tồn tại. Tự tin ~90%. Phần 10% còn lại: không thể xem trực tiếp bộ nạp hook của Claude Code; đây là suy ra từ số hook ở `stop_hook_summary` và từ cwd khởi động. Bản thân `cost.py` **không có lỗi**: chạy từ cwd lạ với `TOHONG_ROOT` ghi đúng (xem check_2, check_3, check_4 xanh trên code hiện tại).

## Giả thuyết
Nếu hook cost.py được đăng ký ở cấp người dùng (cùng chỗ với git-check) bằng đường dẫn tuyệt đối thì sự kiện cost ghi đủ bất kể thư mục mở phiên. Nếu có thêm lệnh bù theo mã phiên thì phần đã mất lấy lại được. Chỉ số bảo vệ: không sự kiện cost nào bị đếm hai lần; hook không bao giờ in stdout hay chặn agent.

## Hành vi (người dùng thấy gì)
1. Khi Capu (hoặc môi trường cloud) chạy `python3 scripts/cost.py install-hook`, file `$HOME/.claude/settings.json` có đúng một hook `cost.py hook` cho mỗi sự kiện SubagentStop, Stop, SessionEnd. Lệnh dùng đường dẫn tuyệt đối tới `scripts/cost.py` của repo đang chạy lệnh, không dùng `$CLAUDE_PROJECT_DIR`. Khoá và hook có sẵn trong file giữ nguyên. Chạy lại lần nữa không đổi byte nào. `--settings FILE` ghi vào FILE thay cho mặc định. File không phải JSON hợp lệ: lệnh thoát khác 0, file giữ nguyên.
2. Khi hook SubagentStop chạy (cwd bất kỳ, không có `CLAUDE_PROJECT_DIR`), sổ cái có đúng một sự kiện `cost` mới cho subagent đó: `from` = `agent_type`, `task` = mã T-xxx đầu tiên trong lời giao việc, tiền theo `scripts/pricing.json`, `src` = {session, agent = agent_id, msgs, last}. Hook thoát 0 và không in gì ra stdout.
3. Khi hook Stop hoặc SessionEnd chạy, sổ cái nhận toàn bộ phần chưa ghi của phiên chính (`from` = chief-of-staff, `src.agent` = "main") và phần chưa ghi của mọi subagent trong thư mục subagents của phiên mà SubagentStop đã bỏ sót. Với subagent được quét sót, tin cuối chưa có `stop_reason` (đang ghi dở) chưa tính; khi nó xong, lần Stop sau ghi đúng phần tăng thêm. SessionEnd ngay sau Stop không thêm sự kiện nào.
4. Không đếm trùng: cùng một payload gửi hai lần, SubagentStop rồi Stop quét lại cùng subagent, hoặc nhiều hook chạy đồng thời (kể cả khi hook được đăng ký ở cả cấp dự án lẫn cấp người dùng) đều cho: mỗi cặp (session, agent) chỉ có các sự kiện với khoảng tin không chồng nhau, tổng tiền bằng tiền của transcript.
5. `python3 scripts/cost.py backfill <session> [--projects-dir DIR] [--final]` tìm transcript theo mã phiên ở `DIR/*/<session>.jsonl` (mặc định `$HOME/.claude/projects`, bất kể thư mục dự án mã hoá trong tên), ghi phần chưa ghi của phiên chính và mọi subagent theo con trỏ `src` hiện có (đã ghi một phần thì chỉ ghi phần còn lại), in số sự kiện đã ghi. Chạy lần hai: ghi 0 sự kiện. Mặc định tin cuối chưa có `stop_reason` không tính (kể cả phiên chính, vì phiên có thể đang chạy); `--final` tính cả tin đó. Mã phiên không có transcript: thoát 1, không ghi gì.
6. `backfill <session> --dry-run` không ghi gì vào sổ cái, in đúng một dòng `PENDING msgs=<n> usd=<x.xxxx>` (4 chữ số thập phân; tính theo cùng quy tắc tin cuối ở mục 5) và thoát 1 nếu `n` > 0, thoát 0 nếu `n` = 0. Dùng để phát hiện hook hỏng ngay thay vì sau một ngày.
7. Sau khi PR được duyệt và `install-hook` đã chạy trong môi trường cloud, một subagent chạy thử ở phiên mở tại `/home/user` sinh đúng một sự kiện cost (kiểm bằng checklist, vì cần phiên thật).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq` · Nhánh: `t-101-cost-hook` · Vùng: `hq/ledger`
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret, INV-002 số cái đọc được), `eval/invariants/hq/` (inv-001, inv-002), `eval/invariants/hq/ledger/` inv-001 … inv-007. Spec này không vi phạm; riêng inv-006/007 (đọc board thật): `backfill` ghi `task` rỗng khi mã T-xxx không có trong `board/` như `cost.py` hiện làm, không tạo board mới.
- Không chạm: bảng giá (`pricing.json`), dashboard, `.claude/settings.json` của dự án (hook dự án giữ nguyên làm lớp thứ hai; trùng với hook cấp người dùng được mục 4 xử lý). `install-hook` chỉ ghi file settings được chỉ định/mặc định, không đặt secret.
- Thực thi (Engineering): `scripts/cost.py` (thêm lệnh `install-hook`, `backfill`); thay đổi này chạm `scripts/`, đi qua PR "Cần Capu duyệt".
- Bậc lưới lọc: A theo Capu giao. Lưu ý Chief of Staff: việc chạy `install-hook` trong môi trường cloud sửa cấu hình người dùng ngoài repo; câu hỏi mở bên dưới.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | `install-hook` đăng ký đúng 3 hook tuyệt đối, giữ nguyên cấu hình có sẵn, idempotent, từ chối JSON hỏng; lệnh đã đăng ký chạy từ thư mục lạ ra đúng 1 sự kiện (mục 1) | `python3 eval/T-101/check_1_dang_ky_hook.py` |
| 2 | SubagentStop từ cwd lạ, không có CLAUDE_PROJECT_DIR → đúng 1 sự kiện đúng agent/task/tiền/src (mục 2) | `python3 eval/T-101/check_2_subagent_stop.py` |
| 3 | Stop/SessionEnd ghi phiên chính + quét subagent sót, xử lý tin dở, SessionEnd không thêm (mục 3) | `python3 eval/T-101/check_3_stop_quet_sot.py` |
| 4 | Không đếm trùng qua gửi lại, quét lại, chạy đồng thời (mục 4) | `python3 eval/T-101/check_4_khong_dem_trung.py` |
| 5 | `backfill <session>` bù đúng phần thiếu, idempotent, `--final`, phiên lạ thoát 1 (mục 5) | `python3 eval/T-101/check_5_backfill.py` |
| 6 | `backfill --dry-run` không ghi, in `PENDING`, mã thoát 1/0 (mục 6) | `python3 eval/T-101/check_6_phat_hien_thieu.py` |
| 7 | Thử thật: một subagent ở phiên mở tại /home/user sinh đúng 1 sự kiện (mục 7) | `eval/T-101/checklist.md` (cần phiên cloud thật, không dựng được trong máy) |

Mọi eval dựng sổ cái tạm qua `TOHONG_ROOT`, HOME giả, transcript giả; không đụng `ledger/` thật. Helper: `eval/T-101/lib.py`.

## Bất biến đề xuất (tầng 2)
Vùng `hq/ledger`: **"Hook chi phí độc lập thư mục mở phiên và idempotent."** Chạy `scripts/cost.py hook` với cwd ≠ repo, không có `CLAUDE_PROJECT_DIR`, hai lần cùng một payload SubagentStop cho đúng một sự kiện `cost`, `src` đủ khoá, stdout rỗng, thoát 0. Dạng gọn của check_2 + câu đầu của check_4; chạy trên sổ cái tạm, không đụng sổ cái thật. Lý do: lỗi này mất cả ngày dữ liệu mà không ai biết; bất biến chặn việc sửa `cost.py` sau này làm hook phụ thuộc cwd hoặc đếm trùng.

## Không làm
Đổi bảng giá; báo cáo chi phí mới trên dashboard; tự sửa `~/.claude/settings.json` hay `.claude/settings.json` trong lúc làm spec; chạy `backfill` thật trên phiên 86243faa trước khi Capu duyệt PR (tiền ghi vào sổ cái là số thật, khoảng $828; chạy sau duyệt, một lần, kiểm `--dry-run` trước); hook hay `backfill` tự tính lại phần đã ghi.

## Câu hỏi mở
Môi trường cloud có giữ `~/.claude/settings.json` qua các phiên không? Nếu không, `install-hook` phải nằm trong setup script của môi trường cloud (nằm ngoài repo, Capu đặt). Đây là chỗ duy nhất không có trong tầm tay repo: cần Capu xác nhận sẽ gắn `python3 /home/user/tohong-hq/scripts/cost.py install-hook` vào setup script (hoặc cho biết nơi khác). Trong lúc chờ, chạy `backfill --dry-run` ở đầu phiên là lưới an toàn.
