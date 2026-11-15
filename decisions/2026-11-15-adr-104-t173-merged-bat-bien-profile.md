---
type: decision
id: ADR-104
date: 2026-11-15
decided_by: capu
tasks: [T-169, T-173, T-174]
---
# T-173 merge theo lệnh Capu; bể planner/profile; Capu chọn A cho T-174

1. Capu: "merge 61 luôn". phungrk/tohong-back#61 (T-173, bậc C, adversary accept v3, gate GREEN 27/27, head c74c8c6 đúng bản accept, mergeable clean) merge 595c70b; deploy Cloudflare run 43694329656 thành công. Không di trú dữ liệu cũ (ADR-103).
2. Bể mới `eval/invariants/planner/profile/` (xanh trên main 595c70b, `env -i` từ /tmp):
   - inv-001 một thông tin một giá trị ở mọi bề mặt (từ eval/T-169/bat-bien-cho-merge, INV-A);
   - inv-002 ghi không mất, đọc không ghi (INV-B);
   - inv-003 rác không xoá giá trị đã lưu (từ eval/T-173/bat-bien-cho-merge, gộp adv-01/02/07).
3. T-174 (escalated, lần trả spec thứ 3 cho ý định T-171): Capu chọn A — khoản cặp đôi tự thêm/sửa/xoá khi chưa lưu được dự toán được giữ và ghi cùng (ghép theo id với bản server). Product bổ sung H5 + eval (từ probe của Spec Gate), không mở lại vòng Spec Gate cho câu đã được Capu quyết; Code Gate kiểm như thường.
4. back#62 (T-176) phải merge main vào nhánh (xung đột nhẹ api/vendors.js, package.json) trước khi merge.
