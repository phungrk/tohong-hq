# Checklist T-066, tiêu chí 6: hạng mục lạ dùng minh hoạ chung

Vì sao là checklist: sau T-066, mọi bề mặt chỉ nhận `catId` thuộc 10 hạng mục của `VENDOR_CATEGORIES` (thẻ chat trả null với hạng mục lạ; màn Vendor đã lưu và Ngân sách chỉ duyệt đúng 10 hạng mục), nên không có đường nào từ giao diện đưa một hạng mục lạ vào ô ảnh. Eval chạy bằng dữ liệu giả không thể ép tới nhánh này mà không nhắc tới cách cài đặt. Nhánh vẫn bắt buộc có (dự phòng khi thêm hạng mục mới), nên Adversary/Capu kiểm bằng cách dưới đây.

Cách kiểm chung: trong nhánh của việc, mở thẻ mã nguồn dựng minh hoạ, đưa vào một hạng mục không có trong 10 hạng mục (vd `reserve`, `mc`, rỗng, `undefined`, `null`), render ô ảnh 100x100.

- [ ] Hạng mục `reserve` (có ở Ngân sách, không có vendor) cho ra một minh hoạ svg, không ô trống, không lỗi console?
- [ ] Hạng mục `mc`, chuỗi rỗng, `undefined`, `null` đều cho ra cùng một minh hoạ chung đó?
- [ ] Minh hoạ chung khác cả 10 minh hoạ hạng mục khi nhìn (render 96px cạnh contact sheet, không so markup)?
- [ ] Tên truy cập của minh hoạ chung đúng bằng "Ảnh minh hoạ" (không kèm tên hạng mục)?
- [ ] Minh hoạ chung nhẹ <= 4096 byte, chỉ dùng token màu, không tham chiếu mạng (cùng ràng buộc tiêu chí 3)?
