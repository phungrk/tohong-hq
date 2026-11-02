# Bất biến (eval tầng 2)

Bể chia theo **cây sản phẩm** (ADR-011): `_shared/` (luật cả công ty) → `<sản phẩm>/` → `<sản phẩm>/<vùng>/…`. Sản phẩm hiện có: `planner/` (wedding planner cho cặp đôi) và `hq/` (dashboard, công cụ quản lý). Ví dụ vùng: `planner/front/budget`, `planner/back/matching`, `hq/dashboard/model`.
Mỗi file là một bất biến: tính chất phải đúng mãi trong vùng đó, viết thành eval chạy được (`.py` hoặc `.sh`, mã thoát 0 = đạt), tên `inv-<nnn>-<tên-ngắn>`.
Đầu file ghi: nguồn (spec `T-xxx` đã qua Spec Gate, eval đối kháng `T-xxx/adv-nn`, hay sự cố ngày nào), và một câu nói bất biến là gì.

`scripts/gate.py T-xxx` tự chạy `_shared/` và **mọi cấp cha** của vùng việc chạm (`planner/front/budget` → `_shared`, `planner`, `planner/front`, `planner/front/budget`). Bất biến càng gần gốc càng phải tổng quát; đặt sai cấp thì gây nhiễu cho sản phẩm khác. Chỉ file `inv-*` được chạy; `lib/` để helper. Bất biến đỏ nghĩa là **spec** của việc mâu thuẫn với vùng, không phải code sai: `reject --kind spec`.

Ai được thêm: `spec-critic` (từ spec qua cổng), `adversary` (từ eval đối kháng tổng quát), `insight` (từ sự cố). Sửa hoặc xoá: qua Chief of Staff, ghi `decisions/`.
