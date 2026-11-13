---
type: handoff
task: T-144
from: product
to: engineering
version: 2
fixes: []
confidence: high
sources: [products/T-140-chat-ghep-vendor-computematches.md, eval/T-144/adv-01-lenh-don-gcp-khong-xoa-bucket-con-dung.py]
cost: "$0.00"
reversible: yes
---
Đã sửa mục "Lệnh cho Capu tự chạy" (spec T-140, Bước 2); code không đổi. `adv-01` PASS trên spec mới.
  1. Bucket gs://wedding-planner-vendors được GIỮ (scrape-vendors còn dùng vendors/vendors.json). Chỉ xoá hai object gốc vendors.json, vendors.prev.json; sao lưu về máy là bước 1 BẮT BUỘC.
  2. Thu quyền: chỉ gỡ binding roles/storage.objectUser của gha-deployer (Capu cấp cho T-138; trước đó không có quyền list, log 403 run 43342201548). Bỏ qua nếu scrape-vendors dùng chính gha-deployer; có lệnh kiểm (get-iam-policy, log run scrape-vendors) trước khi gỡ.
  3. Thêm xoá MATCHER_URL, MATCHER_API_KEY của repo phungrk/tohong (không xoá GCP_SA_KEY/GCP_PROJECT_ID của tohong).
Engineering chép khối lệnh trong spec vào thân PR #53 (đúng nguyên văn, không có `rm -r` bucket).
Kết quả nằm ở: products/T-140-chat-ghep-vendor-computematches.md
