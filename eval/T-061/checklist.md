# Checklist T-061 (máy đọc được, có/không). Chỉ phần eval tự động không phủ.
Lý do dùng checklist: thẻ so sánh vendor (`VPickerMultiChatCard`) chỉ mở được sau 3 bước chat (gợi ý, mở chi tiết vendor, bấm so sánh) với dữ liệu ảnh/giá thật; harness giả không dựng ổn định luồng này. Làm trong Chromium hoặc iPhone, khung 390.

1. Mở một vendor ở thẻ gợi ý chat, bấm "So sánh". Trong lúc API `/api/vendors/match` trễ (devtools throttle hoặc API giả 1,5s), thẻ so sánh có khối skeleton hàng vendor (ảnh vuông 40 + 2 dòng), không còn chữ "Đang tải các vendor khác…"? (có/không)
2. Vùng chờ đó có vai trò `status` tên "Đang tải…" và `aria-busy="true"` (kiểm bằng cây truy cập của devtools)? (có/không)
3. Nhấn Tab khi đang chờ, focus không rơi vào khối skeleton? (có/không)
4. Hàng vendor thật đầu tiên hiện đúng chỗ hàng skeleton đầu (không nhảy quá 4px)? (có/không)
5. API trả lỗi: vẫn hiện "Không tải được danh sách. Thử lại sau giúp Tơ Hồng nhé." và skeleton biến mất? (có/không)
6. Bật `prefers-reduced-motion: reduce` (devtools Rendering): skeleton đứng yên? (có/không)
