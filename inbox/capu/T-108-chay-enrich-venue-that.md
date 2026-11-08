---
type: decision-request
task: T-108
from: chief-of-staff
to: capu
decide-by: 2026-11-10
reversible: no
---
Cần quyết: chạy Google Text Search + Place Photos thật cho 99 vendor venue ngay bây giờ (tháng 11), hay chờ 1/12 khi hạn mức miễn phí reset?

Phương án A (khuyến nghị): chạy ngay.
  1. Merge PR tohong #71 (code T-108 đã qua Code Gate 3 vòng, 57/57 test, adv-01..05 xanh).
  2. Actions → "Enrich venue (Google)" → Run với `dry_run=true` → đọc Summary (số vendor, request ước tính, chặn nếu vượt 1.000).
  3. Chạy lại `dry_run=false` → workflow mở PR dữ liệu → merge.
  4. Em tạo lại pool (`--photos-for venue`), mở PR tohong-back → anh merge (bậc C).
  → Hệ quả: card Tiệc & nhà hàng có ảnh thật trong ~1 giờ. Chi phí: Text Search ≤ 99 lượt — $0 nếu SKU này còn 1.000 lượt miễn phí tháng 11 (tự tin ~75%, chưa xem được hoá đơn), xấu nhất $3,47. Media: 606 đã dùng + ≤ 50 (enrich) + phần còn lại qua refresh ≤ 700 trần → workflow tự chặn nếu vượt 1.000, nên SKU Photos vẫn $0.
Phương án B: chờ 1/12.
  → Hệ quả: chắc chắn $0 cả hai SKU; card venue hiện ảnh minh hoạ thêm 3 tuần; T-108 đứng yên (cảnh báo 24h trong summary).
Khuyến nghị: A — rủi ro tiền tối đa $3,47, trong ngân sách $5 của việc; giá trị là category quan trọng nhất có ảnh thật ngay.
Nếu không quyết: T-108 ở trạng thái leo thang, không ai chạy; đến 1/12 em nhắc lại.

Điểm cần anh đọc trong Diff hành vi (handoffs/T-108-v3.md), vì là bậc C:
- Vendor venue chỉ nhận khớp Google khi confidence ≥ 0,6, hoặc ≥ 0,4 kèm trùng số nhà + tên đường (ADR-044 và spec T-106 v3).
- Khớp lưng chừng không vào pool, vào `review-needed.csv` để anh so tên.
- Nhà hàng Google ghi đóng cửa vĩnh viễn bị gỡ ở mọi category (lưu `removed_vendors.json`, khôi phục được) — ADR-044, em tự quyết theo tinh thần quyết định 404 của anh; không đồng ý thì nói, em đổi trước khi chạy.
