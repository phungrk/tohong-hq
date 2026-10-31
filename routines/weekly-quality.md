# Routine: Báo cáo chất lượng tuần

**Lịch:** 17:00 thứ Sáu, giờ Asia/Saigon
**Repo:** tohong-hq

## Prompt (dán vào Routine)

Gọi subagent `adversary` để viết báo cáo chất lượng hằng tuần theo mục "Báo cáo chất lượng hằng tuần" trong `.claude/agents/adversary.md` (spec acceptance rate, số lần spec rework, eval pass rate, giờ từ giao tới chấp nhận, số quyết định của Capu, chi phí mỗi việc).
Sau đó `git add -A && git commit -m "[quality] <YYYY-MM-DD>"` rồi `git fetch origin main && git rebase origin/main && git push --force-with-lease origin HEAD`.
Tin nhắn cuối cùng là nguyên văn báo cáo của Adversary, không chỉnh sửa, không tóm tắt.
