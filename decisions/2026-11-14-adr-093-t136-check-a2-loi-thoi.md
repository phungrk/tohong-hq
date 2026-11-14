---
type: decision
id: ADR-093
date: 2026-11-14
decided_by: chief-of-staff
tasks: [T-136, T-164, T-165]
---
# T-136 check_a2 lỗi thời; nợ spec T-164 sau Code Gate vòng 1 của T-165

1. `eval/T-136/check_a2` lỗi thời: đã đỏ trên main vì lý do khác (thứ tự matcher, giá A/overlay rỗng) và sau tohong-back#59 mong "(giá ước tính)" trong khi nhãn mới là "(ước tính theo hạng mục)". Không chạy lại, không sửa (đã báo trước ở ADR-091). Không nằm trong gate của T-165.
2. Nợ cho product (không chặn T-165): mục Bằng chứng/H5 của spec T-164 ghi 157/465/245 và khung venue 7,4; pool thật 159/463/245, khung 3,2–7,3 (2 venue có bản ghi per_table hợp lệ mà `tao-fixture.py` bỏ qua vì lấy bản ghi đầu theo glob). Sửa số + cách fixture chọn bản ghi; làm rõ nhãn hàng mồ côi admin khi pool chưa đóng dấu (căng giữa H3 và H4).
3. Đề xuất của adversary: rút T-165 adv-01 (fallback số khách hiệu lực một nguồn) thành bất biến planner/vendor sau khi T-165 merge.
