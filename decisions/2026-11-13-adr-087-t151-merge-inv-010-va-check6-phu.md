---
type: decision
id: ADR-087
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-150, T-151, T-152, T-157]
---
# T-151 merge (Capu "merge 55, 71 luôn"); bất biến T-150 vào bể (inv-010); áp đổi eval T-147 check_6 sang drawer PHỦ

1. Merge tohong-back#55 (deploy xanh) rồi tohong-front#71. Bậc C, Capu yêu cầu Chief bấm merge.
2. `eval/T-150/bat-bien-cho-merge/inv-008-drawer-doc-la-admin-ghi-ky-la-capu.py` vào bể với số **inv-010** ở `planner/admin/vendor-enrich/` (inv-008 đã là bất biến người ngoài của T-153). Xanh trên main, chạy `env -i … python3 -I` từ /tmp. Nội dung: người ngoài 403; mọi admin đọc drawer như Capu; Approve/Sửa thủ công của admin khác by_capu=false, export chỉ mục Capu, ghi đè/rút lại sau Capu → 409; đọc không ghi R2.
3. Đã chạy `eval/T-152/ap-dung-check6-t147.py`: `eval/T-147/check_6_ui_drawer.cjs` đổi từ chế độ ĐẨY sang PHỦ theo quyết định Capu (T-152, ADR-085 bối cảnh), 5 chỗ như spec T-152 liệt kê. Do product soạn trước, áp sau khi T-151 merge để không làm đỏ oan gate T-151 (tiền lệ ADR-074).
