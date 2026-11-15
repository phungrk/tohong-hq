---
type: decision
id: ADR-108
date: 2026-11-15
decided_by: chief-of-staff
tasks: [T-178]
---
# Hai bất biến so chip theo bàn bỏ phần tổng; bất biến mới tổng chip = budgetBasis

T-178 (Capu): chip nhà hàng thành "≈ Xtr/bàn × N bàn = Ytr". Spec Gate soát 4 bản thay (eval/T-178/thay-the/): chỉ khác bản gốc ở bước bỏ " = {tổng}tr" khỏi nhãn trước khi so. Chief siết regex về đúng chip theo bàn (`/^(≈ \S+tr\/bàn × \d+ bàn) = \S+tr$/` → `$1`) theo khuyến nghị Spec Gate, để không nới cho nhãn khác.
- `planner/vendor/inv-004` → chạy `eval/T-178/thay-the/inv-004-check_8.mjs` (thay check_8 của T-172, ADR-101).
- `planner/vendor/inv-005-...sh` → chạy `eval/T-178/thay-the/inv-005a.mjs` và `inv-005b.mjs` (bản cũ inv-005a/b giữ trong thư mục, không chạy).
Đổi trước Code Gate vì xanh cả trên main c2445db lẫn bản cài giả. Kiểm từ /tmp: cả hai PASS trên main.
Bất biến mới gác tới merge: `eval/T-178/bat-bien-cho-merge/inv-tong-trong-chip-ban-bang-budget-basis.mjs` (tổng chip = budgetBasis.totalTr, ba số đúng khuôn; khép phần nới ở trên) → `planner/vendor/matching/` sau merge.
Lỗi thời khi T-178 merge: T-164/check_9, T-165/adv-01, adv-02, adv-06.
Ghi nhận: matching/inv-006 (Playwright) chập chờn khi chạy song song eval front khác — sẽ được thay theo T-179 (ADR-106); nếu đỏ ở Code Gate T-178 (không chạm front) thì không phân loại spec. Golden check_2 của T-178 ghim back c2445db — nếu việc khác đổi điểm trước, tạo lại golden bằng T178_GOLDEN=1 trên main mới (spec cho phép), không phân loại code.
