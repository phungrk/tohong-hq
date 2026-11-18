# ADR-134: T-211: số điện thoại vendor được ghi vào Lịch sử sửa, thay quyết định 4.4 của T-152

Ngày: 2026-11-18 · Người quyết: Chief of Staff (theo ý định Capu ở T-211) · Việc: T-211

## Bối cảnh
Capu yêu cầu "sửa tay địa chỉ và số điện thoại", và mỗi lần sửa phải ghi giá trị trước và sau. Quyết định 4.4 của T-152 lại cấm đưa số điện thoại vào lịch sử sửa. `eval/T-152/check_3_lich_su_va_etag.mjs`, ở dòng "sửa liên hệ", đang đo đúng quyết định đó.

## Quyết định
- Từ T-211, Lịch sử sửa ghi giá trị trước và sau của `phone` và `address`. Zalo và website vẫn chỉ ghi `contact.changed`.
- Lý do: đây là số máy doanh nghiệp, chỉ admin đọc được (FR-036). Ghi trước và sau là để kiểm và hoàn tác sửa tay.
- Không sửa eval của T-152. Thêm ghi chú `eval/T-152/SUPERSEDED-ADR-134.md`. Script `eval/T-211/ap-dung-sua-check3-t152.py` không được chạy.
- Ghi chú "superseded" có hiệu lực khi PR của T-211 merge. eval T-152 check_3 là eval của một việc đã đóng, không nằm trong bể, nên không chặn gate nào.
- Câu hỏi mở cho Capu, không chặn việc: có muốn cặp đôi thấy địa chỉ hoặc số điện thoại vendor không? Mặc định là không, theo FR-036. Nếu muốn thì tách thành việc riêng, bậc C.
