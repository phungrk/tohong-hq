---
type: handoff
task: T-163
from: product
to: engineering
version: 3
fixes: [T-163-D1]
confidence: medium
sources: [handoffs/T-163-D1.md, products/T-162-so-do-luong-theo-roster.md]
cost: "$0.00"
reversible: yes
---
Đã làm: sửa `products/T-162-so-do-luong-theo-roster.md` thành v3 theo T-163-D1 và phân xử của Chief; `task.py respec T-163` đã chạy, việc quay về Engineering (vòng 0). Phần còn lại của v2 giữ nguyên.
Đã sửa câu nào, vì sao:
  - Hành vi 4(c) (mới): thiếu CLAUDE.md. Có `TOHONG_ROOT` (môi trường thử của các bất biến hq/dashboard, check_4, ledger/inv-007) thì giữ nguyên org/roster.json, in `::warning::`, thoát 0. Không có `TOHONG_ROOT` (workflow thật) thì như 4(a): lỗi, thoát khác 0, không ghi đè dashboard.json. Vì v2 để hở ca này, cài đặt đã tự thêm ngoại lệ làm agent cũ quay lại. Không sửa bất biến nào.
  - Hành vi 4(d) (mới): dòng ``- `id` — `` trong fenced code block không tính là bộ phận, không vào roster, không có `::warning::`.
  - Hành vi 1: tên dài bị cắt bằng "…" trên node để hộp node luôn trong khung ở 390px và 1200px; tên đầy đủ trong title hoặc tooltip; 320px không bắt buộc.
  - Tên nhánh: trang là `t-162-roster-luong`; bỏ tên nhánh của repo sổ cái.
Eval nối thêm (tầng 1), trạng thái hiện tại đều đỏ như kỳ vọng:
  - `python3 eval/T-163/adv-01-thieu-claude-md-so-cai-that.py` (4c)
  - `python3 eval/T-163/adv-03-dong-bo-phan-trong-code-block.py` (4d)
  - `bash eval/T-162/check_1_ten_dai.sh` (bọc eval/T-163/adv-02-so-do-bien.cjs, tên dài; tôi không sửa file của adversary)
Cần Spec Gate cập nhật: bất biến chờ merge inv-022 (roster xuất theo CLAUDE.md, do spec-critic giữ) phải khớp Hành vi 4 mới: nhánh thiếu CLAUDE.md theo `TOHONG_ROOT` (4c) và dòng trong code block không tính (4d). Tôi không sửa bất biến.
Rủi ro: ngoại lệ 4(c) dựa vào việc workflow thật không đặt `TOHONG_ROOT` (publish-dashboard-data.yml dòng 39, theo defect); nếu workflow đổi thì ngoại lệ lệch.
Kết quả nằm ở: products/T-162-so-do-luong-theo-roster.md

Cập nhật v3.1 (Spec Gate, Chief chốt; không respec lại, T-163 ở engineering): products/T-162-so-do-luong-theo-roster.md sửa 4(c) ngoại lệ thiếu CLAUDE.md chỉ khi TOHONG_ROOT trỏ thư mục khác kho của export_dashboard.py (realpath), còn lại như 4(a); 4(d) fence tính cả ``` và ~~~, đóng bằng đúng loại đã mở; Hành vi 1 cắt "…" cả chữ hành động của nhịp; title hoặc tooltip đều được. Eval chưa đổi: adv-01 vẫn đúng; Engineering/Spec Gate nên cân nhắc thêm ca TOHONG_ROOT = kho của script.
