---
type: handoff
task: T-061
from: product
to: spec-critic
version: 3
fixes: []
confidence: high
sources: [eval/T-061/check_skel.cjs, eval/invariants/planner/front/loading/lib/loading_inv.cjs]
cost: "$0.00"
reversible: yes
---
Sửa lỗi đo sau Spec Gate v3 (việc đã `done`, không respec; spec không đổi).
Đã sửa trong `eval/T-061/check_skel.cjs`:
  - `visibleHits` (TC1, TC2, TC3, TC5) và phép quét chữ giả trong TC6 giờ tính độ mờ hiệu dụng = tích `opacity` của mọi tổ tiên (như inv-001 `loading_inv.cjs`), và bỏ qua phần tử nằm hoàn toàn ngoài khung nhìn. Trước đây chỉ xét opacity của chính phần tử nên tiêu đề sheet "Thêm việc" đã đóng (vẫn mount, top 889 ngoài khung 844) bị tính là chữ nhìn thấy: TC1, TC5, TC6 ở Kế hoạch đỏ giả. Không nới ngưỡng nào khác (vẫn rộng/cao > 8px, display/visibility).
  - Chú thích TC6 đổi thành "100-300ms kể từ yêu cầu /api/me đầu và trước khi /api/me về".
Kiểm hai chiều (cwd /home/user/tohong-hq):
  - `proto2`: TC1 và TC6 xanh toàn bộ, gồm Kế hoạch (14 dòng Kế hoạch trong TC1/5/6 đã xem; 0 dòng đỏ ở TC1/TC6). Dòng "không hiện trạng thái rỗng giả khi lỗi" của Kế hoạch (TC5) xanh. TC5 còn đỏ ở các dòng thông báo lỗi/Thử lại vì proto2 chưa làm giao diện lỗi (tính năng của spec, không phải lỗi eval).
  - Ca âm: `proto3` = proto2 + chữ "Chưa có khách mời" nhìn thấy trong skeleton Khách mời: TC1 đỏ ("Chưa có khách mời") và TC6 đỏ cùng chữ đó.
  - Main 218e623: TC1, 5, 6 vẫn đỏ đúng lý do (không có skeleton).
  - `node --check` qua. Bản thử nằm trong scratchpad, không có file rác ở gốc repo.
Kết quả nằm ở: eval/T-061/check_skel.cjs
