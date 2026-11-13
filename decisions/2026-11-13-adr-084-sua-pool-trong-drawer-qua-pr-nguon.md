---
type: decision
id: ADR-084
date: 2026-11-13
decided_by: capu
tasks: [T-152]
---
# Sửa dữ liệu pool trong drawer đi qua PR vào dữ liệu nguồn (phương án B)

**Câu hỏi:** sửa trong drawer lưu ở đâu — A: overlay R2, có hiệu lực ngay, nguồn tohong không đổi; B: đi qua PR vào dữ liệu nguồn, chậm hơn nhưng nguồn và pool luôn khớp.

**Capu chọn B (2026-11-13).** Hệ quả cho T-152: bản sửa lưu tạm ở R2 trạng thái "chờ áp dụng", workflow xuất có chữ ký (mẫu apply-admin-reviews, T-129) ghi vào nguồn tohong (ưu tiên manual_overrides.json để không bị lần scrape/enrich sau ghi đè), mở PR dữ liệu rồi PR pool (sync-vendor-pool, T-139); có hiệu lực khi Capu merge. Lớp overlay R2 hiện có (ẩn, giá) giữ nguyên, không mở rộng thêm trường.
