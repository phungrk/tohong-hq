---
type: decision
id: ADR-088
date: 2026-11-14
decided_by: chief-of-staff
tasks: [T-152, T-157]
---
# T-157 merge (Capu "merge 56, 73 luôn"); 3 eval đối kháng thành bất biến vendor-enrich

1. Merge tohong-back#56 (deploy xanh) rồi tohong-front#73. Bậc C, Capu yêu cầu Chief bấm merge.
2. Theo đề nghị adversary, ba eval đối kháng của T-157 vào bể `planner/admin/vendor-enrich/`, dạng wrapper dò gốc HQ (ADR-070) chạy bản gốc trong `eval/T-157/lib/` (phụ thuộc `eval/T-152/lib/back152.mjs` — hai thư mục này không được xoá):
   - `inv-011-ten-sua-khong-ky-tu-an-dao-chieu.sh` (adv-02): tên/mô tả admin sửa không ký tự ẩn, không ký tự đảo chiều trong tên.
   - `inv-012-url-anh-sua-chi-mot-cach-doc.sh` (adv-03): URL ảnh sửa không có hai cách đọc host.
   - `inv-013-bien-the-vo-hinh-va-host-anh.sh` (adv-05): ký tự vô hình ngoài BMP; host marry viết lệch.
   Cả ba PASS trên main e80e07c, chạy `env -i` từ /tmp.
3. Ghi nhận: TTL cache overlay 5 phút (mặc định, Capu không yêu cầu đổi); rollback back cũ làm mất history; ảnh Google trong bản sửa rơi khi pool làm mới URL. Chữ dạng lệnh/SĐT trong tên vào prompt → T-158.
