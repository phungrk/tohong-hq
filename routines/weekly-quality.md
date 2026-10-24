# Routine: Báo cáo chất lượng tuần

**Lịch:** 17:00 thứ Sáu, giờ Asia/Saigon
**Repo:** tohong-hq

## Prompt (dán vào Routine)

Gọi subagent `reviewer` để viết báo cáo chất lượng hằng tuần theo mục "Báo cáo chất lượng hằng tuần" trong `.claude/agents/reviewer.md`.
Sau đó `git add -A && git commit -m "[quality] <YYYY-MM-DD>"` rồi `git fetch origin main && git rebase origin/main && git push origin HEAD:main`.
Tin nhắn cuối cùng là nguyên văn báo cáo của Reviewer, không chỉnh sửa, không tóm tắt.
