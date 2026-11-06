---
type: handoff
task: T-058
from: product
to: spec-critic
version: 3
fixes: []
confidence: high
sources: [eval/T-058/lib/t058.py]
cost: "$0.00"
reversible: yes
---
Đã làm: sửa một dòng trong `eval/T-058/lib/t058.py` (dòng 91, `Env.set_pool`): URL bắt đầu bằng `http` được dùng nguyên, đường dẫn tương đối mới bọc bằng `self.fk.url(p)`. Lý do: ca c2 của check_5 truyền `http://127.0.0.1:1/dead/N`, bị bọc nhầm nên pool nhận URL hỏng và ca không thể xanh. Spec không đổi, không respec.
Kiểm: check_5 trên tohong-back hiện tại đỏ đúng lý do, không ERROR.
Kết quả nằm ở: eval/T-058/lib/t058.py
