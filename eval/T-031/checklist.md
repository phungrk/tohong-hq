# T-031 checklist nhìn (máy không đo được "trông có sinh động không")

Lý do dùng checklist: các câu dưới đây là cảm nhận thị giác (sinh động, dễ phân biệt vai, đồng phong cách, dễ đọc) mà `eval/T-031/model-characters.cjs` không đo được. Phần đo được (đúng khối, trạng thái, opacity, `lamp`, cử động ≥ ngưỡng, thời lượng, chữ bong bóng, trần 3 bong bóng, reduced-motion, 390px, tương phản, hiệu năng, T-019 không đổi) đã nằm ở eval tự động, không lặp lại ở đây.

Cách kiểm chung: mở dashboard (bản PR hoặc `index.html` mở bằng trình duyệt), cuộn tới bảng "Mô hình Eval-Gated 2029". Muốn có sự kiện mà không đợi sổ cái thật: mở `index.html?live=<địa chỉ Worker thử>` và gửi sự kiện thử, hoặc xem ảnh tham chiếu `docs/screenshots/<task>/*.png` (11 ảnh do `bash eval/T-031/run.sh <repo> --task <task> --shots` chụp lúc đang cử động) và so với `scratchpad/mov/robots2.png` của video Capu.

Mỗi dòng trả lời có/không. Một "không" ở dòng nào thì ghi dòng đó vào defect (`--against` tiêu chí tương ứng).

1. Nhìn `work.png` rồi `work-2.png`: hai ảnh cho thấy nhân vật ở hai tư thế khác nhau (nhún, tay gõ), giống ý "nhún, đèn chớp, mồ hôi" trong video? ("có" là đạt) [tiêu chí 3]
2. Nhìn `give.png`: thấy rõ nhân vật lao về phía khối đích, ôm giấy, có vệt tốc độ phía sau; chiều lao đúng chiều của đường dot? ("có" là đạt) [tiêu chí 4]
3. Nhìn `take.png`: nhân vật nhảy lên đón giấy, khác hẳn `give.png` và `work.png` ở cái nhìn đầu tiên? ("có" là đạt) [tiêu chí 4]
4. Nhìn `idle.png`: toàn bảng mờ, yên, mắt nhắm hờ; có biết ngay "không ai làm gì" mà không cần đọc số? ("có" là đạt) [tiêu chí 2]
5. Nhìn `wait.png` (Capu chờ quyết): thấy dấu `?`, tư thế khác `work`, màu đèn đỏ; có biết ngay "đang chờ Capu" mà không cần đọc chữ? ("có" là đạt) [tiêu chí 6]
6. Nhìn `bubble.png`: bong bóng đọc được, không che chữ quan trọng quá lâu, không dày đặc (tối đa 3)? ("có" là đạt) [tiêu chí 5]
7. Trong ảnh động thật (mở trang, bắn một sự kiện): cử động giao và nhận có nhịp "sprite" (giật theo bước) giống nhân vật T-019 ở Bản đồ luồng, không mượt kiểu khác hẳn phong cách? ("có" là đạt) [tiêu chí 3, 4]
8. Mười một nhân vật có phân biệt được vai (Spec Writer, Spec Gate, Agent code, Code Gate, Insight, thủ thư bể, bot Production, Capu, Ý định) nhờ một đồ phân biệt (bút, kính lúp, mũ bảo hộ, vương miện...) hoặc dáng? ("có" là đạt) [tiêu chí 1]
9. Pixel art cùng phong cách với nhân vật T-019 (khối vuông, viền cứng, không bóng mờ), và không giống nhân vật hay màu của sản phẩm trong video? ("có" là đạt) [tiêu chí 1]
10. Chế độ tối (`dark.png`, `dark-work.png`): nhân vật rảnh vẫn nhìn thấy mờ mờ (không biến mất), nhân vật làm việc nổi trên nền khối? ("có" là đạt) [tiêu chí 8]
11. 390px (`phone-390.png`): nhân vật đủ lớn để nhận ra hình bot/người, bong bóng đọc được, không che mất số đếm của khối? ("có" là đạt) [tiêu chí 8]
12. Bật giảm chuyển động của hệ điều hành rồi tải lại (`reduced-motion.png`): không có gì cử động nhưng vẫn nhận ra ai đang giao/nhận nhờ độ sáng, màu đèn và bong bóng? ("có" là đạt) [tiêu chí 7]
13. Dồn nhiều sự kiện cùng lúc (chạy vài lệnh `task.py` liên tiếp): bảng có rối, nhân vật nhảy loạn khó theo dõi không? ("không" là đạt) [tiêu chí 4, 5]
14. Cuộn xuống Bản đồ luồng và hàng nhân vật pixel: trông và cử động y như trước khi làm T-031? ("có" là đạt) [tiêu chí 11]
15. Mười một ảnh ở `docs/screenshots/<task>/` thật sự chụp lúc đang cử động đúng tên trạng thái (ví dụ `give.png` thấy nhân vật đã lệch khỏi chỗ ngồi, `reduced-motion.png` thấy nhân vật đứng đúng chỗ ngồi)? ("có" là đạt) [tiêu chí 12]
