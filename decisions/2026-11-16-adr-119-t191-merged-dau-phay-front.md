---
type: decision
id: ADR-119
date: 2026-11-16
decided_by: chief-of-staff
tasks: [T-187, T-191]
---
# T-191 merge (bậc A, Capu: "merge 187 luôn khi xong"); bất biến planner/front/budget/inv-008

Adversary accept T-191 (3 adv), Chief merge main (T-189) vào nhánh rồi chạy lại gate: GREEN; vendor-images inv-006/007 và inv-008 PASS. Merge squash phungrk/tohong-front#85 → 8751e87.
Hành vi: số tiền lẻ app cặp đôi tự in dùng dấu phẩy, 1 chữ số, bỏ ",0", không phân cách nghìn; làm tròn |x| rồi đặt dấu, 0 ghi "0tr" không dấu; nhãn Vượt/Còn dư/Khớp theo số thật. Trang admin giữ dấu chấm. Chữ back trả in nguyên văn.
Thăng `eval/invariants/planner/front/budget/inv-008-so-tien-le-dau-phay-khong-dau-0.sh` + `lib/so_tien_dau_phay_inv.cjs` (từ eval/T-187/bat-bien-cho-merge/), PASS trên front main 8751e87.
Eval cũ lỗi thời (không trong bể, khoá dấu chấm ở bề mặt cặp đôi), coi là được thay bằng eval T-187 + inv-008, không chạy lại: T-164 check_5a, T-170 check_1 và check_5, T-175 adv-03. T-164 check_5b (admin giữ dấu chấm) vẫn hiệu lực.
