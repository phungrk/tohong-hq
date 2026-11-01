# T-025 checklist nhìn (máy không đo được "trông có ổn không")

Lý do dùng checklist: các câu dưới đây là cảm nhận thị giác (cân đối, đọc được, không vỡ bố cục) hoặc màn eval tự động không dựng được.
Phần đo được (độ rộng khung, căn giữa, cuộn ngang, viền/bóng, sheet nằm trong khung) đã có ở `check_width.cjs`; không lặp lại ở đây.
Cách kiểm chung: `cd tohong-front && npm run dev`, mở http://localhost:5173, đặt hồ sơ đủ (hoặc đăng nhập tài khoản thử), dùng chế độ giả lập thiết bị của trình duyệt ở 390, 768, 1280. Ảnh tham chiếu: `docs/screenshots/T-025/*-<bề ngang>.png`.

Mỗi dòng trả lời có/không. Một "không" ở dòng nào thì ghi dòng đó vào defect.

1. Ở 768 và 1280, Trang chủ có bị chữ/nút chồng lên nhau hay cắt mất không? (mở Trang chủ, nhìn từ trên xuống dưới; trả lời "không" là đạt)
2. Ở 768 và 1280, các thẻ vendor ở Ngân sách và chat có tràn khỏi khung hoặc bị cắt cạnh phải không? ("không" là đạt)
3. Ở 768, chạm vùng tối ngoài sheet (màn Mời, sheet vendor) có đóng sheet không? Chạm vùng ngoài khung ở 1280 có đóng sheet không? (cả hai "có" là đạt)
4. Ở 1280, vùng ngoài khung (hai bên) vẫn thấy nền kem của trang, không thấy nội dung app tràn ra đó? ("có" là đạt)
5. Paywall (chat AI, hết lượt dùng thử): mở ở 390, 768, 1280; hộp nằm trong khung, nút đóng bấm được? (tới được bằng cách đặt `trial.remaining = 0` trong dữ liệu thử; eval tự động chưa dựng được)
6. Sheet Timeline và VendorFlowSheet (màn Kế hoạch, thêm việc / vendor): mở ở 768 và 1280, phủ đúng bề ngang khung, không lệch trái/phải? ("có" là đạt)
7. Thông báo "Đã lưu <vendor> vào Vendors" (lưu vendor từ chat): ở 1280 hiện giữa khung, không lệch ra ngoài khung? ("có" là đạt)
8. Onboarding (xoá localStorage `th_user`, tải lại): ở 768 và 1280 vừa khung, không cuộn ngang? ("có" là đạt)
9. Xoay màn hình 768x1024 sang 1024x768 và quay lại, khung giãn đúng, không cần tải lại trang? ("có" là đạt)
