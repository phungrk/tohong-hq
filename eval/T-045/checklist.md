# T-045 checklist (người kiểm, dữ liệu giả) — tiêu chí 8

Lý do dùng checklist: các dòng dưới là việc về nội dung PR và hình thức ảnh chụp, máy không kiểm được. Phần đo được đã có ở `check_ui.cjs` (kể cả dòng Số bàn ở 390px không tràn khung) và `check_7_gates.py`; không lặp lại ở đây.

Cách kiểm chung: dữ liệu giả (ngân sách giả như trong `check_ui.cjs`: 205 khách, vendor "Nhà hàng Hoa Sen" 6tr/bàn). KHÔNG dùng dữ liệu của người dùng thật. Chụp ảnh bằng `node eval/T-045/check_ui.cjs --repo <front> --only 2 --shots <thư mục>` hoặc tự chụp. Mỗi dòng có/không; một "không" thì ghi dòng đó vào defect.

1. PR front có ảnh màn Ngân sách ở 390px với dữ liệu giả, hạng mục Nhà hàng tiệc cưới hiện số tiền chi và dòng "Số bàn: N", và PR ghi rõ ảnh là dữ liệu giả? (mở mô tả PR; "có" là đạt)
2. PR front có thêm ảnh màn chi tiết hạng mục Nhà hàng tiệc cưới ở 390px (khoản vendor đã chốt, số tiền, dòng Số bàn)? ("có" là đạt)
3. Mô tả PR có mục "Diff hành vi" nói rõ ba điều: (a) trước đây số bàn không làm tròn lên, nay làm tròn lên; (b) trước đây thiếu số khách thì lấy nguyên giá một bàn làm tiền chi, nay hiện "chưa tính được"; (c) trước đây đổi số khách phải chốt lại, nay tự tính lại? ("có đủ ba" là đạt)
4. Mỗi repo đúng một PR chỉ chứa thay đổi của T-045 (PR back chỉ có nếu thật sự cần back; không đổi `lib/prompts.js`, không đổi schema, không đổi `lib/vendorPool.generated.js`)? (mở danh sách file đổi; "có" là đạt)
5. Không có sự kiện analytics mới và không có `console.log` nào in ra số khách hay tiền trong diff? ("không có" là đạt)
