---
type: decision
id: ADR-011
date: 2026-11-01
decided_by: chief-of-staff
tasks: [T-030, T-027]
---
# T-030: ẩn gợi ý cài app khi có lớp đang mở

**Bối cảnh:** adversary (evalplus T-030, `eval/T-030/adv-01-dieu-huong-va-goi-y-cai.sh`, nhóm I) thấy ở 390x640 trên Android, khối gợi ý cài (trong luồng, ~82px) đẩy sheet "Thêm việc" lên: nút đóng ở top -72px, không cuộn được. Spec T-027 mục 9 chỉ nói "trong luồng, không đè thanh tab", không nói khi có lớp mở.

**Quyết định:** khi có bất kỳ lớp nào đang mở (theo danh sách lớp của spec T-027), khối gợi ý cài ẩn; đóng hết lớp thì hiện lại (nếu chưa "Không nhắc lại"). Mọi lớp phải hiện trọn nút đóng ở 390x640.

**Lý do:** giữ ý định của Capu (Back và cài app không làm hỏng thao tác chính); không đổi phạm vi; đảo ngược được. Product cập nhật mục 9 spec T-027 ở lần sửa spec kế tiếp; bất biến về chiều cao tối thiểu chờ Product chốt ngưỡng (main đã vỡ sẵn ở 560px).
