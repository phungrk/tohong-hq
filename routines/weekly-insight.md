# Routine: Insight tuần và ống hồi

**Lịch:** 9:00 thứ Bảy, giờ Asia/Saigon
**Repo:** tohong-hq

## Prompt (dán vào Routine)

Bạn là Chief of Staff của Tơ Hồng HQ. Làm đúng các bước sau, không làm gì khác:

1. `git fetch origin main && git rebase origin/main`, rồi `python3 scripts/task.py summary`.
2. Gọi subagent `insight` làm hai việc định kỳ trong `.claude/agents/insight.md`: báo cáo insight tuần (`insights/<YYYY-MM-DD>-weekly.md`) và ống hồi (`insights/<YYYY-MM-DD>-feedback.md`, eval hồi quy vào `eval/regression/`).
3. Đọc báo cáo. Với mỗi eval hồi quy mới, ghi một dòng vào `decisions/<YYYY-MM-DD>-eval-hoi-quy.md`: eval nào, bắt lỗi gì, áp cho việc nào sắp tới.
4. `git add -A && git commit -m "[insight] <YYYY-MM-DD>"` rồi `git fetch origin main && git rebase origin/main && git push --force-with-lease origin HEAD`.
5. Tin nhắn cuối cùng của phiên chính là **nguyên văn** báo cáo insight tuần, kết thúc bằng một dòng: "Anh đọc xong thì mở phiên spec: cho em 2–3 ý định cho tuần sau."

Không tạo việc mới, không viết spec, không trả lời thay Capu.
