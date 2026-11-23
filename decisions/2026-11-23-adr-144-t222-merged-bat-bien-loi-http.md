# ADR-144: T-222 đã merge; thăng INV-012, INV-013 vào planner/vendor

- Ngày: 2026-11-23
- Người quyết: Chief of Staff (thăng bất biến sau merge, ADR-028); Capu merge PR bậc C
- Việc: T-221 (spec), T-222 (code), issue phungrk/tohong#113

## Bối cảnh

Capu merge https://github.com/phungrk/tohong/pull/118 (commit da953df, merge 3088cdd). Adversary accept ở da953df, gate GREEN 32/32. Hai bất biến chờ merge do spec-critic đặt ở `eval/T-221/bat-bien-cho-merge/`.

## Quyết định

1. Thăng `inv-loi-http-p0-khong-lo-khoa.py` → `eval/invariants/planner/vendor/inv-012-loi-http-p0-khong-lo-khoa.py` (chạy lại T-221 check_2).
2. Thăng `inv-loi-http-p0-khong-lo-du-lieu-vendor.py` → `eval/invariants/planner/vendor/inv-013-loi-http-p0-khong-lo-du-lieu-vendor.py`, gộp thêm T-222 adv-01 (NFC/NFD), adv-02 (giá trị gửi chứa mẫu khoá), adv-04 (cách sửa v2 không lộ, không che hỏng dòng 402) theo đề nghị của adversary trong accept note. Nội dung câu bất biến giữ nguyên, chỉ thêm nguồn đo.
3. Bản chờ merge giữ lại trong `eval/T-221/bat-bien-cho-merge/` làm dấu vết (như T-219).

## Kiểm chứng

`cd /tmp && env -i PATH=$PATH HOME=$HOME TOHONG_REPO=<worktree origin/main 3088cdd> python3 -I <inv>`: cả hai PASS (INV-013: check_6, adv-01, adv-02, adv-04 đều PASS).

## Rủi ro đã chấp nhận

- `error.message` chứa tên/địa chỉ dạng thực thể HTML không bị che (ADR-143, phân xử D2).
- Dạng NFKC (toàn độ rộng, ligature) không được che; pool thật không có chuỗi khác nhau giữa NFC và NFKC (adversary, T-222 vòng 2).
- Chưa kiểm với thân 402 thật của Google.
