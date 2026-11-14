---
type: decision
id: ADR-092
date: 2026-11-14
decided_by: chief-of-staff
tasks: [T-159, T-161]
---
# T-161 đã merge (tohong-back#57); thăng ba bất biến vào planner/vendor/images

tohong-back#57 merge vào main lúc 55db656; deploy Cloudflare Workers run 43573844330 thành công.

Thăng vào `eval/invariants/planner/vendor/images/` (đã chạy xanh trên main, kiểm bằng `env -i` từ /tmp):
- inv-042 map hạng mục ↔ category vendor một-một (từ `eval/T-159/bat-bien-cho-merge/`);
- inv-043 phân bổ hạng mục là nguồn ngân sách cho chat và tab (cùng nguồn);
- inv-044 câu AI không sinh lại khi mở/xem hạng mục không đổi ngân sách hiệu lực (từ T-161 adv-01). Chỉ sửa đường import helper: tìm gốc HQ bằng cách đi lên tới `scripts/gate.py` (ADR-070); hành vi kiểm giữ nguyên. Helper vẫn ở `eval/T-159/_lib.mjs`.
