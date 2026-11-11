# T-122 checklist MANUAL (Capu, iPhone Chrome/Safari thật)

Lý do không tự động được: Chromium/Playwright không có thanh công cụ Chrome iOS / Safari thật, không có bàn phím thật và không kiểm được cảm giác "nhìn là biết còn nội dung" trên màn thật; các số đo máy (eval 1-6) dùng viewport ước 390x650, 393x662, 375x632.

Làm trên bản chạy có PR tohong-front#66 và PR của T-122 (cùng deploy). Mỗi dòng trả lời có/không.

- [ ] Mở onboarding tới bước 2/3 "Kế hoạch đám cưới", chưa cuộn. Nền quanh nút "Tiếp theo" mờ dần (không phải một khối trắng đặc che hết), thấy ít nhất tiêu đề "SỐ KHÁCH DỰ KIẾN" hoặc một phần hàng nút số khách xuyên qua: có/không
- [ ] Nút "Tiếp theo" vẫn đậm đặc như cũ, chữ trắng đọc rõ, bấm được; chữ "Quay lại bước 1" đọc rõ: có/không
- [ ] Vuốt ngón tay bắt đầu từ vùng mờ phía trên nút "Tiếp theo" thì danh sách cuộn (không bị kẹt): có/không
- [ ] Vuốt lên tới hết: hàng số khách (80 ... 500+) hiện đủ phía trên footer, và footer trở lại đặc như bản cũ (không còn thấy nội dung đi qua phía sau): có/không
- [ ] Vuốt xuống ngược lại: footer mờ trở lại khi hàng số khách lại chui xuống sau footer: có/không
- [ ] Bước 3a (chọn ảnh phong cách): cùng cách hoạt động (mờ khi còn ảnh dưới, đặc khi cuộn hết): có/không
- [ ] Bước 1: bấm vào ô tên, bàn phím hiện lên; ô tên không bị footer che: có/không
- [ ] Ghi `innerHeight` thật nếu mở được `?vvdebug=1` (spec đang GIẢ ĐỊNH 650-662): ____
