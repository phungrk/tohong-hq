---
type: decision
id: ADR-025
date: 2026-11-06
decided_by: chief-of-staff (phân xử sau Spec Gate T-073)
tasks: [T-073]
---
# T-073: tạo lại pool chỉ được đổi `styles`; lệch giá trong dữ liệu scrape tách thành việc riêng

**Bối cảnh:** Spec critic chạy thử đường tạo lại pool của spec T-073 (`handoffs/T-073-D1.md`): `minimalist` giảm đúng (124 → 6) nhưng `priceMin`/`priceMax` của 36 vendor đổi theo, vì `price_range` trong `tools/scraper/output` đã lệch so với `vendorPool.generated.js` @6a9a9c7 (ví dụ marry_9d6993dd9e74: 5–15 → 2–933,4 triệu). Giá là thứ cặp đôi thấy và "không bịa giá" đứng đầu bảng ưu tiên trong `docs/product/vision.md`; T-073 ở bậc A sẽ tự merge mà không ai đọc diff giá.

**Quyết định:**
1. Trong T-073, pool tạo lại phải **giống pool @6a9a9c7 ở mọi trường trừ `styles`**. Cách đạt được do Product chọn trong spec rework (tính lại `style_tags` rồi ghép vào pool cũ, hoặc generator nhận cờ chỉ cập nhật styles), nhưng phải là bước tái lập được bằng lệnh, không sửa tay file pool.
2. Lệch giá giữa dữ liệu scrape và pool là một phát hiện dữ liệu: ghi vào `insights/` và mở issue ý định riêng; mọi thay đổi giá vendor đi qua việc bậc C, Capu đọc diff.
3. Lỗi minor 2 (extractor có đọc `style_tags` hiện có không): Product chọn một cách, ưu tiên giữ tín hiệu tên gói từ `sources/marry.py`, và khoá bằng eval.
4. Lỗi minor 3: eval tầng 1 đo hành vi qua đầu vào/đầu ra của pipeline, không gọi hàm nội bộ.

**Hệ quả:** T-073 vẫn bậc A. Việc riêng về giá chưa tạo cho tới khi Insight ghi phát hiện.
