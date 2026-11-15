---
type: decision
id: ADR-098
date: 2026-11-15
decided_by: capu
tasks: [T-156, T-166, T-167, T-168]
---
# T-166 và T-168 merge sớm theo lệnh Capu; thăng hai bất biến

Capu: "merge 60, 76 và 75 luôn" (bỏ cửa sổ 48 giờ bậc B). Đã merge:
- phungrk/tohong-back#60 (1519d44) T-168 budgetBasis + profileSnapshot nguồn số — deploy run 43675469648 thành công;
- phungrk/tohong-front#76 (26f0f87) T-168 dòng phép so dưới thanh Ngân sách;
- phungrk/tohong-front#75 (0221a5c) T-166 ghi công tác giả ảnh Google. PR cũ front#64 đóng (thay thế).
Front main 0221a5c build xanh; check_3 T-156 và check_4 T-167 PASS trên main gộp.

Thăng bất biến (xanh trên main):
- `eval/invariants/planner/vendor/matching/inv-005-diem-ngan-sach-suy-ra-tu-budget-basis.py` (+ `lib/diem_tu_budget_basis.mjs`), từ `eval/T-167/bat-bien-cho-merge/`. Sửa phạm vi theo note adversary T-168: chỉ áp cho vendor có match VÀ priceMax > 0 — vendor admin đặt giá 0 nằm ngoài H1 spec T-167 (không có khuôn hợp lệ, điểm 0,5 như cũ). Kiểm `env -i` từ /tmp: PASS.
- `eval/invariants/planner/front/vendor-images/inv-006-ghi-cong-hien-o-moi-be-mat.sh`, từ `eval/T-156/bat-bien-cho-merge/` (probeFn đã vá v3: cuộn khung auto/scroll, khôi phục khung hidden/clip). PASS (Playwright cần env thường).
`eval/T-156/bat-bien-cho-merge/inv-xxx-ghi-cong-pool-ten-tac-gia-hop-le.py` trùng nội dung với images/inv-045 (ADR-096) — không thăng.

Nợ còn lại: product sửa H1 spec T-167 thành "priceMax > 0"; `budget_by_category` chuỗi rác làm điểm NaN (có sẵn trên main, chưa có đường ghi).
