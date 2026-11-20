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

## Bổ sung (2026-11-20): Chief phân xử D1 của Spec Gate (T-217)
1. **Admin.** Dòng vendor ở admin hiện đúng nguồn của pool. Với nguồn verified:
   - `price_basis: "source_verified"`.
   - Nhãn "Giá đã xác minh (nguồn)". Chữ khác với nhãn của cặp đôi để Capu phân biệt với giá admin tự duyệt (overlay).
   - Trường `price_source` của dòng admin mang giá trị mới `"source_verified"`, không còn là `"estimated"`.
   - Bộ lọc "verified" ở admin vẫn chỉ nghĩa là overlay `price_verified`, không đổi. Bộ lọc legacy_marry tự mất các venue đã chuyển sang verified, như vậy là đúng.
   - Sự kiện `vendor_viewed` ghi `price_verified: true` khi basis là `admin_verified` hoặc `source_verified`.
   - Phải có eval cho dòng admin và cho sự kiện.
2. **Thiskyhall Sala (`marry_f8b40ba4ddef`).**
   - Nằm trong S: đánh dấu verified để mô tả và sức chứa AI Mode vào pool.
   - Không đổi `price_source`, vì ghi chú AI Mode tự nói giá "chưa đủ tin cậy". Nhãn "Giá đã xác minh" không được gắn cho một giá mà chính nguồn tự nhận chưa đủ tin.
   - Luật chung: bản ghi mà `note` hoặc `verification_notes` của dòng AI Mode cho biết giá chưa đủ tin cậy thì không đổi giá. Spec phải định nghĩa luật này để máy kiểm được.
   - Sửa lý do loại trong spec cho đúng với dữ liệu.
3. **Ai merge.** Capu đã cho phép rõ ràng ("merge luôn khi xong", ADR-138 bổ sung). Tiền lệ: ADR-117/122/126. Spec phải ghi Chief merge theo sự cho phép đó.
4. **Diff hành vi.** Phải nêu tác dụng phụ khi cào lại (`merge.py` vẫn ghi đè `price_range` và `description` của vendor verified khi lần cào có dữ liệu).
5. **Bất biến đề xuất.** Cả ba phải dò ngược tới `scripts/gate.py` theo ADR-070.
6. **planner/vendor inv-004/005/006 đỏ trên main.** Fixture của chúng chọn venue có styles rỗng, mà từ Sync T-216 pool không còn venue nào như vậy. Đây là sự cố bể, sửa phần dựng tình huống giống ADR-131, tách khỏi T-217.
