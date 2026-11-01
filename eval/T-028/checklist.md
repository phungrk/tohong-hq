# T-028 checklist nhìn (máy không đo được "trông có ổn không")

Lý do dùng checklist: các câu dưới đây là cảm nhận thị giác (dễ theo dõi, dễ phân biệt màu, dark mode) mà `eval/T-028/model-dots.cjs` không đo được. Phần đo được (đường, màu, viền 3px, nền 18%, trần dot, reduced-motion, 390px, lỗi console) đã nằm ở eval tự động, không lặp lại ở đây.
Cách kiểm chung: mở dashboard (bản PR hoặc `index.html` mở bằng trình duyệt), cuộn tới bảng "Mô hình Eval-Gated 2029". Muốn có sự kiện để xem mà không đợi sổ cái thật: mở `index.html?live=<địa chỉ Worker thử>` và gửi sự kiện thử, hoặc dùng ảnh tham chiếu `docs/screenshots/T-028/*.png` (9 ảnh do `bash eval/T-028/run.sh <repo> --shots <repo>/docs/screenshots/T-028` chụp).

Mỗi dòng trả lời có/không. Một "không" ở dòng nào thì ghi dòng đó vào defect (`--against` tiêu chí tương ứng).

1. Khi một việc bàn giao sang Code Gate, mắt có theo kịp dot từ Agent code sang Code Gate không (không quá nhanh, không khựng)? ("có" là đạt) [tiêu chí 1]
2. Cạnh dot đang chạy, khối đích sáng lên có thấy rõ bằng mắt thường (viền dày hơn và nền nhạt cùng màu dot), không bị lẫn với khối chưa sáng? ("có" là đạt) [tiêu chí 3]
3. Năm màu dot (xanh lá, xanh dương, hổ phách, đỏ, tím) có phân biệt được với nhau ở chế độ sáng và chế độ tối? ("có" là đạt) [tiêu chí 2]
4. Ở chế độ tối (prefers-color-scheme: dark), nền khối sáng và chữ trong khối vẫn đọc được? ("có" là đạt) [tiêu chí 3]
5. Mở trang lúc đang có việc chạy (không có sự kiện mới): nhìn thoáng qua có biết ngay việc đang ở khối nào mà không cần dot? ("có" là đạt) [tiêu chí 3]
6. Chú giải có nói đủ: 5 màu dot nghĩa là gì và "khối sáng = đang xử lý"? Chữ không bị cắt, không bị che? ("có" là đạt) [tiêu chí 4]
7. Dồn nhiều sự kiện cùng lúc (ví dụ mở trang rồi chạy nhiều lệnh `task.py`): bảng có rối, có dot chồng thành đám khó nhìn không? ("không" là đạt) [tiêu chí 5]
8. Bật giảm chuyển động của hệ điều hành rồi tải lại: bảng không có gì chuyển động nhưng khối vẫn sáng khi có sự kiện, có vậy không? ("có" là đạt) [tiêu chí 6]
9. Ở 390px (giả lập điện thoại): chữ trong chú giải đọc thoải mái, dot nhìn thấy rõ mà không che mất khối? ("có" là đạt) [tiêu chí 7]
10. Cuộn xuống Bản đồ luồng và hàng nhân vật pixel: trông và cử động y như trước khi làm T-028? ("có" là đạt) [tiêu chí 9]
11. Chín ảnh ở `docs/screenshots/T-028/` thật sự thể hiện đúng tên trạng thái của chúng (ví dụ `dot-bad.png` có dot đỏ, `reduced-motion.png` không có dot)? ("có" là đạt) [tiêu chí 10]
