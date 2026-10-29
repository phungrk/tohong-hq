---
type: decision
id: ADR-007
date: 2026-10-29
decided_by: capu
tasks: [T-015]
---
# T-015: bỏ `invite_accepted` khỏi spec 003, giữ nguyên API

**Bối cảnh:** Tiêu chí 5 của T-015 yêu cầu nút mời bắn `plan_shared` và `invite_accepted`, không đổi API. Khi viết spec 003, Chief of Staff thấy backend chưa có luồng nhận lời mời: `edge/lib/coupleStore.js` `acceptInvitesForEmail` là stub trả `{accepted: 0}` và không nơi nào gọi. Giữ "không đổi API" thì `invite_accepted` không bao giờ xảy ra.

**Quyết định:** Capu chọn bỏ `invite_accepted` khỏi T-015 (câu hỏi trong phiên 2026-10-29). Nút mời và `plan_shared` vẫn làm; API giữ nguyên.

**Hệ quả:**
- Tiêu chí 5 của T-015 được hiểu là: nút mời dùng API có sẵn, bắn `plan_shared` kèm vai trò; không có `invite_accepted`.
- Ngưỡng "≥50% lời mời được nhận" của giả thuyết hai họ chưa đo được.
- Nợ INVITE-001 ghi ở `phungrk/tohong` `docs/tech-debt.md`; spec 003 có mục Clarifications ghi lại.
