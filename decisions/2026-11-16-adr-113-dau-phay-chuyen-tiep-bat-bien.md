---
type: decision
id: ADR-113
date: 2026-11-16
decided_by: chief-of-staff
tasks: [T-183]
---
# T-183: chuyển tiếp ba bất biến nhận cả dấu chấm và dấu phẩy, siết sau merge

Capu: "xử lý luôn các nợ nhỏ" (dấu thập phân chip, mã chết scoreEpoch, câu sót spec T-179). Spec T-183 qua Spec Gate. Theo khuyến nghị Spec Gate (tránh main đỏ tầng 2 cho việc khác chạm planner/vendor trong lúc Code Gate):
1. Bây giờ: `planner/vendor/inv-004` (eval/T-178/thay-the/inv-004-check_8.mjs, 3 chỗ), `inv-005` (eval/T-178/thay-the/inv-005a.mjs, 1 chỗ) và `matching/inv-007` nhận cả hai dấu (chuẩn hoá phẩy↔chấm chỉ ở phần so chip; dòng 'Theo số bàn' gửi AI vẫn khoá dấu chấm). Mọi tính chất khác giữ nguyên. Kiểm: PASS trên back main 2d1a76c và trên bản cài giả dấu phẩy của Spec Gate.
2. Ngay sau khi PR back T-183 merge: trỏ về đúng ba bản siết trong `eval/T-183/thay-the/` (chỉ dấu phẩy) và thăng `eval/T-183/bat-bien-cho-merge/inv-009-so-tien-le-dau-phay-trong-chu-ghep.mjs` vào matching/.
Trong cửa sổ chuyển, dấu phẩy được khoá ở Code Gate T-183 bằng check_1, check_2.
Quyết định phạm vi: khoảng giá vendor ở front ("4tr–4.6tr/bàn", "Bạn đã lưu lúc 3.5tr") giữ dấu chấm trong việc này; đề xuất Capu việc riêng.
