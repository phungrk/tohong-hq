---
type: decision
id: ADR-085
date: 2026-11-13
decided_by: capu
tasks: [T-152]
supersedes: ADR-084
---
# Sửa dữ liệu pool trong drawer ghi vào overlay R2, có hiệu lực ngay (phương án A) — thay ADR-084

Capu đổi ý (2026-11-13): "sửa trong drawer thì lưu ở đâu? -> A, tôi đổi ý".

Hệ quả cho T-152: bản sửa ghi vào lớp overlay R2 `data/admin/vendor_overrides.json` (lib/vendorOverlay.js), mở rộng tập trường cho phép có kiểm hợp lệ, có lịch sử (ai, lúc nào, trước/sau), ghi có etag; có hiệu lực ngay ở tab Vendor và chat; không ghi ngược nguồn tohong, không qua PR; mọi admin được sửa như overlay hiện có. ADR-084 giữ làm lịch sử, không còn hiệu lực.
