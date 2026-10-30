---
type: brief
task: T-xxx
from: chief-of-staff
to: product
deadline: YYYY-MM-DD
budget: "$2"
reviewer: reviewer
escalation: tu-lam   # tu-lam | bao-sau | hoi-truoc
---
Mục tiêu: <một câu, kết quả mong muốn>
Bối cảnh: <vì sao làm, Capu đã nói gì>
Bậc lưới lọc: B   # A tự merge | B Chief of Staff merge | C Capu duyệt
Tiêu chí chấp nhận:
  1. <kiểm được bằng có/không>
  2. ...
Eval (bắt buộc với engineering):
  - <lệnh hoặc file chạy được, một eval cho mỗi tiêu chí>
Không làm: <ranh giới phạm vi>

<!-- Trong thực tế, brief được tạo bằng:
python3 scripts/task.py new --title "..." --to product --goal "..." --context "..." \
  --criteria "..." --criteria "..." --eval "..." --tier B --out-of-scope "..." --deadline YYYY-MM-DD
Lệnh này ghi brief vào board/T-xxx.md. -->
