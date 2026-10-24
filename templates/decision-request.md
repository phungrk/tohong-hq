---
type: decision-request
task: T-xxx
from: chief-of-staff
to: capu
decide-by: YYYY-MM-DD
reversible: no
---
Cần quyết: <một câu hỏi>
Phương án A: ... → hệ quả
Phương án B: ... → hệ quả
Khuyến nghị: <A hay B, lý do một câu>
Nếu không quyết: <chuyện gì xảy ra>

<!-- Lưu ở inbox/capu/T-xxx-<tên-ngắn>.md, kèm lệnh:
python3 scripts/task.py escalate T-xxx --by chief-of-staff --note "<câu hỏi>" --link inbox/capu/T-xxx-...md
Khi Capu trả lời:
python3 scripts/task.py decide T-xxx --note "<quyết định>"      # làm tiếp
python3 scripts/task.py decide T-xxx --note "<quyết định>" --close   # đóng việc
rồi ghi quyết định vào decisions/D-xxx-<tên>.md -->
