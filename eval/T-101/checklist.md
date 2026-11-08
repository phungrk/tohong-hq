# T-101 tiêu chí 7: thử thật trong phiên cloud (MANUAL, vì cần phiên Claude Code thật và Capu duyệt; không dựng được trong máy)

Làm theo thứ tự. Mỗi dòng trả lời có/không.

## A. Đặt hook (chỉ sau khi PR của Engineering được Capu duyệt)
- [ ] Người chạy `python3 scripts/cost.py install-hook` là Capu, hoặc Chief of Staff sau khi Capu duyệt rõ (ghi dẫn chứng: tin nhắn hoặc `inbox/capu/`). Không agent nào khác chạy. Trả lời: có/không.
- [ ] Sau lệnh, `$HOME/.claude/settings.json` có đúng một hook `cost.py hook` cho mỗi `SubagentStop`, `Stop`, `SessionEnd`, trỏ `scripts/cost.py` của repo; khoá `permissions` (nếu có trước đó) không đổi; `/root/.claude/launcher-settings.json` không đổi (so `ls -l --time-style=full-iso`).
- [ ] **Giới hạn môi trường:** mở một phiên cloud MỚI rồi `grep -c cost.py $HOME/.claude/settings.json`. Số > 0: môi trường giữ file. Bằng 0: file không được giữ; Capu gắn `python3 /home/user/tohong-hq/scripts/cost.py install-hook` vào setup script của môi trường (ngoài repo; không agent nào tự làm) rồi mở lại phiên và kiểm lại.

## B. Thử một subagent (phiên mở tại `/home/user`, không phải tohong-hq)
- [ ] Chạy `grep -c '"event": "cost"' ledger/events.jsonl`, ghi số N. Gọi một subagent bất kỳ (vd `insight`) giao việc có mã T-101, đợi nó xong. Chạy lại lệnh: số là N+1 (không N, không N+2). Sự kiện mới nhất có `from` là tên subagent và `src.agent` là agent_id của nó.
- [ ] Kết thúc lượt chính (Stop). Số sự kiện tăng đúng 1 (`src.agent` = "main"), không thêm sự kiện cho subagent đã ghi ở bước trước.
- [ ] `python3 scripts/cost.py backfill <mã phiên này> --dry-run` in `PENDING msgs=0 usd=0.0000` và thoát 0.

## C. Backfill thật cho phiên 86243faa-8dbf-5631-b32b-051ad4d92b1e (khoảng $828): bước "Hỏi trước" riêng, KHÔNG đi theo merge
Một người duy nhất chạy (Chief of Staff); không phiên nào khác chạy backfill cho mã này.
- [ ] 1. `git fetch origin main && git rebase origin/main` thành công, rồi mới làm tiếp. Trả lời: có/không.
- [ ] 2. `python3 scripts/cost.py backfill 86243faa-8dbf-5631-b32b-051ad4d92b1e --dry-run` in `PENDING msgs=<n> usd=<x.xxxx>` thoát 1. `x` nằm trong khoảng $780-$880; nếu ngoài khoảng, dừng và báo (có thể rebase đã mang theo một lần backfill, hoặc chọn nhầm transcript). Ghi n và x vào Decision Request (`inbox/capu/`).
- [ ] 3. Capu duyệt đúng số x (có tin nhắn hoặc `task.py decide`). Chưa duyệt thì dừng ở đây.
- [ ] 4. Không dùng `--final` (phiên chính còn có thể đang chạy). Chạy `python3 scripts/cost.py backfill 86243faa-8dbf-5631-b32b-051ad4d92b1e --expect-usd <x>`; thoát 0. Thoát 5 nghĩa là số đã đổi (ai đó đã ghi): dừng, không thử lại với số khác.
- [ ] 5. Ngay sau đó chạy chuỗi lệnh git của CLAUDE.md (commit, fetch, rebase, push) để sổ cái lên nhánh claude/... và vào `main`.
- [ ] 6. `... backfill 86243faa-8dbf-5631-b32b-051ad4d92b1e --dry-run` in `PENDING msgs=0 usd=0.0000`, thoát 0.
- [ ] 7. Kiểm không chồng khoảng: với mỗi `src.agent` của phiên này, các sự kiện cost xếp theo thứ tự ghi có `src.msgs` tăng chặt. Cách kiểm: mở `ledger/events.jsonl`, lọc `src.session` = 86243faa..., mỗi agent_id xuất hiện với msgs tăng dần, không lặp.
