# ADR-131: Sửa hai bất biến apply bị phụ thuộc dữ liệu thật của tohong

Ngày: 2026-11-18 · Người quyết: Chief of Staff

## Bối cảnh
Capu đã merge phungrk/tohong#93 vào main, đưa 133 mục mới vào `manual_overrides.json`. Từ lúc đó, hai bất biến sau đỏ trên main:
- `planner/admin/inv-007-entry-co-mo-admin-qua-apply.py`
- `planner/admin/vendor-enrich/inv-004-chu-ky-back-tohong-hq-cung-mot-dinh-nghia.py`

Lỗi in ra: "apply sinh mục [..], mong [.., marry_c6f3c54184ac]". Hai bất biến lấy vendor id từ báo cáo enrich thật rồi chạy script apply thật. Các id được lấy giờ đã có mục trong `manual_overrides.json` của tohong, nên apply in SKIP_EXISTING. Hành vi được bảo vệ (export ký qua apply) vẫn đúng. Cái hỏng là phần dựng tình huống: nó phụ thuộc vào dữ liệu đã duyệt trong repo. Chief đã chạy lại và tái hiện được, dùng `env -i` từ /tmp.

## Quyết định
- Sửa phần dựng tình huống, không đổi điều kiện kiểm. Có hai cách được chấp nhận: chạy apply trên một bản sao tạm có `manual_overrides.json` rỗng, hoặc chọn những id chưa có mục trong đó. Cả hai đều không sửa repo tohong.
- Đây là sửa bất biến qua Chief theo CLAUDE.md, có ghi quyết định này. Không phải sửa bất biến cho khớp code: code không đổi.
- Phải sửa xong trước Code Gate của T-207 và T-208, vì cả hai việc chạy tầng 2 có các bất biến này.
