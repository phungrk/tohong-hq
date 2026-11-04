# T-059 checklist iPhone thật (Capu tự kiểm): vùng trên cùng màu giấy

Lý do dùng checklist: Chromium không có thanh trạng thái, không tô màu theo phần tử fixed như Safari 26. `eval/T-059/check_tint.cjs` chỉ kiểm điều kiện cần (không phần tử fixed nền sẫm ở mép trên); màu thật chỉ iPhone trả lời được. Mỗi dòng có/không; một "không" thì chụp ảnh gửi lại.

## A. Safari iOS (kiểu thanh nổi dưới như ảnh lỗi)
1. Mở app, tab Ngân sách, đầu trang, không lớp nào mở: dải giờ/sóng/pin màu giấy (kem sáng như nền trang), không xám?
2. Làm lại dòng 1 ở Trang chủ, Kế hoạch, Khách mời?
3. Cuộn xuống giữa trang rồi nhìn dải trên ở mỗi tab: vẫn màu giấy?
4. Mở rồi đóng chat AI (nút AI): sau khi đóng xong, dải trên về màu giấy?
5. Mở rồi đóng ngăn kéo menu, sheet "Mời người ấy", sheet "Thêm việc": mỗi lần đóng xong, dải trên màu giấy?
6. Khi mở chat AI / ngăn kéo: lớp tối vẫn hiện và mờ dần như trước? Đóng lại cũng mờ dần?
7. Khi lớp đang mở, dải trên sẫm theo lớp tối là chấp nhận (không bắt buộc giấy).
8. Thanh tab ở đáy, Back, vị trí cuộn: như trước (T-054/T-056 không đổi)?

## B. Chrome iOS (một dòng)
9. Mở app trên Chrome iPhone, đầu trang bốn tab và sau khi mở rồi đóng chat AI: vùng trên cùng màu giấy, thanh tab dưới vẫn thấy trọn?

## Nếu dòng 1 "không" mà eval tự động xanh
Chụp ảnh, ghi iOS và kiểu thanh Safari (nổi dưới hay trên). Áp "Luật quyết" trong `products/T-059-safari-thanh-tren-xam.md`.
