# ADR-139: Pool nhận priceSource "verified"; INV-A/INV-B v2

Ngày: 2026-11-20 · Người quyết: Chief of Staff (theo ADR-138 của Capu) · Việc: T-217

## Bối cảnh
tohong-back chỉ nhận 3 nguồn giá: legacy_marry, estimate_category, estimate_default. Vendor có `priceSource: "verified"` vì vậy:
- không có nhãn giá;
- bị so giá/bàn với ngân sách tổng.

Bình Quới 2 đang bị như vậy trên production. planner/vendor inv-001 (INV-A) và inv-002 (INV-B) đang đỏ trên main vì vendor này.

## Quyết định
- T-217 mở rộng sang tohong-back:
  - `priceSource: "verified"` → `price_basis: "source_verified"`, nhãn "Giá đã xác minh", không có `price_as_of`.
  - Không tính là ước tính.
  - Venue tính giá theo bàn.
- INV-A v2 cho một ngoại lệ có chủ đích. Một hạng mục có vendor verified mà còn dưới 10 mẫu legacy_marry thì chấp nhận khung `estimate_category` cũ, miễn nhất quán. Tính lại khung là việc của pipeline, nằm ngoài phạm vi.
- INV-B v2 thêm `source_verified`.
- Hai bản v1 hết hiệu lực khi PR back của T-217 merge. Chief đổi bể bất biến ngay trước lần chạy gate cuối, giống cách làm ở ADR-126 và ADR-137.
- Thứ tự merge: PR back → PR dữ liệu tohong → Sync. Pool verified không được lên production trước PR back.
- Nhãn "Giá đã xác minh" trùng với giá admin duyệt tay. Cặp đôi sẽ không phân biệt được hai loại. Điều này đã nêu cho Capu trong diff hành vi.
