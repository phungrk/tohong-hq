---
type: handoff
task: T-015
from: chief-of-staff
to: capu
version: 2
fixes: [handoffs/T-015-D1.md]
confidence: medium
sources: [phungrk/tohong#53, phungrk/tohong-back#30, phungrk/tohong-front#51, phungrk/tohong#54, decisions/2026-10-29-t015-t016-merge.md]
cost: "$0.00"
reversible: yes
---
Sau khi Reviewer đạt (minor D1):
- D1 mục 1 (owner vừa onboarding không thấy nút mời) sửa ở tohong-front `22b4ae8`, gộp vào #51. D1 mục 2 (nhãn ngắn "Mời cùng xem") giữ nguyên.
- Merge theo ADR-008: tohong#53 → tohong-back#30 (`2747b5a`) và #31 (`067b289`) → tohong-front#51 (`803d012`) → tohong#54 bump submodule (`d41cea7`), spec 003 Implemented.
- tohong-back main `067b289`: `npm test` 71/71; deploy Cloudflare run 40902217552 xanh. Vercel commit `803d012`: "Deployment has completed".
- Nợ mới trong `docs/tech-debt.md`: INVITE-001, PRIV-002.

Chưa kiểm: sự kiện thật trên PostHog production (phiên cloud không vào được production). Capu có thể mở app, gửi một tin nhắn, rồi xem PostHog Live events có `chat_intent` kèm `months_to_wedding`, `budget_bucket`.
