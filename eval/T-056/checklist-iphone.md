# T-056 checklist iPhone thật: Chrome iOS và Safari (Capu tự kiểm)

Lý do dùng checklist: Chromium không có thanh công cụ dưới của Chrome iOS hay Safari, không có `env(safe-area-inset-bottom)` thật. Eval tự động (`eval/T-056/check_vv.cjs`) chỉ kiểm cơ chế bù theo visualViewport bằng đối tượng giả; có đúng với Chrome iOS thật hay không chỉ máy thật trả lời được. Mỗi dòng có/không; một "không" thì chụp ảnh và ghi số đo (mở `?vvdebug=1`).

## Chuẩn bị
0. Mở `https://<bản deploy>/?vvdebug=1#/ngan-sach` trên Chrome iPhone. Chụp màn hình khi thanh Chrome đang hiện, ở đầu trang: ghi lại ba số innerHeight, vv.height, vv.offsetTop. (Nếu innerHeight bằng vv.height + offsetTop mà thanh tab vẫn bị che, cách bù theo visualViewport không đủ, báo lại, không đánh dấu đạt.)

## A. Chrome iOS (bắt buộc, lỗi gốc của T-056)
1. Ngân sách, cuộn tới cuối: thấy trọn thanh tab (Trang chủ, Kế hoạch, Ngân sách, Khách mời) ngay trên thanh công cụ dưới của Chrome, không bị đè?
2. Dòng cuối ("Thêm hạng mục") nằm trọn phía trên thanh tab?
3. Cùng kiểm 1 ở Trang chủ, Kế hoạch, Khách mời và một trang con (vd "Nhà hàng tiệc cưới")?
4. Giữa trang và đầu trang: thanh tab vẫn thấy trọn?
5. Vuốt để Chrome thu thanh công cụ (nếu thu được): thanh tab đi theo xuống sát đáy, không để khoảng trống lớn? Vuốt lại cho thanh hiện: thanh tab lên theo?
6. Ở đầu trang (iPhone, chưa cài app): khối gợi ý cài nằm ngay trên thanh tab, cả hai đều trọn?
7. Chạm vào một ô nhập (ô tìm khách, ô chat): bàn phím hiện, thanh tab không che ô đang nhập, đóng bàn phím thì thanh tab về chỗ cũ? (ghi chú, không tính đạt/không nếu T-055 cũng vậy)
8. Khoảng trống giữa thanh tab và thanh Chrome: không thấy? (nếu có dải trống > 8px dưới thanh tab, ghi lại số đo)
9. Back: cuộn Kế hoạch xuống giữa, đổi tab, vuốt Back/chạm "←" của Chrome: về đúng chỗ cuộn như trước T-056?

## B. Safari iOS (không đổi so với T-055)
10. Làm lại dòng 1-3 ở Safari: thanh tab sát đáy màn hình khi thanh Safari ẩn, và ngay trên thanh Safari khi hiện; không có dải trống?
11. Chạy lại toàn bộ `eval/T-054/checklist.md` mục A-C ở Safari: không dòng nào đổi từ "có" sang "không"?
12. Thêm vào MH chính, mở từ biểu tượng: thanh tab sát đáy, đệm vùng an toàn như T-055?

## C. Quy tắc cho mọi việc layout sau này (đề xuất, xem spec T-056 mục "Bất biến đề xuất")
13. Mọi việc đổi layout/khung/dính (sticky, fixed, 100vh/dvh, safe-area) phải có dòng "đã thử trên Chrome iOS: có/không" trong bàn giao trước khi Capu merge.
