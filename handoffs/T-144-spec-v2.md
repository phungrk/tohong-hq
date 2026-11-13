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

Bổ sung (v3, Spec Gate kiểm lại):
  4. Bước 4 thu quyền: mặc định GIỮ binding; chỉ gỡ khi Capu khẳng định GCP_SA_KEY của tohong là service account khác gha-deployer; không xác định được thì giữ (thừa quyền, không hỏng gì). Bỏ lệnh grep log.
  5. Phạm vi PR tohong của bước 2 thêm: gỡ khối reload matcher trong tohong/.github/workflows/scrape-vendors.yml (MATCHER_RELOAD_PATH, env MATCHER_* cấp job, bước "Reload matcher service"); giữ tải/ghi vendors/vendors.json.
  Eval mới (chưa đăng ký, cần Chief of Staff đăng ký cho T-144): python3 -I eval/T-140/buoc2-go-cloud-run/check_go_scrape_reload.py (đỏ trên main hiện tại). check_go_cloud_run.py không sửa.
