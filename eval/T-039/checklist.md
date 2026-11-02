# T-039 checklist nhìn (Safari/iOS, Firefox và cảm nhận thị giác mà máy không đo được)

Lý do dùng checklist: (1) môi trường chạy eval của Product chỉ có Chromium, WebKit và Firefox của Playwright chưa cài (`/opt/pw-browsers/webkit-2359`, `firefox-1543` không có), nên tiêu chí 3 ("hiển thị đúng trên WebKit và Firefox") chưa kiểm bằng máy được ở đó; ở máy/CI có đủ engine, `bash eval/T-039/run.sh <repo> --task T-039 --criterion 3 --require-engines` thay cho các dòng 1-4 dưới đây; (2) "nhỏ nhưng rõ" là cảm nhận. Phần đo được (24 mũi cuối, 6 mũi giữa, kích thước, hướng, sát mép, không bị đè, không che chữ, màu sáng/tối, inv-001..028) nằm trong `bash eval/T-039/run.sh <repo> --task T-039`; đừng lặp lại ở đây.

Cách kiểm chung: mở `index.html` của PR trên thiết bị nêu ở từng dòng, tới bảng "Mô hình Eval-Gated 2029", hoặc mở các ảnh trong `docs/screenshots/T-039/`. Mỗi dòng trả lời có/không; một "không" thì ghi dòng đó vào defect (`--against` tiêu chí trong ngoặc).

1. Safari trên iPhone hoặc Safari macOS (WebKit): mọi đường có đầu mũi đặc cùng màu đường (xám; cam ở đường nét đứt), không có đường nào thiếu đầu mũi? ("có" là đạt) [tiêu chí 1, 3]
2. Safari: sáu đường dài (`eval hồi quy` từ Reservoir lên Code Gate, `bậc C`, `ống hồi`, `báo cáo insight tuần`, `đọc bể`, `spec mâu thuẫn → spec rework`) đều có thêm một mũi giữa đường, không đè chữ nhãn? ("có" là đạt) [tiêu chí 2, 3]
3. Firefox (máy tính): như dòng 1 và 2? ("có" là đạt) [tiêu chí 1, 2, 3]
4. Safari/Firefox ở chế độ tối (đổi giao diện hệ thống sang tối): mũi tên đổi sang màu sáng hơn cùng đường, vẫn đọc được trên nền tối? ("có" là đạt) [tiêu chí 1, 3]
5. Mở `sau-1280.png` cạnh `truoc-1280.png`: nhìn lướt (không phóng to ảnh) thấy hướng của mọi đường, mũi tên "nhỏ nhưng rõ", không to đến mức che đường ngắn như "Ý định → Spec Writer"? ("có" là đạt) [tiêu chí 1]
6. Mở `sau-390.png` trên điện thoại thật ở cỡ gốc: nhìn thấy mũi tên ở mọi đường, không có đường ngắn nào bị mũi tên chiếm gần hết? ("có" là đạt) [tiêu chí 1, 4]
7. Chế độ phóng to trên điện thoại: kéo ngón tay quanh bảng, mũi tên không nhấp nháy, không lệch khỏi đường, không biến mất lúc cuộn? ("có" là đạt) [tiêu chí 4]
8. Khi có dot chạy (đợi một sự kiện thật hoặc dùng bản có dữ liệu): dot đi ngang đầu mũi thì nằm trên mũi, không bị mũi che? ("có" là đạt) [tiêu chí 4]
