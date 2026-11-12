---
task: T-125
type: review-pr
priority: P1
status: done
assigned: 2026-11-11
due: 2026-11-13
source:
  - https://github.com/phungrk/tohong/pull/84
  - https://github.com/phungrk/tohong-back/pull/46
  - https://github.com/phungrk/tohong-front/pull/68
  - board/T-125.md
---

# Giao ChatGPT: review chéo trang admin bảng enrich vendor (3 PR)

**Việc:** review chéo ba PR hiện thực spec T-124 v2 (bậc C, Capu tự merge theo thứ tự tohong#84 → back#46 → front#68). Adversary (Claude) đã chấp nhận sau 2 vòng (3 eval đối kháng adv-01..03). Tìm chỗ Claude cùng mù.

**Đọc:**
- `products/T-124-bang-enrich-vendor.md` (spec v2), `handoffs/T-124-D1.md` (lỗi spec đã sửa)
- `handoffs/T-125-v1.md`, `handoffs/T-125-v2.md` (Diff hành vi)
- `decisions/2026-11-11-adr-062-eval-t124-approvable-370.md`
- `eval/T-124/` (check_1..9), `eval/T-125/adv-01..03`, `eval/T-125/gate-latest.json`
- `eval/T-124/bat-bien-cho-merge/inv-001-*.py`, `eval/T-125/bat-bien-cho-merge/inv-002-*.py`
- Bất biến `eval/invariants/planner/vendor/images/` (INV-016, INV-020, INV-021, INV-022)

**Ưu tiên tìm:** bảo mật route admin ghi dữ liệu (quyền, người duyệt lấy từ token, dữ liệu vào `manual_overrides.json`); hành vi Capu thấy khác spec (số đếm 876/98/680/244/107/370, nút Approve/Sửa thủ công/Đã duyệt tay); lệch giữa ba repo (báo cáo tohong ↔ file nhúng back ↔ UI); luồng xác nhận lô → `decisions/` → `apply_admin_reviews.py`.

**Đã biết, không cần báo lại:** host Maps chỉ nhận share.google, goo.gl, maps.app.goo.gl, google.com/maps (theo spec T-110/T-124; `g.co/kgs`, `google.com.vn` bị chặn ở cả hai bên); câu báo lỗi `version_conflict` dùng chung với màn sửa vendor cũ; nếu tohong#83 merge trước #84 phải sinh lại báo cáo.

**Tiêu chí hoàn thành:** một comment `[ChatGPT review]` trên **mỗi** PR (ba comment) theo mẫu trong `handbook/chatgpt.md`, mỗi phát hiện trỏ tới eval / INV / câu spec, hoặc ghi "ngoài spec"; không có gì thì ghi "không phát hiện" kèm những gì đã đọc.

**Đầu ra mong đợi:** comment `[ChatGPT review]` trên tohong#84, tohong-back#46, tohong-front#68.

**Giới hạn:** không sửa sổ cái, `main`, eval, bất biến; không merge, không approve, không đẩy commit lên ba nhánh PR. Chỉ comment.

**Kết quả (Chief of Staff ghi khi đóng, 2026-11-12, adversary xác minh):**
1. back#46 normalize() nuốt file R2 sai schema → kho rỗng, PUT ghi đè mất dữ liệu — **ĐÚNG** (lỗi thật adversary bỏ sót; thành eval/T-125/adv-04, sửa ở T-132).
2. tohong#84 apply bỏ kiểm decision khi thiếu `--hq` — **ĐÚNG về hành vi**, spec T-124 cho phép (spec lỏng, không phải lỗi code); xử lý trong T-129; luật tạm: chỉ chạy apply với `--hq` (ADR-068).
3. front#68 thiếu `version_conflict` trong ERR — **SAI** (khoá có ở format.js:45; chỉ câu chữ lệch nghĩa, minor đã biết).
KPI: 2/3 đúng, 1 sai; 1 lỗi thật ngoài tầm adversary.
