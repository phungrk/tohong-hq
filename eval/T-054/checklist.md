# T-054 checklist iPhone Safari thật (Capu tự kiểm)

Lý do dùng checklist: Chromium (eval tự động) không có thanh địa chỉ co giãn và thanh công cụ dưới của Safari iOS, không có `env(safe-area-inset-*)` thật, không có bàn phím ảo iOS. Eval tự động (`eval/T-054/check_ui.cjs`) đã đo phần "document là thứ cuộn" và mọi hành vi quanh nó; dòng nào dưới đây đỏ mà eval tự động xanh thì đó là khác biệt của Safari, ghi lại để thêm vào spec.

Cách kiểm chung: iPhone, Safari (không phải app đã thêm vào MH chính, trừ mục 12), mở bản đã deploy hoặc `npm run build && npm run preview -- --host` trên cùng mạng. Dữ liệu đủ dài để cuộn (đã qua Onboarding, có vài hạng mục ngân sách, vài chục khách). Mỗi dòng trả lời có/không; một "không" thì ghi dòng đó vào defect.

## A. Mong muốn chính của Capu

1. Ở tab Kế hoạch, vuốt nội dung lên (kéo ngón tay từ dưới lên). Thanh công cụ dưới của Safari ẩn đi và thanh địa chỉ thu gọn thành một dải nhỏ? ("có" là đạt)
2. Cùng lúc đó, nội dung app dài ra theo (thấy thêm được một đoạn nội dung ở đáy) và thanh tab của Tơ Hồng nằm sát đáy màn hình, không có khoảng trống giữa thanh tab và mép dưới? ("có" là đạt)
3. Vuốt nội dung xuống một chút: thanh địa chỉ và thanh công cụ dưới của Safari hiện lại? ("có" là đạt)
4. Lặp lại 1-3 ở Trang chủ, Ngân sách, Khách mời và trong một hạng mục ngân sách (trang con, ví dụ "Nhà hàng tiệc cưới"). Mỗi nơi đều thu gọn/ẩn được? ("có" cho cả bốn là đạt)
5. Chạm vào dải địa chỉ đã thu gọn: thanh địa chỉ bung ra lại, trang không nhảy vị trí? ("có" là đạt)

## B. Header, thanh tab, vùng an toàn

6. Khi cuộn, header (dòng có nút menu hoặc "Quay lại") luôn nằm sát đầu vùng nhìn thấy, không bị thanh địa chỉ che, không bị cắt chữ? ("có" là đạt)
7. Ở cuối trang, dòng nội dung cuối cùng nằm trọn phía trên thanh tab (không bị thanh tab che)? Thử cả Kế hoạch, Khách mời và trang con. ("có" là đạt)
8. iPhone có thanh Home (không có nút Home): thanh tab có đệm dưới đủ để biểu tượng và chữ không dính vào thanh Home, cả khi thanh công cụ Safari ẩn lẫn khi hiện? ("có" là đạt)
9. Xoay ngang rồi xoay dọc lại: thanh tab vẫn sát đáy, không có dải trống, không chồng lên nội dung? ("có" là đạt)

## C. Vị trí cuộn và Back

10. Cuộn Kế hoạch xuống giữa, chạm tab Ngân sách, cuộn xuống một đoạn, chạm lại tab Kế hoạch: về đúng chỗ đã cuộn, không nhảy lên đầu rồi mới xuống? ("có" là đạt)
11. Vuốt từ mép trái (Back của Safari) qua lại giữa các tab và giữa danh sách Ngân sách với một hạng mục: mỗi nơi về đúng chỗ đã cuộn; vuốt tới (Forward) cũng đúng? ("có" là đạt) Thanh địa chỉ có hiện ra/giật khi Back không? (ghi chú, không tính đạt/không)
12. Thêm vào MH chính, mở từ biểu tượng (không có thanh Safari): header không bị đè bởi thanh trạng thái (giờ, pin), thanh tab không chồng lên thanh Home, cuộn bình thường? ("có" là đạt)

## D. Lớp phủ

13. Cuộn Trang chủ xuống một đoạn, chạm nút mời ("Mời người ấy / gia đình cùng xem"): sheet hiện sát đáy, vuốt trên lớp tối hoặc trên sheet không làm trang phía sau trôi? Đóng sheet: trang về đúng chỗ, không nhảy? ("có" là đạt)
14. Mở ngăn kéo menu ở giữa trang, vuốt cố kéo nền: nền đứng yên? Đóng ngăn kéo (nút Đóng hoặc Back): nền ở đúng chỗ cũ? ("có" là đạt)
15. Mở chat AI từ giữa trang, gõ vào ô nhập: bàn phím ảo hiện, ô nhập vẫn thấy được ngay trên bàn phím, danh sách tin nhắn cuộn được, nền phía sau không trôi? Đóng chat: nền ở chỗ cũ? ("có" là đạt)
16. Khi chat đang mở, vuốt nhanh cho danh sách tin nhắn trôi tới đầu/cuối rồi vuốt tiếp: nền phía sau không bị kéo theo ("cuộn chuyền")? ("có" là đạt)
17. Khi thanh Safari đã ẩn (đã cuộn xuống), mở rồi đóng một sheet: thanh Safari không tự hiện ra và sheet không bị lệch khỏi đáy màn hình? ("có" là đạt)

## E. Khối gợi ý cài app (iPhone chưa cài)

18. Khối "Thêm Tơ Hồng vào màn hình chính" vẫn nằm ngay trên thanh tab, không che chữ cuối của trang khi cuộn tới cuối? Khi mở lớp (sheet, ngăn kéo, chat) khối ẩn, đóng lớp khối hiện lại? ("có" là đạt)
