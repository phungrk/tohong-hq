---
type: insight
date: 2026-11-06
source: spec-critic chạy thử T-073 (handoffs/T-073-D1.md); Product kiểm lại độc lập (python3 -I, bản sao trong scratchpad, không đụng repo)
confidence: high (số đếm), medium (nguyên nhân)
---
# Lệch giá giữa dữ liệu scrape và vendor pool (phát hiện khi làm T-073)

**Phát hiện:** `price_range` trong `tohong/tools/scraper/output/HCMC/*/vendors.json` không còn khớp giá trong `tohong-back/lib/vendorPool.generated.js` @6a9a9c7. Chạy generator đầy đủ (`build_pool.py` → `generate-vendor-pool.js`) trên dữ liệu scrape hiện tại cho cùng 968 vendor, cùng thứ tự, nhưng **36 vendor đổi giá** (priceMin đổi ở 35, priceMax đổi ở 36); các trường khác không đổi. Phân bố: venue 9, ceremony 5, decor 5, stationery 4, makeup 3, transport 3, jewelry 3, honeymoon 2, photography 2.

**Ví dụ** (triệu VND, pool @6a9a9c7 → tạo lại từ dữ liệu scrape):
- marry_9d6993dd9e74 (ceremony, MIDO WEDDING): 5–15 → 2–933,4
- marry_b0ae3d24b8b0 (ceremony, Casalana): 38,3 → 2–903,4
- marry_069294535f2c (photography, Wedding Longart): 15–30 → 13–4.900.000
- marry_5b7c3ea66396 (decor, Áo cưới TRẮNG): 10–50 → 1–3.500.000
- marry_cba0811072c7 (ceremony): 3 → 5–15 (chiều ngược lại: giá thật bị thay bằng mặc định danh mục)

27/36 vendor sẽ có priceMax ≥ 200 triệu nếu tạo lại, nhiều giá hiển nhiên vô lý (hàng triệu triệu). Ảnh hưởng nếu lọt vào pool: gợi ý vendor và tính ngân sách sai; vi phạm "không bịa giá" (docs/product/vision.md).

**Nguyên nhân (chưa xác nhận):** pool @6a9a9c7 có vẻ được sinh từ một bản dữ liệu scrape khác, hoặc giá đã được chỉnh ngoài đường generator; `output/pool-vendors.json` không được commit nên không tái tạo đúng được. Chưa tìm commit nào giải thích.

**Quyết định đã có:** ADR-025: T-073 chỉ đổi `styles`/`tags` của pool (đường `tools/regen-pool-styles.sh`, giữ mọi trường khác), không đụng giá.

**Hướng xử lý đề xuất:** mở một ý định riêng, **bậc C** (giá vendor là dữ liệu cặp đôi thấy và tính tiền; Capu đọc diff giá rồi tự merge): (1) làm rõ nguồn nào đúng cho 36 vendor (scrape hay pool); (2) làm sạch `price_range` vô lý ở bước scrape/normalize, không vá ở pool; (3) khi đó mới tạo lại pool đầy đủ, diff giá liệt kê từng vendor. Chưa mở issue: chờ Chief of Staff theo ADR-025.
