# T-027 checklist máy thật (Back và cài app)

Lý do dùng checklist: trình giả lập (Playwright/Chromium) không có vuốt back của iOS, hộp thoại cài thật của Android, "Thêm vào MH chính" của Safari, và các điều kiện thật (hết lượt dùng thử thật, mạng chậm). Mọi tiêu chí đã có eval tự động ở `check_t027.cjs`; đây là phần bổ sung, không thay.

Cách kiểm chung: dùng bản đã deploy hoặc `npm run build && npm run preview -- --host` rồi mở bằng điện thoại trên cùng mạng (cài app cần HTTPS: dùng bản deploy hoặc đường hầm HTTPS). Mỗi dòng trả lời có/không; một "không" thì ghi dòng đó vào defect.

## A. Back trên điện thoại thật

1. iPhone, Safari: Trang chủ → Ngân sách → chạm "Ảnh" → vuốt từ mép trái. Về danh sách Ngân sách; vuốt tiếp về Trang chủ; vuốt tiếp rời app/về trang trước của Safari? ("có" cho cả ba là đạt)
2. iPhone, Safari: mở ngăn kéo (nút menu) rồi vuốt back: ngăn kéo đóng, vẫn ở tab cũ? ("có" là đạt)
3. iPhone, Safari: mở chat AI, vuốt back: chat đóng, không rời app? ("có" là đạt)
4. Android, Chrome: lặp lại 1-3 bằng phím/cử chỉ Back hệ thống. ("có" cho cả ba là đạt)
5. Android, Chrome: đóng ngăn kéo bằng nút "Đóng menu" rồi bấm Back: về trang trước ngay, không phải bấm hai lần? ("có" là đạt)
6. Paywall bản thật (hết lượt dùng thử thật, không phải 402 giả): Back đóng Paywall, chat còn mở? Chỉ cần kiểm nếu hành vi khác eval. (Sheet Timeline, sửa ngày cưới, Paywall đã có eval tự động; `VendorFlowSheet` là mã chết, bỏ qua.)
7. Mở lớp (vd ngăn kéo) rồi bấm Back rồi Forward trên trình duyệt: lớp không tự mở lại, không lỗi? ("có" là đạt)
8. Tải lại trang khi đang ở `#/ngan-sach/<id>` với ngăn kéo mở: ngăn kéo đóng, vẫn ở danh mục; Back một lần về danh sách (không phải bấm hai lần)? ("có" là đạt)
9. Gõ tay `/#/khach-moi` vào thanh địa chỉ (hoặc dán link): vào thẳng Khách mời; Back rời app? ("có" là đạt)
10. App đã cài (standalone) trên Android: ở Trang chủ bấm Back hệ thống: app thoát, không bị giữ lại? ("có" là đạt)

## B. Cài app thật

11. Android Chrome, bản HTTPS: mở app lần đầu (đã qua Onboarding). Khối "Thêm Tơ Hồng vào màn hình chính" hiện với nút "Cài ứng dụng"? Chrome không hiện thanh gợi ý riêng kèm theo? ("có", "không" là đạt)
12. Bấm "Cài ứng dụng" → hộp thoại cài của Chrome → Cài. Biểu tượng "Tơ Hồng" ra màn hình chính, logo tím trên nền kem, không bị cắt sát mép khi launcher bo tròn hay bo vuông? ("có" là đạt; đây là kiểm maskable thật)
13. Mở app từ biểu tượng: toàn màn hình, không có thanh địa chỉ, và khối gợi ý cài **không** hiện? ("có" là đạt)
14. Android: trước khi dựng xong app, trình duyệt bắn `beforeinstallprompt` sớm (tải trang bằng mạng chậm 3G giả lập): khối gợi ý vẫn hiện sau khi app dựng xong? ("có" là đạt; eval tự động chỉ kiểm sự kiện đến sau khi dựng)
15. Android: bấm "Không nhắc lại"; đóng hẳn trình duyệt, mở lại: khối không hiện lại? ("có" là đạt)
16. iPhone, Safari: mở app (đã qua Onboarding). Khối hướng dẫn hiện, có chữ "Chia sẻ" và "Thêm vào MH chính", không có nút "Cài ứng dụng"? ("có" là đạt)
17. iPhone: Chia sẻ → Thêm vào MH chính. Biểu tượng ra màn hình chính là logo tím trên nền kem (không phải ảnh chụp trang, không nền đen)? ("có" là đạt)
18. iPhone: mở từ biểu tượng: không thanh Safari, khối gợi ý không hiện? ("có" là đạt)
19. iPad ở chế độ mặc định (trang web máy tính, UA giống Mac): khối gợi ý không hiện? Đây là hành vi đã biết, chấp nhận ("không hiện" là đúng spec; nếu hiện thì ghi lại để Capu biết)
20. Máy tính, Chrome: có hiện khối gợi ý (vì Chrome bắn `beforeinstallprompt`); đóng bằng "Không nhắc lại" thì hết? ("có" là đạt)
