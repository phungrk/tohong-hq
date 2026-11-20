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

## Đã sửa inv-004/005/006
Adversary sửa phần dựng tình huống (2026-11-20), theo điểm 6 ở trên và cách làm ADR-131. Không đổi câu kiểm nào, không sửa repo sản phẩm.

**Thay đổi.**
- Thêm `eval/invariants/planner/vendor/_twin.mjs` (không bắt đầu bằng `inv-` nên gate không chạy nó như bất biến). Hàm `makeTwins(arr, cat, n, used)` lấy n vendor thật của hạng mục theo thứ tự id, giữ id và tên thật, chép mọi trường khác từ vendor có id nhỏ nhất của hạng mục, rồi đặt đúng các trường bộ lọc cũ đòi: `rating 0`, `reviewCount 0`, `styles []`, `tags []`, `isVerified`, `HCMC`, đủ 12 tháng; venue có sức chứa 100–300 như twin cũ. Chỉ sửa mảng pool trong bản sao tạm (`stampedBack.mut`).
- Ba thân bất biến đổi đúng một dòng chọn twin (bộ lọc `rating === 0 && styles.length === 0 …` thành `makeTwins(arr, "venue", n)`) và thêm một dòng import: `eval/T-183/thay-the/inv-004-check_8.mjs` (inv-004), `eval/T-183/thay-the/inv-005a.mjs` và `eval/T-178/thay-the/inv-005b.mjs` (inv-005).
- `inv-006-…mjs`: không gọi `L.twinBack` của khung T-172 nữa, dùng hàm `twinBack` cục bộ giống hệt trừ cách chọn (dùng `makeTwins`). Khung `eval/T-172/_lib.mjs` không sửa.

**Bằng chứng** (`env -i` từ /tmp; back main 0f69f10):
- Trên main: trước khi sửa cả ba ném TypeError trong phần dựng; sau khi sửa cả ba PASS.
- Phá trong bản sao tạm của back, sau khi sửa:
  - `vendorBudgetScore` bỏ `× tables`: inv-004 FAIL ("điểm R1 mong 0,25, thấy 1", +7).
  - Tab Vendor đọc `preferences.guest_count` trước: inv-005 FAIL (005a chip "× 15 bàn", 005b chạy riêng cũng FAIL).
  - Bỏ dòng cờ ngân sách trong khối chat: inv-006 FAIL ở phần chat.
  - `estimated = false` trong câu AI ở `api/vendors.js`: inv-006 FAIL ở phần câu AI.
  - Mỗi lần phá chỉ làm đỏ đúng bất biến nó nhắm.
- Trên pool trước T-216 (`d2c6fa8~1`), bản gốc và bản sửa cho cùng kết quả ở cả 5 trạng thái (sạch và 4 lần phá), cùng dòng FAIL và cùng số lỗi. Phần dựng mới không nới bất biến.

**Cùng kiểu, chưa đỏ, không sửa.** inv-003 chạy `eval/T-172/check_7_inv003_ban_thay_the.mjs`, cũng lọc twin `rating === 0 && styles.length === 0`, ở hạng mục photography. Hiện còn 14 vendor photography thoả, nên nó sẽ đỏ theo cùng cách nếu một lần Sync làm giàu styles cho ảnh. `eval/T-159/_lib.mjs` `twins()` có cùng bộ lọc, nhưng không bất biến nào của planner/vendor gọi nó.

## Đã merge (2026-11-21)
Thứ tự đúng: back → dữ liệu → Sync. Chief merge theo ADR-138 bổ sung (Capu "merge luôn khi xong").
- phungrk/tohong-back#75 → ac1586f (T-218, back hiểu nguồn giá verified).
- phungrk/tohong#111 → 1a14632 (85 venue verified, 64 giá verified).
- Sync run 44838396035 (xanh) → phungrk/tohong-back#76 → 2f2321e.

Gate T-218 trước merge: GREEN, sau khi đổi bể bất biến (bỏ planner/vendor inv-001/002 v1, thay bằng v2).

Bể bất biến sau merge (chạy `env -i` từ /tmp trên main, đều PASS):
- planner/vendor inv-001 v2, inv-002 v2.
- inv-008-nguon-gia-cap-doi-khop-nhan-xac-minh (mới).
- pool/inv-009-pool-verified-khop-nguon (mới).
- pool inv-001..008.

Kiểm thực tế: Bạch Kim (marry_5ec257b82f96) trong pool có giá 3.4–3.4 verified, sức chứa 100–3000, mô tả AI Mode.

Nợ còn lại:
- admin/vendor-enrich inv-006 cần thêm 4 mục catalog: capacity_min, capacity_max, capacity_unit, verification_status.
- admin/vendor-enrich inv-014 đỏ từ #108.
- images inv-014: Garden Plaza có ảnh Google mà không có place_id.
- Silver Creek và Villa Sông Sài Gòn bị pool xếp vào hạng mục honeymoon.
- PR back#73 (Sync cũ) nên đóng.
