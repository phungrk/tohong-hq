---
type: decision
id: ADR-117
date: 2026-11-16
decided_by: chief-of-staff
tasks: [T-188, T-190]
---
# T-190 merge (bậc C, theo lệnh Capu); bất biến planner/admin inv-001..004

Capu cho phép trước: "merge 188 luôn khi xong" (phụ lục ADR-116). Adversary accept T-190, gate GREEN 20/20 (2 adv). Chief merge squash phungrk/tohong-back#66 → 1f7455c, phungrk/tohong-front#84 → 8fc817c.
Hành vi: không đổi gì khi cờ TẮT (mặc định). Cờ `ADMIN_OPEN` (Worker, đúng chuỗi "1", kiểu Text) và `VITE_ADMIN_OPEN` (Vercel, đúng "1", redeploy) do Capu tự bật; Chief không bật, không đặt biến. Khi bật: ai có link `?admin=` dùng được toàn bộ /api/admin/* dưới danh tính `admin-khong-dang-nhap` (không bao giờ là Capu).
Câu hỏi còn mở cho Capu: loại kích hoạt/thu hồi gói trả phí khỏi phần mở? Merge không đợi vì cờ tắt; nếu Capu chọn loại, làm việc mới trước khi bật cờ.

Bể:
- Thăng `eval/invariants/planner/admin/inv-001..004` + `lib/admin_open_back.mjs` (từ eval/T-188/bat-bien-cho-merge/), PASS trên main thật với `env -i` từ /tmp.
- `members/lib/members_ui_inv.cjs`, `vendor-enrich/lib/t153_admin_tab.cjs`: env build thêm `VITE_ADMIN_OPEN: ''` để máy có cờ không làm đỏ oan (không đổi điều bất biến đo).
- Phạm vi lời văn members INV-002, vendor-enrich INV-008, INV-010(a) ("không đăng nhập → 403"): áp dụng khi `ADMIN_OPEN` khác đúng "1". Khi cờ bật, điều thay thế là planner/admin inv-001..003.
- Chưa thăng adv-01 (a)(b) của T-190 (adversary đề nghị); để trong eval/T-190/.
