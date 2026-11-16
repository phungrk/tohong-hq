---
type: decision
id: ADR-114
date: 2026-11-16
decided_by: chief-of-staff
tasks: [T-183, T-184]
---
# T-184 merge (bậc A); siết bất biến về dấu phẩy (bước 2 ADR-113); inv-009

Adversary accept T-184, gate GREEN 36 (5 adv), hai PR clean → Chief merge: phungrk/tohong-back#65 (c789686; deploy run 43802607795 khởi chạy), phungrk/tohong-front#81 (1bc6b54; build xanh).
Nợ nhỏ đã dọn: số tiền lẻ ở chip/câu tư vấn dùng dấu phẩy; bỏ mã chết scoreEpoch ở front (lệnh test:budget); spec T-179 sửa chữ (v2.1).
Siết (PASS trên main mới, từ /tmp):
- `planner/vendor/inv-004` → `eval/T-183/thay-the/inv-004-check_8.mjs`;
- `planner/vendor/inv-005-...sh` → `eval/T-183/thay-the/inv-005a.mjs` + `eval/T-178/thay-the/inv-005b.mjs`;
- `matching/inv-007` thay bằng bản T-183 (khuôn dấu phẩy); bản dấu chấm cất `matching/_luu-tru/inv-007-...-dau-cham.mjs`;
- thăng `matching/inv-009-so-tien-le-dau-phay-trong-chu-ghep.mjs`.
Bản chuyển tiếp của eval/T-178/thay-the (nhận hai dấu) không còn được bất biến nào trỏ tới.
Lỗi thời: T-178 check_1, check_2; T-180 adv-01, adv-02, adv-04.
Minor ghi nhận (không mở việc): "giá dao động 4,2–4,2tr" khi hai giá thô làm tròn trùng (spec H1.4 cho phép); dòng "Lý do khớp" trong prompt câu AI chi tiết ghép nguyên chip nên nay có "3,9tr" cạnh dòng giá dấu chấm (hệ quả của H1.1, rủi ro thấp). Còn mở: khoảng giá vendor ở front vẫn dấu chấm — chờ Capu.
