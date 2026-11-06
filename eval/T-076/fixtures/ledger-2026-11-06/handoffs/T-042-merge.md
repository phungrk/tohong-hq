---
type: status
task: T-042
from: chief-of-staff
to: capu
---
T-042 qua Code Gate (adversary accept lần 2, gate GREEN 46/46: 6 eval hành vi + 2 đối kháng, 38 bất biến gồm _shared 2, hq/dashboard 5, hq/dashboard/model 31; 13 nhóm input đối kháng đã thử, 2 phá được và đã sửa). Bậc A → Chief of Staff đã merge phungrk/tohong-hq-dashboard#15 (squash dfe8a20). Bộ lọc sản phẩm chỉ đọc trường `product` từ dashboard.json, nên hiện đủ hiệu lực khi `scripts/export_dashboard.py` (nhánh claude/area-tree, review PR chờ anh duyệt) vào main và dashboard.json xuất lại; trước đó bộ chọn hiện nhưng mọi việc chỉ ở "Tất cả".
