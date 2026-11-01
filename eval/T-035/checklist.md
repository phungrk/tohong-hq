# T-035 checklist nhìn (máy không đo được "to và sinh động như video", "bot nổi trên cùng")

Lý do dùng checklist: các câu dưới đây là cảm nhận thị giác mà `eval/T-035/bo-cuc-phong-to.cjs` không đo được. Phần đo được (cỡ, biên độ, che chữ, thứ tự vẽ, vào/thoát phóng to, 390px, dot hiện, bất biến) nằm trong `bash eval/T-035/run.sh <repo> --task T-035`; đừng lặp lại ở đây.

Cách kiểm chung: mở bản PR (`index.html` bằng trình duyệt) tới bảng "Mô hình Eval-Gated 2029", hoặc mở các ảnh trong `docs/screenshots/T-035/`. Muốn có sự kiện: mở `index.html?live=<địa chỉ Worker thử>` rồi bắn sự kiện, hoặc xem ảnh. Mỗi dòng trả lời có/không; một "không" thì ghi dòng đó vào defect (`--against` tiêu chí trong ngoặc).

1. Nhìn `sau-1280.png` cạnh `truoc-1280.png`: nhân vật rõ ràng to hơn (gấp đôi) mà vẫn cân với khối, không trông "dính" hay lạc khối? ("có" là đạt) [tiêu chí 1]
2. Nhìn `sau-1280.png` (chụp lúc đang cử động): thấy nhân vật đang lao/nhảy rõ ràng, giống tinh thần video (lao ra khỏi bàn gần một thân người), mà không đè lên chữ nào? ("có" là đạt) [tiêu chí 1]
3. Bảng sau khi nới có cân đối: khoảng trống giữa các khối đủ để đọc nhãn đường ("spec + eval → việc", "critic chặn", ...), không đường nào bị khối chồng lên? ("có" là đạt) [tiêu chí 1]
4. Nhìn `can-canh-gt_spec.png` và `can-canh-gt_code.png`: bot nằm trên cùng, không thấy viền cổng hay đường nối cắt qua thân bot; bot trông "nổi" trên cổng? ("có" là đạt) [tiêu chí 3]
5. So `truoc-can-canh-gt_code.png`: lỗi cũ (mũi tên chui xuống sau bot, viền xanh dày chạy ngang chân bot) đã hết? ("có" là đạt) [tiêu chí 3]
6. Mở trang, bấm `Phóng to`: bảng chiếm gần trọn khung nhìn, nút `Thu nhỏ` luôn thấy ở góc, thoát bằng Esc và nút Back đều tự nhiên (không rời trang)? ("có" là đạt) [tiêu chí 2]
7. Khi đang phóng to, bắn sự kiện: thấy dot chạy, khối đích sáng, hai nhân vật giao/nhận, bong bóng tiếng Việt không đè mặt bot? ("có" là đạt) [tiêu chí 2]
8. `phong-to-390.png` trên điện thoại thật hoặc giả lập 390px: nhân vật và dot nhận ra được, nút `Thu nhỏ` dễ bấm bằng ngón tay, kéo hai ngón phóng chữ đọc được? ("có" là đạt) [tiêu chí 2]
9. Bật giảm chuyển động của hệ điều hành: vào/thoát phóng to vẫn được, không gì cử động, nhưng vẫn nhận ra khối nào đang sáng? ("có" là đạt) [tiêu chí 4]
10. Chế độ tối: nhân vật to hơn vẫn đủ tương phản, không có viền trắng lạ quanh bot ở hai cổng? ("có" là đạt) [tiêu chí 1]
