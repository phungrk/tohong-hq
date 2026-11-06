---
type: decision
id: ADR-028
date: 2026-11-06
decided_by: chief-of-staff
tasks: [T-080, T-074]
---
# Bất biến chỉ xanh sau merge thì gác ngoài bể tới khi merge

**Bối cảnh:** adversary accept T-080 (PR phungrk/tohong-back#39, bậc B, chưa merge) và rút hai bất biến vào `eval/invariants/planner/vendor/matching/`: inv-002 (thiếu tag không bị phạt) và inv-003 (thứ tự gu theo điểm, R8). Cả hai đỏ trên tohong-back main cho tới khi #39 merge. Trong lúc đó mọi việc khác chạm vùng (T-074 đang ở Spec Gate) sẽ đỏ tầng 2 oan, mà tầng 2 đỏ = spec rework.

**Quyết định:**
1. Chuyển hai file sang `eval/T-080/bat-bien-cho-merge/` (không sửa nội dung). Đưa lại vào bể khi PR #39 merge và chúng xanh trên main; nếu vẫn đỏ sau merge thì không đưa, ghi lý do.
2. Luật chung từ nay: bất biến chỉ xanh sau khi PR của việc merge thì nằm ở `eval/<T-xxx>/bat-bien-cho-merge/` cho tới khi merge; Chief of Staff đưa vào bể ngay sau merge (như INV-007 vendor/images sau tohong-back#37).

**Hệ quả:** không bất biến nào bị xoá hay sửa nội dung. Gate của T-074 không còn đỏ oan vì T-080.
