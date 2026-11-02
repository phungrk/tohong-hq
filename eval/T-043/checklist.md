# T-043 checklist (người kiểm, dữ liệu giả)

Lý do dùng checklist: các dòng dưới là việc máy không kiểm được trong repo (quan hệ giữa hai PR, nội dung PR, môi trường thật của Cloudflare/Clerk). Phần đo được đã có ở `members_list.test.js`, `check_members_ui.cjs`, `check_6_gates.py`, `check_6_shots.py`; không lặp lại ở đây.

Cách kiểm chung: dùng dữ liệu giả (R2 giả của test, hoặc `wrangler dev` với bucket local tự dựng, tài khoản Clerk thử nghiệm). KHÔNG chạy với dữ liệu thật của người dùng thật. Mỗi dòng trả lời có/không; một "không" thì ghi dòng đó vào defect.

1. Có đúng hai PR, một ở `phungrk/tohong-back` và một ở `phungrk/tohong-front`, mỗi PR chỉ chứa thay đổi của T-043? (mở danh sách file đổi của từng PR; "có" là đạt)
2. PR front có ảnh chụp danh sách ở 390px và ở 1024px với dữ liệu giả, và PR back/front ghi rõ ảnh là dữ liệu giả? (mở phần mô tả PR; "có" là đạt)
3. Mô tả PR có mục "Diff hành vi" nói rõ: trước đây tab Thành viên chỉ có con số, nay có danh sách kèm tên cô dâu, chú rể, và không có số điện thoại? ("có" là đạt)
4. Trong mã đổi của hai PR, không có `console.log/info/warn/error/debug` nào in ra tên, email, từ khoá tìm hay mã người dùng? (tìm các lệnh console mới thêm trong diff; "không có" là đạt; máy chỉ kiểm được những đường chạy mà test đi qua)
5. Không có sự kiện analytics nào (`capture`, `track`, PostHog) mới trong diff của PR front? ("không có" là đạt)
6. Cấu hình triển khai của Worker (Cloudflare) có bật ghi nhật ký yêu cầu (observability, logpush) không? Nếu có, tên và email có xuất hiện trong nhật ký đó không? (xem trang cấu hình Worker; từ khoá tìm đi trong thân POST nên không được xuất hiện, đáp "không xuất hiện" là đạt; nếu không xem được, ghi "không kiểm được" để Capu biết)
7. Không có thay đổi nào ở `data/`, schema, migration, hay biến môi trường mới (Engineering không đặt secret thay Capu)? ("không" là đạt)
8. Ở màn thật (dev) với tài khoản thử, mở tab Thành viên bằng điện thoại thật hoặc giả lập 390px: ngón tay chạm được ô tìm và hai nút chia trang mà không bấm nhầm? (cảm giác; "có" là đạt)
