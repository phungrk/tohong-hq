---
type: handoff
task: T-078
from: product
to: engineering
version: 2
fixes: [reject-kind-spec T-078 13:05]
confidence: high
sources: [decisions/2026-11-02-t041-pham-vi-loc-san-pham.md, products/T-041-loc-san-pham.md, eval/T-041/run.sh]
cost: "$0.00"
reversible: yes
---
Spec rework T-076 (vòng 5) theo phân xử của Chief of Staff: THEO T-041, không ngoại lệ.

Câu nào cho hai cách hiểu: U1 ("số trên khối = số dòng modal") không nói bộ chọn sản phẩm có tác dụng không; Ràng buộc còn trích sai "ADR-011 (capu_queue không lọc theo bộ lọc sản phẩm)" và Không làm ghi "Lọc capu_queue theo bộ lọc sản phẩm". Engineering đọc đúng chữ spec nên làm không lọc, đỏ T-041 C1.

Đã sửa trong products/T-076-modal-viec-cho-capu.md:
- U1a: số, chữ phụ, đèn, modal lọc theo trường `product` của việc (mặc định `all`; việc không sản phẩm chỉ ở Tất cả); `capu_queue` trong dashboard.json giữ toàn bộ, lọc ở trang. U1b nói rõ mọi nơi dùng chung một tập dòng hiển thị.
- U10: đổi bộ chọn khi modal mở thì cập nhật, không đóng. U12 (mới): khi lọc, modal có `[data-capu-filter]` với chữ chính xác "Đang lọc theo sản phẩm: <P>. Chọn "Tất cả" ở bộ chọn Sản phẩm để xem mọi việc chờ anh."; ở Tất cả không có.
- U11 (mới): tóm tắt nhân vật Capu (T-037) đếm theo tập dòng hiển thị; nhãn trạng thái decision "Chờ quyết", blocked "Chờ Capu làm", diff-b/merge-c "Chờ đọc diff". Bỏ khỏi Không làm.
- Ràng buộc: bỏ câu trích sai, dẫn decisions/2026-11-02-t041-... mục 1, 3 và T-041 H2, H6; đối chiếu INV-023 (dữ liệu không capu_queue giữ biểu thức cũ nên bất biến không đổi) và hq/dashboard INV-001, INV-003.
- Tiêu chí 11, 12, 13 + eval; eval 1-10 không đổi (chạy ở `all`).

Eval mới (thay toàn bộ danh sách eval của việc, 13 lệnh):
- eval/T-078/check_11_loc_san_pham.cjs (tiêu chí 11)
- eval/T-078/check_12_tom_tat_capu.cjs (tiêu chí 12)
- bash eval/T-041/run.sh "${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}" --criterion 1 (tiêu chí 13)
- eval/T-078/adv-01-...cjs ca d: kỳ vọng đổi thành xác định (n=0, khối tắt, "Đang rảnh"); nó là eval tầng 3 của adversary, không nằm trong danh sách eval của việc.

Hiện trạng trên nhánh PR feat/t078-modal-capu: check_11, check_12, T-041 C1 và adv-01 ca d đỏ đúng chủ ý (chưa lọc); check_11 ca "all" xanh. Bản tham chiếu ngoài repo (scratchpad ref_t076.py) cập nhật thêm lọc/chữ phụ/tóm tắt: 39/39 ca đồng, 0 lệch trên dump eval 1, 2, 5, 11, 12.

Diff hành vi: mặc định Tất cả nên Capu mở trang thấy y như v1 (hôm nay 4 dòng). Khác: chọn planner/hq thì số, đèn, modal, tóm tắt Capu chỉ còn việc của sản phẩm đó, modal có dòng báo đang lọc.
Bất biến đề xuất (cho Spec critic/CoS, tôi không tự thêm): INV-P5 rút T-041 C1 thành bất biến hq/dashboard; INV-P6 số khối = dòng modal = số tóm tắt đếm (mở rộng INV-P1/INV-023 chiều bộ chọn).
Câu hỏi mở: không.
