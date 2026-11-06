---
type: decision-request
task: T-015
from: chief-of-staff
to: capu
decide-by: 2026-10-30
reversible: yes
---
Cần quyết: cho T-015 về lại Engineering như trước khi bị ghi nhầm?

Sự cố: lúc 2026-10-29T06:36 Chief of Staff (phiên claude/gallant-hopper-03rud0) tạo việc deploy admin, `task.py` cấp mã T-016, nhưng lệnh `start` và `escalate` sau đó gõ nhầm T-015. T-015 (Gắn đo giai đoạn 4–7, của phiên khác) bị chuyển `new → doing → escalated`, người giữ `capu`, kèm link Decision Request sai (đã đổi tên thành `inbox/capu/T-016-deploy-admin.md`). Sự kiện nhầm: E-0107, E-0108. T-015 không có thay đổi nội dung nào khác.

Phương án A: anh chạy `python3 scripts/task.py decide T-015 --note "Ghi nhầm E-0107/E-0108, trả về Engineering"` → T-015 về `doing`, người giữ `engineering`, đếm vòng giữ 0.
Phương án B: để nguyên → T-015 nằm ở "Chờ anh quyết", phiên đang làm T-015 bị chặn.
Khuyến nghị: A. Chief of Staff không tự chạy `decide` vì lệnh đó ghi tên anh (đúng lỗ hổng đã nêu ở T-004).
Nếu không quyết: T-015 đứng yên và hiện trong cảnh báo của dashboard.
