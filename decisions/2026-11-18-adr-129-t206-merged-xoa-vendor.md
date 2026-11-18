# ADR-129: T-206 merged: admin xoá vendor, khôi phục được

Ngày: 2026-11-18 · Người quyết: Capu ("merge 203 luôn khi xong"), Chief thực hiện · Việc: T-203 (spec), T-206 (code)

## Đã merge
- phungrk/tohong-back#70, squash 241166c; phungrk/tohong-front#89, squash 0ac65e1. Merge back trước, front sau.
- Bậc B, Capu bỏ cửa sổ 48 giờ (ADR-122 bổ sung).
- Spec qua Spec Gate ở lần thứ hai (1 lần spec rework).
- ADR-127: `vendor_deleted_at_create` suy từ Nhật ký.
- ADR-128: sửa hai lỗi dựng eval, không tính là spec rework.
- Adversary accept, thêm 7 eval tầng 3, tất cả xanh. Gate GREEN.

## Bể bất biến
Thêm vào bể:
- planner/admin inv-010 `vendor-da-xoa-chi-o-nhan-da-xoa-khong-ket`: vendor đã xoá chỉ nằm ở nhãn "Đã xoá", không kẹt.
- planner/admin inv-011 `xoa-khoi-phuc-tra-lai-y-nguyen-chi-ghi-overlay-va-nhat-ky`: xoá rồi khôi phục trả lại y nguyên, chỉ ghi overlay và Nhật ký.
- planner/admin inv-012 `co-admin-open-voi-route-xoa-khoi-phuc`: cờ mở admin với hai route xoá/khôi phục. Lấy từ T-206 adv-03, chỉ đổi đường import.
- planner/vendor inv-007 `vendor-bi-go-khong-ra-phia-cap-doi`: vendor bị gỡ không lộ ra phía cặp đôi.

Bất biến mới vẫn dùng `eval/T-203/lib/common.mjs`, nên phải giữ thư mục lib đó. Chạy `env -i` từ /tmp trên main mới: cả bốn PASS, planner/admin inv-001..009 vẫn PASS.

## Diff hành vi
- Tab Dữ liệu vendor có nút "Xoá vendor": phải nhập lý do và xác nhận.
- Nhãn "Đã xoá" có nút "Khôi phục". Mỗi lần xoá hay khôi phục đều ghi Nhật ký.
- Hộp kết nối hiện "· đã xoá".
- Với cặp đôi, Xoá và Ẩn trông y hệt nhau.

## Nợ ghi nhận (minor của adversary)
- So thời điểm ở mức mili giây trong `vendor_deleted_at_create`.
- Mỗi lần tải hộp kết nối, back đọc Nhật ký hai lượt, nên chậm dần khi Nhật ký lớn.
- Front đếm độ dài lý do theo UTF-16, back đếm theo code point; lệch nhau với emoji.
