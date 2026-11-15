---
type: decision
id: ADR-111
date: 2026-11-15
decided_by: chief-of-staff
tasks: [T-179, T-182]
---
# Cất matching/inv-006 cũ vào lưu trữ; thay bằng bản T-179 sau merge

ADR-106 (Capu): đổi dự toán thì in danh sách mới, giữ nguyên danh sách cũ — đảo đúng tính chất `planner/vendor/matching/inv-006-the-ghep-khong-hien-diem-cu.sh` (thẻ cũ không được hiện điểm theo dự toán cũ). Spec T-179 v2 qua Spec Gate; spec-critic xác nhận inv-006 cũ FAIL trên bản cài đúng spec (ca A) → để lại thì Code Gate đỏ tầng 2 và bị phân loại spec oan.
- Chuyển inv-006 cũ sang `eval/invariants/planner/vendor/matching/_luu-tru/` (không chạy, giữ lịch sử, như ADR-078/108). lib/the_ghep_inv.cjs, lib/the_ghep_khung.cjs giữ chỗ (bản thay T-179 có thể dùng lại).
- Gác tới khi PR front T-179 merge (ADR-028), rồi chép vào matching/: `eval/T-179/bat-bien-cho-merge/inv-006-danh-sach-moi-nhat-theo-du-toan-da-luu.sh` (danh sách mới nhất theo số đã lưu, danh sách cũ ghi rõ số đã dùng, không gọi thừa; chạy T-179 check_1,2,3,5,7,10) và `inv-doc-du-toan-loi-khong-in-danh-sach-theo-so-doan.sh` (inv-008).
- Khoảng trống tới lúc merge: việc khác chạm phần front của matching chạy tay hai file trên.
