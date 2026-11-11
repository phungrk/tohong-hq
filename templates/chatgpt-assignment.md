---
task: T-xxx
type: review-pr            # review-spec | review-pr | engineering
priority: P1               # P0 | P1 | P2
status: open               # open | done — chỉ Chief of Staff đổi
assigned: 2026-11-11
due: 2026-11-13            # bậc B: trong cửa sổ 48 giờ; quá hạn thì cổng không chờ
source:
  - <link PR / đường dẫn spec / board/T-xxx.md>
---

# Giao ChatGPT: <tên ngắn>

**Việc:** <một câu: cần làm gì>

**Đọc:** <spec, handoff có Diff hành vi, eval, bất biến của vùng>

**Tiêu chí hoàn thành:**
- <...>

**Đầu ra mong đợi:** <comment `[ChatGPT review]` trên PR | file `reviews/T-xxx-chatgpt.md` trên nhánh `agents/chatgpt/T-xxx-review` | PR từ nhánh `agents/chatgpt/T-xxx-<ngắn>`>

**Giới hạn:** không sửa sổ cái, `main`, eval, bất biến; không merge. <giới hạn riêng của việc>

**Kết quả (Chief of Staff ghi khi đóng):** <đúng / sai / trùng adversary cho từng phát hiện>
