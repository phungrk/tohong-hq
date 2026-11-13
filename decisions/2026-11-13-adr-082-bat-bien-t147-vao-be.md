---
type: decision
id: ADR-082
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-147, T-149]
---
# Đưa bất biến chờ merge của T-147 vào bể (Capu "merge 98, 54, 70 luôn")

Merge theo thứ tự tohong#98 → tohong-back#54 (deploy xanh) → tohong-front#70. Theo ADR-028, cả ba xanh trên main, chạy `env -i … python3 -I` từ /tmp (dò gốc HQ tới scripts/gate.py):
- `planner/admin/vendor-enrich/inv-006-danh-muc-thuoc-tinh-pool.py`: danh mục `tools/scraper/pool-input-fields.json` khớp hai chiều với các trường generator thật sự đọc (đo bằng thực nghiệm). Thư viện `pool_reads.py` chép sang `eval/lib/` (bất biến tìm ở đó trước `eval/T-147/lib/`).
- `planner/admin/vendor-enrich/inv-007-bao-cao-khong-mang-lien-he-dia-chi.py`: `pool_catalog`/`pool_input` không có khoá liên hệ hay địa chỉ ở mọi cấp, ở cả báo cáo tohong và bản nhúng back.
- `planner/inv-007-worker-nen-duoi-1mb.py`: worker.js nén ≤ 1.000.000 byte (hôm nay 770.694). Chạm ngưỡng khi vendor tăng ~1,35× → đo lại và chuyển báo cáo sang R2, không nới ngưỡng.
Merge bậc B sớm hơn 48 giờ vì Capu đã đọc Diff hành vi và yêu cầu merge. Câu hỏi "chỉ Capu xem drawer" chạy theo mặc định (chỉ Capu).
