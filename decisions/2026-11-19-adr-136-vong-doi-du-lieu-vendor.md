# ADR-136: Vòng đời dữ liệu vendor (6 bước)

Ngày: 2026-11-19 · Người quyết: Capu · Ghi bởi: Chief of Staff

## Quyết định
Capu chốt vòng đời: (1) cào từ nguồn bất kỳ, không bắt buộc → (2) Enrich, không bắt buộc → (3) Admin duyệt → (4) Tạo PR, merge → (5) Áp override vào dữ liệu vendor → (6) Sync.

Bản gốc của Capu có hai bước cùng đánh số 4. Chief đánh số lại từ 1 đến 6, giữ nguyên thứ tự.

Chi tiết từng bước, workflow và file liên quan, ai làm, có gọi Google không: `handbook/vong-doi-du-lieu-vendor.md`.

## Hệ quả
- Mọi việc chạm dữ liệu vendor phải nói rõ việc đó nằm ở bước nào.
- Lớp overlay của admin (ẩn, xoá, sửa giá, liên hệ, địa chỉ) là lối tắt có hiệu lực ngay, không đi qua vòng đời này.
- Đây là thay đổi trong `handbook/`, nên workflow sẽ mở PR để Capu duyệt.
