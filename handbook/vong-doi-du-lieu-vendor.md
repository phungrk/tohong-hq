# Vòng đời dữ liệu vendor

Capu chốt ngày 2026-11-19, xem ADR-136. Đây là đường duy nhất để dữ liệu vendor đi từ nguồn tới cặp đôi. Mọi việc chạm dữ liệu vendor phải nói rõ việc đó nằm ở bước nào.

| Bước | Tên | Bắt buộc? | Ở đâu | Ai làm | Tốn Google? |
| --- | --- | --- | --- | --- | --- |
| 1 | Cào từ nguồn bất kỳ | Không bắt buộc | repo tohong, workflow "Scrape Vendors" (`scrape-vendors.yml`), ra `tools/scraper/output/<thành phố>/<hạng mục>/vendors.json` | Capu bấm Run workflow | Không |
| 2 | Enrich | Không bắt buộc | repo tohong, workflow "Enrich vendors" (`enrich-vendors.yml`). Mặc định là dry run; chạy thật cần Capu duyệt chi, trần mỗi đợt. Ra `enrich-report.json` = bảng Enrich ở admin | Capu duyệt chi | Có (Text Search) |
| 3 | Admin duyệt | Bắt buộc | Trang admin, bảng Enrich: nhận địa điểm, gỡ, tạm đóng, không khớp. Review ở "Chờ Capu" hoặc "Chờ áp dụng". Khi cờ ADMIN_OPEN bật, review được tính là của Capu (ADR-126) | Capu / admin | Không |
| 4 | Tạo PR, merge | Bắt buộc | repo tohong, workflow "Apply admin reviews" (`apply-admin-reviews.yml`), tự chạy mỗi ngày 10:17 giờ VN hoặc bấm tay. Ghi export có chữ ký vào `manual_overrides.json` qua PR `admin-reviews/capu` | Máy mở PR, Capu merge (bậc C) | Không |
| 5 | Áp override vào dữ liệu vendor | Bắt buộc | repo tohong, workflow "Resolve overrides" (`resolve-overrides.yml`). Điền `resolved` (lấy từ báo cáo Enrich nếu mục khớp ứng viên còn mới, ≤30 ngày; nếu không thì gọi Google), rồi `overrides.py` áp vào `vendors.json` sau khi kiểm đóng cửa, ngoài tỉnh, trùng địa điểm. Mở PR dữ liệu `resolve-overrides/run-*` | Capu bấm Run (chạy thật cần duyệt chi), Capu merge PR | Chỉ cho mục báo cáo không phủ (Place Details) |
| 6 | Sync | Bắt buộc | repo tohong-back, workflow "Sync vendor pool" (`sync-vendor-pool.yml`). Sinh lại `lib/vendorPool.generated.js` và `lib/vendorEnrichReport.generated.js` từ đúng commit dữ liệu, chạy test, mở PR. Merge PR tohong ở bước 5 trước, PR này ngay sau. Merge PR này thì deploy Worker và cặp đôi thấy | Bước 5 tự kích hoạt; nếu không chạy thì bấm tay với `tohong_ref` + `tohong_branch`. Capu merge | Không |

## Lối tắt không đi qua vòng đời

Tab Dữ liệu vendor ở admin (lớp overlay R2) có hiệu lực ngay, không qua PR:
- ẩn vendor;
- xoá vendor, khôi phục được (T-206);
- sửa giá, liên hệ, địa chỉ và số điện thoại (T-214).

Lớp overlay này vẫn giữ nguyên khi pool được dựng lại ở bước 6.

## Luật

- Không sửa tay `*.generated.js` ở tohong-back. Bước 6 sẽ ghi đè chúng.
- Sửa `vendors.json` hoặc `manual_overrides.json` bằng tay thì phải sinh lại `enrich-report.json` (INV-003), mở PR, rồi đi tiếp bước 5–6.
- Mọi lần gọi Google (bước 2, bước 5) cần Capu duyệt chi. Không tự động lấy dữ liệu từ trang Google Maps (điều khoản Google).
- Bước 4 và bước 5 cần cờ ADMIN_OPEN giữ nguyên trạng thái cho tới khi PR của bước 4 merge. Tắt cờ sớm thì các review mở-admin rơi khỏi PR.

## Việc còn treo (2026-11-19)

- `BACK_DISPATCH_TOKEN` thiếu quyền, nên bước 5 không tự kích hoạt được bước 6. Hiện phải bấm tay. Capu cấp quyền Actions: write cho token trên tohong-back.
- Đợt T-200: PR [phungrk/tohong#104](https://github.com/phungrk/tohong/pull/104) (bước 5) chờ T-213 merge để bước 6 qua test.
