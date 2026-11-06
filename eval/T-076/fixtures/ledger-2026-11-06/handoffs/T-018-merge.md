---
type: handoff
task: T-018
from: chief-of-staff
to: capu
version: 2
fixes: []
confidence: medium
sources: [phungrk/tohong#58, phungrk/tohong-back#32, phungrk/tohong-front#52, phungrk/tohong#59]
cost: "$0.00"
reversible: yes
---
Capu duyệt merge trong phiên 2026-10-30 ("Merge đi").
- Merge: tohong#58 → tohong-back#32 (`21231fb`) → tohong-front#52 (`76ff7e6`) → tohong#59 bump submodule (`6561aed`), spec 004 Implemented.
- Deploy: Vercel `76ff7e6` "Deployment has completed"; tohong-back run 41024746667.

Cần Capu kiểm sau deploy: mở `/?admin`, tab "Thành viên" hiện đầu tiên. Số "mới 7 ngày" của tài khoản dùng tham số `created_at_after` của Clerk chưa thử được với Clerk thật: nếu nó bằng đúng số tổng (khi tổng ≤ 500) là dấu hiệu Clerk bỏ qua tham số — báo Chief of Staff.
