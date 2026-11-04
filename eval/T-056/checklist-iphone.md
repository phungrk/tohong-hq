# T-056 checklist iPhone thật: Chrome iOS và Safari (Capu tự kiểm)

Lý do dùng checklist: Chromium không có thanh công cụ dưới của Chrome iOS hay Safari, không có `env(safe-area-inset-bottom)` thật. Eval tự động (`eval/T-056/check_vv.cjs`) chỉ kiểm cơ chế bù theo visualViewport bằng đối tượng giả; có đúng với Chrome iOS thật hay không chỉ máy thật trả lời được. Mỗi dòng có/không; một "không" thì chụp ảnh và ghi số đo (mở `?vvdebug=1`).

## Chuẩn bị
0. Mở `https://<bản deploy>/?vvdebug=1#/ngan-sach` trên Chrome iPhone, thanh Chrome đang hiện. Chụp HAI ảnh màn hình: (a) ở đầu trang, (b) cuộn tới cuối Ngân sách. Dòng số đo hiện ở mép trên: `innerHeight`, `vv.height`, `vv.offsetTop`, `vv.scale`, `100svh`, `100lvh`, `100dvh`, `safe-bottom`, `bù`, `dpr`, `scrollY`, `maxScroll`, `tab.top`, `tab.bottom`, `ua`. Đổi pixel ảnh sang CSS px: `y_css = y_px_ảnh / dpr` (ảnh 1179x2556 thì dpr 3). Đọc mép trên thanh Chrome `M` trong ảnh, đổi ra CSS px, so với `tab.bottom`. Gửi hai ảnh; Chief of Staff áp "Luật quyết" trong `products/T-056-chrome-ios-thanh-tab.md`. Dòng này không đạt/không đạt: chỉ thu số đo.

## A. Chrome iOS (bắt buộc, lỗi gốc của T-056)
1. Ngân sách, cuộn tới cuối: thấy trọn thanh tab (Trang chủ, Kế hoạch, Ngân sách, Khách mời) ngay trên thanh công cụ dưới của Chrome, không bị đè?
2. Dòng cuối ("Thêm hạng mục") nằm trọn phía trên thanh tab?
3. Cùng kiểm 1 ở Trang chủ, Kế hoạch, Khách mời và một trang con (vd "Nhà hàng tiệc cưới")?
4. Giữa trang và đầu trang: thanh tab vẫn thấy trọn?
5. Vuốt để Chrome thu thanh công cụ (nếu thu được): thanh tab đi theo xuống sát đáy, không để khoảng trống lớn? Vuốt lại cho thanh hiện: thanh tab lên theo?
6. Ở đầu trang (iPhone, chưa cài app): khối gợi ý cài nằm ngay trên thanh tab, cả hai đều trọn?
7. Chạm vào một ô nhập (ô tìm khách, ô chat) ở Chrome iOS: bàn phím hiện, thanh tab KHÔNG nhảy lên (nằm sau bàn phím như T-055, hành vi 8), ô đang nhập không bị thanh tab che? Đóng bàn phím: thanh tab về sát trên thanh Chrome? (có cho cả hai là đạt)
8. Khoảng trống giữa thanh tab và thanh Chrome: không thấy? (nếu có dải trống > 8px dưới thanh tab, ghi lại số đo)
9. Back: cuộn Kế hoạch xuống giữa, đổi tab, vuốt Back/chạm "←" của Chrome: về đúng chỗ cuộn như trước T-056?

## B. Safari iOS (không đổi so với T-055)
10. Làm lại dòng 1-3 ở Safari (kèm dòng 7: chạm ô nhập, thanh tab không nhảy lên): thanh tab sát đáy màn hình khi thanh Safari ẩn, và ngay trên thanh Safari khi hiện; không có dải trống?
11. Chạy lại toàn bộ `eval/T-054/checklist.md` mục A-C ở Safari: không dòng nào đổi từ "có" sang "không"?
12. Thêm vào MH chính, mở từ biểu tượng: thanh tab sát đáy, đệm vùng an toàn như T-055?

## C. Quy tắc cho mọi việc layout sau này (đề xuất, xem spec T-056 mục "Bất biến đề xuất")
13. Mọi việc đổi layout/khung/dính (sticky, fixed, 100vh/dvh, safe-area) phải có dòng "đã thử trên Chrome iOS: có/không" trong bàn giao trước khi Capu merge.
