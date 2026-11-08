# Spec T-111: enrich-toan-bo-vendor

## Ý định
Capu (ADR-049, 2026-11-08) muốn mọi vendor còn dùng ảnh marry.vn (đã chết từ 2026-11-03) được tra trên Google Maps ngay trong tháng 11, tổng chi tối đa $30: có trên Maps thì giữ và lấy ảnh Google; không có thì thử một lần với tên rút gọn rồi gỡ (khôi phục được); tạm đóng cửa thì ẩn khỏi app; đóng vĩnh viễn thì gỡ; khớp lưng chừng thì đưa Capu duyệt, không gỡ. Nguồn: `board/T-111.md`, `decisions/2026-11-08-adr-049-enrich-toan-bo-vendor.md`, `products/T-106-enrich-venue.md` (v4.1, sáu cổng), `products/T-110-duyet-tay-venue.md` (trạng thái tạm đóng cửa, file duyệt tay, `--restore`), `handoffs/T-110-D1.md`.

## Bằng chứng
Đo 2026-11-08 trên `tohong` main (386392c) thư mục `tools/scraper/output/HCMC/` và `tohong-back/lib/vendorPool.generated.js`; đếm lại được bằng `check_1`.

**Phạm vi (một vendor = một id; cùng id ở nhiều category file là MỘT vendor, tính vào category đầu tiên theo thứ tự chạy ở mục "Thứ tự ưu tiên"):**

| Category file | Bản ghi | Vendor (id duy nhất) | Id trùng với file trước | Đã có place_id | Có dòng audit | **Cần tìm (eligible)** | Trong đó trong pool | Ngoài pool |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| venue | 94 | 94 | 0 | 62 | 94 | 0 (+4 chỉ thử lại rút gọn, xem dưới) | 0 | 0 |
| photography | 97 | 95 | 2 | 71 | 0 (*) | 24 | 24 | 0 |
| wedding_attire | 100 | 87 | 13 | 0 | 0 | 87 | 87 | 0 |
| makeup | 100 | 89 | 11 | 0 | 0 | 89 | 89 | 0 |
| flower | 100 | 99 | 1 | 0 | 0 | 99 | 99 | 0 |
| wedding_interior | 49 | 46 | 3 | 0 | 0 | 46 | 46 | 0 |
| ceremony | 100 | 96 | 4 | 0 | 0 | 96 | 96 | 0 |
| invitation | 100 | 99 | 1 | 0 | 0 | 99 | 99 | 0 |
| wedding_gift | 100 | 91 | 9 | 0 | 0 | 91 | 91 | 0 |
| wedding_ring | 65 | 65 | 0 | 0 | 0 | 65 | 65 | 0 |
| wedding_car | 47 | 46 | 1 | 0 | 0 | 46 | 46 | 0 |
| honeymoon | 56 | 53 | 3 | 0 | 0 | 53 | 53 | 0 |
| wedding_planner | 100 | 79 | 21 | 0 | 0 | 79 | 0 | 79 |
| other | 100 | 81 | 19 | 0 | 0 | 81 | 0 | 81 |
| **Tổng** | **1.208** | **1.120** | **88** | **133** | **94** | **955** | **795** | **160** |

- Pool tohong-back hiện 960 vendor (10 category pool: stationery 191, decor 142, ceremony 100, makeup 98, venue 91, photography 87, attire 85, jewelry 65, honeymoon 56, transport 45); 128 có ảnh Google (venue 60, photography 60, makeup 7, honeymoon 1), **832 còn ảnh marry.vn**. Cách đo "trong pool" từ nguồn: id có `categories` (gộp mọi file) giao tập `MATCHER_CATS` của `tools/generate-vendor-pool.js`; đúng 960/960 so với pool thật (giao khớp, 0 lệch).
- 160 vendor ngoài pool (toàn bộ `wedding_planner` 79 và `other` 81 không thuộc category pool) **không hiện trên app**, nên tìm chúng tốn tiền mà cặp đôi không thấy gì: mặc định **ngoài phạm vi** (`include_non_pool=false`), chỉ chạy khi Capu bật.
- (*) `photography/enrichment-audit.json` có 29 dòng nhưng dùng id cũ (`marry_photography_…`), 0 dòng khớp id hiện tại: coi như **chưa có audit**. 24 vendor photography chưa có place_id (enrich tháng 5–6 không có log của họ) sẽ được tìm lần đầu. Tự tin ~70% rằng một phần trong 24 từng được thử và `no_match` mà log không còn.
- **Chỉ thử lại rút gọn (4):** `venue/enrichment-audit.json` có 6 dòng `no_match`; 2 trong đó là Én (`marry_d4380c0b3cf3`, duyệt tay nhận) và Tự Do (`marry_e38f1e755f9c`, duyệt tay loại) do T-110 xử lý, còn 4 (`marry_f554315c63a7`, `marry_ef5456500d0e`, `marry_cd0998479977`, `marry_4746352cf425`) là dòng `no_match` cũ không có trường `attempts` = đã thử 1 lần.
- 26 venue `low_confidence` giữ nguyên (đi review, ADR-049 mục 2 cuối).
- 4 vendor đã có place_id mà chưa có ảnh Google (photography): ngoài phạm vi (xem "Không làm").
- Mẫu tỉ lệ để ước tính (suy ra từ venue, **giả định** áp cho category khác, tự tin ~50%): nhận khớp 62/94 = 66%, `low_confidence` 26/94 = 28%, `no_match` 6/94 = 6%; photography 73/97 = 75% có place_id (data tháng 6). Category toàn cá nhân/cửa tiệm nhỏ (makeup, áo cưới, quà) nhiều khả năng khớp thấp hơn và `no_match` cao hơn venue.
- Chi phí: lần chạy T-106 thật (log `tools/scraper/run-logs/T-106/`): Text Search 99, ảnh 50 + 156 (52 Place Details + 104 media). Giá và hạn mức: xem "Chi phí".
- Không có dữ liệu "category nào người dùng xem nhiều": `insights/2026-11-06-weekly.md` ghi 11 `vendor_viewed` trong 30 ngày, đều của một người. Thứ tự ưu tiên dưới đây là **GIẢ ĐỊNH, tự tin ~50%** (theo tầm quan trọng của hạng mục trong ngân sách cưới và số vendor trong pool).

## Giả thuyết
Nếu chạy luật ADR-049 cho 795 vendor trong pool thì vendor trong pool có ảnh Google đi từ 128/960 lên khoảng 128 + 480 (kỳ vọng, khoảng 128 + 320 đến 128 + 600), card các hạng mục hết "Ảnh minh hoạ" ở phần lớn vendor, và vendor không tồn tại hay đóng cửa không còn hiện trên app. Chỉ số bảo vệ: chi thật ≤ $30; không vendor nào hiện ảnh của nơi khác (INV-015..019 xanh); không vendor nào bị gỡ mà không khôi phục được.

## Hành vi (người dùng thấy gì)
"Người dùng" gồm cặp đôi (xem card vendor trên app) và Capu (bấm chạy, đọc báo cáo, merge hai PR).

### 1. Luật cho mỗi vendor
Mỗi vendor trong phạm vi được Text Search (truy vấn "<tên> <địa danh>", địa danh như hôm nay: Quận N / HCM / đoạn cuối địa chỉ). Kết cục theo kết quả Google, xét theo thứ tự:

| Kết quả Google | Kết cục | Vendor trong `vendors.json` | Trong pool app | Ảnh |
| --- | --- | --- | --- | --- |
| Ứng viên qua **sáu cổng** (G1..G6, T-106 v4.1, **không đổi**), `businessStatus` OPERATIONAL hoặc vắng | **giữ**: `place_id`, `enriched` | còn | có | lấy tối đa `max_photos` ảnh (mặc định 2) từ chính kết quả Text Search, không Place Details |
| Ứng viên qua G1, G2, G3, G5 và `CLOSED_PERMANENTLY` | **gỡ** (ADR-044) | gỡ khỏi **mọi** category file có id đó | không | không. Vào `removed_vendors.json` (lý do chứa `CLOSED_PERMANENTLY`), vào tập G4 |
| Ứng viên qua sáu cổng và `CLOSED_TEMPORARILY` | **tạm đóng cửa** (trạng thái định nghĩa ở T-110 Hành vi 6, **dùng lại, không định nghĩa lại**) | còn, không `place_id` | **không** | không |
| Ứng viên bị một cổng từ chối | `low_confidence` + `reject_reason` (như T-106) | còn | còn (ảnh minh hoạ như hôm nay) | không. Đúng một dòng `review-needed.csv`. **Không remove, không thử lại tên rút gọn** |
| Google không trả gì (lần 1) | `no_match` lần 1 → thử lại rút gọn (Hành vi 2) | còn trong lúc chờ lần 2 | — | — |
| Lần 2 trả ứng viên | áp lại đúng các hàng trên (giữ, đóng cửa, tạm đóng, `low_confidence`) | như hàng tương ứng | | |
| Lần 2 vẫn không trả gì | **remove** | gỡ khỏi **mọi** category file có id đó, vào `removed_vendors.json` | không | không |
| Lỗi HTTP/timeout | `error`: **không** tính là đã thử, không remove, không ghi dòng audit nhận khớp/từ chối | còn | còn | không. Lần chạy sau tìm lại |

- **Trạng thái tạm đóng cửa** (dùng lại T-110): vendor còn trong `vendors.json`, **không có trong pool**, mỗi lần enrich đều thử lại, và khi Google báo OPERATIONAL mà vendor qua đủ sáu cổng thì nhận lại vào pool (có place_id và ảnh) và hết trạng thái. T-111 chỉ thêm: nguồn (ii) của T-110 (Google báo `CLOSED_TEMPORARILY` cho ứng viên đúng) áp cho mọi category.
- **Bản ghi remove do `no_match`**: `removed_vendors.json` của mỗi file bị gỡ có `{removed_at, reason, vendor}`, `reason` nêu `no_match` (ví dụ "no_match sau thử tên rút gọn"), **không chứa** `CLOSED_PERMANENTLY`, **không** `manual`; `vendor` = bản ghi nguyên vẹn (bằng nhau từng trường) trước khi gỡ. Dòng audit giữ: `status="no_match"`, `attempts=2`, `short_query` (chuỗi đã gọi, hoặc `null` khi không có lượt 2).
- **Tập G4 (nhà hàng đã gỡ) chỉ nhận vendor `CLOSED_PERMANENTLY` do Google báo.** Vendor bị T-111 gỡ vì `no_match` không vào tập G4 (kể cả lý do có chữ lạ): vendor khác cùng địa chỉ gốc không bị `same_address_as_closed` vì nó.
- **Đơn vị xử lý là id**: mỗi lần chạy mỗi id chỉ bị Text Search một lần (lượt 1) dù nằm ở nhiều category file; kết cục áp cho **mọi** file có id đó. Hiện `enrich.py` chạy theo từng file nên 88 id trùng sẽ bị tìm hai lần nếu không gộp: phải gộp.

### 2. Thử lại bằng tên rút gọn
- Chỉ khi lần 1 Google **không trả gì** (`no_match`). Đúng **một** lượt nữa, tổng một vendor ≤ 2 lượt Text Search mỗi lần "thử". Không bao giờ lượt thứ ba, kể cả chạy lại (dòng audit `attempts=2` hoặc vendor đã bị gỡ chặn).
- Truy vấn lượt 2 = `short_name(tên vendor)` + " " + cùng địa danh của lượt 1. **`short_name` là hàm chuẩn** `eval/T-111/_short.py` (bảng khoá `eval/T-111/short_name_cases.json`, 20 ca, kể cả tên thật như "Nhà hàng Tự Do - Khách sạn Viễn Đông" → "Tự Do"). Tóm tắt luật: (S1) bỏ nội dung trong ngoặc; (S2) cắt tại cụm đuôi {chuyên, tại, cho thuê}; (S3) bỏ cụm loại hình chung {nhà hàng, tiệc cưới, trung tâm, hội nghị, yến tiệc, khách sạn, công ty, cty, cửa hàng, tiệm, dịch vụ, chuyên nghiệp}; (S4) cắt tại phân cách đầu tiên {" - ", " – ", " | ", ": ", ", ", " & ", " + "}; mỗi bước chỉ nhận nếu kết quả còn ≥ 2 từ hoặc ≥ 8 ký tự chữ-số. Cài đặt của Engineering phải cho đúng kết quả của hàm chuẩn trên mọi ca trong bảng.
- Nếu `short_name` trả `None` (không rút gọn được, ví dụ "Mai House", "Pergola"): **không gọi lượt 2** (truy vấn sẽ y hệt lượt 1, Google trả như cũ), coi như lượt 2 `no_match` → remove. Đây là lựa chọn rủi ro đã biết: vendor tên ngắn mà Google không biết bị gỡ, khôi phục được bằng `--restore`.
- Dòng `no_match` cũ (từ T-106/T-108, không có `attempts`) = đã thử 1 lần: vendor còn trong `vendors.json` được thử **đúng 1 lượt** bằng tên rút gọn (hoặc 0 lượt nếu không rút gọn được) rồi theo bảng trên. 4 venue trong "Bằng chứng".

### 3. Tương tác với T-110 và luật "đã có audit thì không tìm lại"
1. **Duyệt tay thắng luật tự động.** Vendor có mục trong `tools/scraper/output/HCMC/manual_overrides.json` **không bao giờ bị luật T-111 gỡ**, kể cả khi `no_match` ở cả hai lượt. `accept_place` đã áp, `remove` không bị Text Search (T-110). `temporarily_closed` do Capu đánh dấu vẫn được thử lại mỗi lần, **gồm cả lượt rút gọn** (≤ 2 lượt mỗi lần chạy), và nếu vẫn không trả gì thì ở lại (không bị gỡ). Vendor Capu đã `remove` thì `--restore` bị chặn `still_overridden` (T-110).
2. **Đã có audit thì không tìm lại** (luật hiện có `ATTEMPTED_STATUSES`, giữ nguyên) với **hai ngoại lệ**: (a) dòng `retry=true` luôn được thử lại (T-110); (b) dòng `no_match` có `attempts` < 2 hoặc thiếu được thử đúng một lượt rút gọn (Hành vi 2). Dòng `enriched`, `low_confidence`, `closed_permanently`, `no_match` với `attempts=2` không bao giờ bị tìm lại. Dòng `error` không phải "đã thử".
3. **Khôi phục:** `enrich.py --state HCMC --restore <id>` (T-110, Hành vi 7) khôi phục vendor bị T-111 gỡ; vì dòng audit giữ nguyên nên lần chạy sau **không** tìm lại và **không** gỡ lại; vendor trở lại pool ở lần tạo pool kế tiếp.
4. **Vendor đã có place_id** (133 vendor) không bị Text Search lại (luật `_already_matched` hiện có).

### 4. Chi phí và trần $30 (chi tiết ở mục "Chi phí")
Mọi chi phí tính chung một trần: Text Search, ảnh, và cả request của T-110 (≤ 9, đã nằm trong `run-logs/T-110/` sau khi T-110 chạy). Chạm trần thì workflow **dừng giữa chừng**, lưu phần đã làm, vendor chưa làm nguyên vẹn để lần sau làm tiếp.

### 5. Pool: "không hiển thị trên app" = id không có trong pool
- Sau khi Capu merge PR dữ liệu (tohong), pool được tạo lại bằng `bash tools/regen-pool-styles.sh --back <tohong-back> --photos-for all` và Capu merge PR tohong-back. Kết quả đo được:
  - vendor đã remove (có trong `removed_vendors.json`, không còn trong `vendors.json` nào): **không có trong pool**, kể cả khi pool nền còn nó; lệnh thoát 0;
  - vendor ở trạng thái tạm đóng cửa: **không có trong pool**; được nhận lại thì quay lại pool;
  - vendor `low_confidence`: ở lại pool;
  - vendor có ảnh Google, mọi category: `photos` thay bằng đúng các ảnh Google (≤ `max_photos`, `source="google"`, host `lh*.googleusercontent.com`, có `attribution`); giá, rating, reviews giữ nguyên (ADR-025).
- **Gộp lỗi pool của T-109 vào T-111** (Chief of Staff đề xuất): `generate-vendor-pool.js --styles-only` hiện thoát 1 nếu pool nền có vendor không còn trong nguồn (đã tái hiện: "✗ 1 vendor trong pool nền không có trong …/pool-vendors.json"). Sau việc này: (a) thêm cờ `--prune`: vendor có trong pool nền mà không còn trong nguồn **bị gỡ khỏi pool**, in `PRUNED <n> <id…>`; (b) **không có `--prune` vẫn thoát 1** như cũ (không xoá pool âm thầm); (c) `regen-pool-styles.sh` luôn truyền `--prune`; (d) nguồn rỗng (0 vendor) + `--prune` thì **từ chối** (thoát khác 0, pool không đổi); (e) `--photos-for all` áp cho mọi vendor trong pool; `--photos-for <category>` (như T-106) vẫn đúng; (f) bước build nguồn pool (`build_pool.py`) bỏ vendor đang tạm đóng cửa. T-109 hạng mục 1 được chuyển sang đây; T-109 chỉ còn hạng mục 2 (không ghi đè phone/website) và 3 (phần chưa phủ).

### 6. Báo cáo theo category
Stdout của `enrich.py` có, mỗi category chạy một dòng và một dòng tổng (định nghĩa chi tiết ở `eval/T-111/check_9`):
`CATEGORY_REPORT category=<c> processed=<n> kept=<n> with_photos=<n> removed=<n> temp_closed=<n> review=<n> error=<n> unprocessed=<n>`; `processed = kept + removed + temp_closed + review + error`; `with_photos ≤ kept`; `unprocessed` = vendor còn trong phạm vi nhưng chưa tìm vì dừng trần. Dòng cuối stdout luôn là `GOOGLE_USAGE text_search=<n> photo_details=<n> photo_media=<n>` (như T-106). Workflow đưa báo cáo vào Summary và body PR.

### 7. Hợp đồng lệnh và workflow
- **CLI** (mở rộng `enrich.py`, không đổi hành vi các cờ cũ): `python enrich.py --state HCMC --category <c1,c2,…|all> --budget-usd <n> --cap-basis net|gross --max-photos <1..4> --usage-root run-logs --month YYYY-MM [--include-non-pool] [--dry-run]`.
  - `--category` nhận danh sách ngăn dấu phẩy **theo thứ tự chạy**; `all` = thứ tự ưu tiên ở mục sau (14 category, không `--all` của bản cũ).
  - `--budget-usd` > 30 → thoát 2, in `BUDGET_CAP_TOO_HIGH`, 0 request.
  - `--max-photos` mặc định 2 (hiện là 2; T-106 dùng 2).
  - `--usage-root` + `--month`: nguồn "đã dùng tháng này" (xem "Chi phí").
  - Dừng trần: in `BUDGET_STOP basis=<net|gross> cap_usd=<x.xx> est_usd=<x.xx> next_category=<c> processed=<n> remaining=<m>`, thoát **0**.
- **Workflow** `.github/workflows/enrich-vendors.yml` (mới, `workflow_dispatch`, **không** thay `enrich-venue.yml`, `scrape-vendors.yml` giữ nguyên): inputs `dry_run` (mặc định `true`), `budget_usd` (mặc định `30`, > 30 thì chặn trước khi gọi Google), `categories` (mặc định `all`, hoặc danh sách), `max_photos` (mặc định `2`), `cap_basis` (mặc định `net`), `include_non_pool` (mặc định `false`). Chạy thật: tee log vào `tools/scraper/run-logs/T-111/YYYYMMDD-HHMMSS-<tên>.log`, kiểm log không lộ khoá (`AIza…`), mở PR dữ liệu (tohong) kể cả khi dừng vì trần; `concurrency: google-places` (đề nghị T-110 và `enrich-venue.yml` dùng chung nhóm này để hai lần chạy Google không chồng nhau). Workflow **không** tạo pool: pool là PR tohong-back riêng (Capu merge, bậc C), workflow chỉ ghi lệnh vào body PR.
- Tệp `tools/scraper/run-logs/usage-baseline.json` (Capu/Engineering tạo một lần, chỉ-ghi-thêm): `{"month":"2026-11","text_search":0,"photos":606,"source":"Capu console 2026-11-08"}`.

## Chi phí

### Đơn vị
- **Text Search:** một vendor tốn 1 lượt, 2 lượt khi `no_match` lần 1 và có tên rút gọn. Mask trường hiện tại của `google_maps.py` có `places.reviews` (nhóm Atmosphere) nên SKU là **Text Search Enterprise + Atmosphere**.
- **Ảnh:** lấy từ ảnh trong kết quả Text Search, mỗi ảnh một request media. **Tối đa `max_photos` = 2 ảnh mỗi vendor được giữ** (hiện là 2) = tối đa 2 request ảnh mỗi vendor; không Place Details trong luồng này (Place Details chỉ ở `refresh_photos.py`, ngoài phạm vi).
- Vendor không được giữ (đóng cửa, tạm đóng, `low_confidence`, remove) không tốn request ảnh.

### Bảng giá (nguồn và ngày)
| SKU | Giá / 1.000 | Miễn phí / tháng | Nguồn |
| --- | --- | --- | --- |
| Text Search Enterprise + Atmosphere (mask hiện tại) | **$40,00** | 1.000 | Bảng giá Google Maps Platform (`developers.google.com/maps/billing-and-pricing/pricing`), đọc qua kết quả tìm kiếm 2026-11-08 (trang gốc không mở được từ phiên này) |
| Text Search Enterprise (mask không có reviews/editorialSummary) | $35,00 | 1.000 | như trên |
| Text Search Pro (không phone/website/rating/reviews) | $32,00 | (Google ghi 5.000; **chưa kiểm**) | blog bên thứ ba 2026-08, chưa đối chiếu Google |
| Place Photos / Place Details Photos (mỗi request media) | **$7,00** | 1.000 | như hàng đầu |
| Place Details (mask `photos`) | $0 theo `google_photos.py` (SKU IDs Only), **vẫn đếm vào 1.000 ảnh** cho an toàn | — | `enrichment/google_photos.py` dòng 36–38 (kiểm 2026-11-07) |

Hằng số trong code hiện tại `COST_PER_CALL_USD = 0.035` **thấp hơn giá thật** ($0,040) vì mask có `reviews`. Spec buộc dùng **$0,040** (và $0,007 cho ảnh) để trần không bị đếm thiếu.

### Hạn mức tháng 11 còn lại (đọc từ log, 2026-11-08)
- Text Search đã dùng: **99** (`run-logs/T-106/20261108-040329-enrich-venue.log`: `GOOGLE_USAGE text_search=99`). Còn 901 lượt miễn phí. Photography/venue tháng 11 không có Text Search khác (log enrichment photography ghi 05-28 và 06-16).
- Ảnh đã dùng: ghi chú của Capu **606** (console, trước T-106) + log T-106: 50 (enrich, `photo_media=50`) + 156 (refresh: `photo_details=52 photo_media=104`) = **812**. Còn **188** request ảnh miễn phí (con số "~94" trong brief là kế hoạch T-106 chưa trừ lượt thực dùng).
- T-110 sẽ dùng ≤ 3 Text Search + ≤ 6 ảnh (đã nằm trong trần $30 chung): còn khoảng 898 Text Search và 182 ảnh.
- Biên an toàn: `--free-margin` 50 cho mỗi SKU (tin hạn mức còn ít hơn 50 so với tính được). Hạn mức miễn phí hiệu dụng khi tính trần: Text Search **848**, ảnh **132**.

### Công thức trần (workflow tự dừng)
`đã_dùng(SKU)` = baseline trong `usage-baseline.json` + mọi `GOOGLE_USAGE` trong `run-logs/*/<YYYYMM>*.log` của **tháng đang chạy** (log tháng khác không tính; thư mục T-106, T-110, T-111 đều tính). `free(SKU) = max(0, 1000 − đã_dùng − 50)`.
- `net = 0,040 × max(0, text_search − free_ts) + 0,007 × max(0, ảnh − free_ảnh)`; `gross = 0,040 × text_search + 0,007 × ảnh` (không trừ miễn phí).
- `--cap-basis` chọn cái nào so với `--budget-usd`; mặc định **net** (chi tiền thật, theo ADR-049 "Trần chi: $30").
- Trước **mỗi request**: ước tính sau request ≤ trần, nếu không thì dừng. Trước **mỗi Text Search**: ước tính sau (Text Search + `max_photos` request ảnh) ≤ trần (không dừng giữa chừng một vendor). Dữ liệu từng vendor được lưu ngay khi xong (không đợi hết category).
- Dừng vì trần: thoát 0, `BUDGET_STOP`, vendor chưa làm không đổi byte và không có dòng audit; chạy lại làm tiếp đúng chỗ.
- Dry-run in `DRY_RUN_SCOPE` (mỗi category), `DRY_RUN_COST`, `DRY_RUN_PLAN` (tích luỹ theo thứ tự chạy), `DRY_RUN_VERDICT` (`within_cap`, `stops_after`), 0 request, không cần khoá, không đổi file. Công thức "kỳ vọng": `Text Search = N × 1,15 + retry_only`, `ảnh = N × 0,60 × max_photos` (giả định khớp 60%, `no_match` lần 1 là 15%, **tự tin ~50%**, cờ tinh chỉnh `--assume-match`, `--assume-no-match`); "cận trên": `Text Search = N + ⌈N × 0,30⌉ + retry_only`, `ảnh = N × max_photos` (mọi vendor khớp, `no_match` 30%).

### Ước tính (phạm vi mặc định 795 vendor trong pool + 4 thử lại; sau T-110 dùng ≤ 3 Text Search và ≤ 6 ảnh)
| Kịch bản | Text Search | Ảnh | **Chi net** | Chi gross (không trừ miễn phí) |
| --- | --- | --- | --- | --- |
| Thấp (khớp 40%, no_match 5%) | 839 | 636 | **$3,53** | $38,00 |
| **Kỳ vọng (khớp 60%, no_match 15%)** | **918** | **954** | **$8,56** | $43,41 |
| Cao (khớp 75%) | 918 | 1.192 | $10,23 | $45,08 |
| Cận trên (mọi vendor khớp, no_match 30%) | 1.038 | 1.590 | $17,79 | $52,63 |
| Cộng 160 vendor ngoài pool (`include_non_pool`), kỳ vọng | 1.102 | 1.146 | $17,27 | $52,11 |
| Cộng 160 ngoài pool, cận trên | 1.246 | 1.910 | $28,35 | $63,19 |

**Kết luận: ước tính net không vượt $30 ở bất kỳ kịch bản nào kể cả cận trên có vendor ngoài pool ($28,35 sát trần).** Điều kiện: hạn mức miễn phí thật còn đúng như log (848 Text Search, 132 ảnh). **Nếu hạn mức miễn phí không áp dụng (gross) thì kỳ vọng $43 vượt $30** và workflow dừng sớm; vì vậy `cap_basis` là cờ và dry-run in cả hai số. Tự tin ~60% rằng chi thật ≤ $12 ở kịch bản kỳ vọng; không có dữ liệu khớp cho 11 category chưa từng tìm.

### Thứ tự ưu tiên để dừng đúng chỗ (nếu cần dừng)
Thứ tự chạy mặc định của `--category all` (GIẢ ĐỊNH, tự tin ~50%; chỉnh được bằng danh sách `categories`): venue (chỉ thử lại 4), photography, wedding_attire, makeup, flower, wedding_interior, ceremony, invitation, wedding_gift, wedding_ring, wedding_car, honeymoon, wedding_planner, other (hai cuối chỉ chạy khi `include_non_pool`). Chi tích luỹ kỳ vọng theo thứ tự này (số Text Search / ảnh / net / gross):

| Sau category | Vendor cần tìm | Text Search tích luỹ | Ảnh tích luỹ | Net tích luỹ | Gross tích luỹ |
| --- | --- | --- | --- | --- | --- |
| photography (+4 thử lại venue) | 24 | 32 | 29 | $0,00 | $1,47 |
| wedding_attire | 87 | 132 | 133 | $0,01 | $6,20 |
| makeup | 89 | 234 | 240 | $0,76 | $11,04 |
| flower | 99 | 348 | 359 | $1,59 | $16,43 |
| wedding_interior | 46 | 401 | 414 | $1,97 | $18,93 |
| ceremony | 96 | 511 | 529 | $2,78 | $24,15 |
| invitation | 99 | 625 | 648 | $3,61 | $29,54 |
| wedding_gift | 91 | 730 | 757 | $4,38 | $34,49 |
| wedding_ring | 65 | 804 | 835 | $4,92 | $38,02 |
| wedding_car | 46 | 857 | 890 | $5,68 | $40,52 |
| honeymoon | 53 | 918 | 954 | $8,56 | $43,41 |

Nếu Capu chọn `cap_basis=gross`, workflow dừng khoảng sau `invitation` (gross $29,54), tức khoảng 62% phạm vi và 6 category chưa làm (gift, ring, car, honeymoon). Với `net` không dừng.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (`tools/scraper`: `enrich.py`, `enrichment/*`, `refresh_photos.py` không đổi, `tools/generate-vendor-pool.js`, `tools/regen-pool-styles.sh`, `tools/scraper/build_pool.py`, workflow mới `enrich-vendors.yml`, `run-logs/usage-baseline.json`, dữ liệu `output/HCMC/…`) · `phungrk/tohong-back` (pool, PR riêng sau khi PR dữ liệu merge) · Nhánh: `t-111-enrich-toan-bo-vendor` (mỗi repo) · Vùng (`area`): `planner/vendor/images`.
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret: log lưu vào repo không được chứa khoá; INV-002, 003), `planner/` (001–004, không liên quan), `planner/vendor/images/` INV-001..019, `planner/vendor/pool/` (001 styles khớp nguồn, 004 pool trung gian không vào git). Spec **giữ**: INV-012 (pool không URL Places), 013 (ảnh Google có ghi công), 014 (ảnh Google truy về place_id), 015 (nhận khớp có cổng; vendor T-111 nhận khớp qua đúng sáu cổng, `confidence` là số đo thật), 016 (không ngoài tỉnh), 017 (một place_id một địa chỉ gốc), 018 (code bám hàm chuẩn), 019 (G6 xét mọi category). Không đề nghị đổi bất biến nào. Hàm chuẩn T-106 không đổi.
- Kiến trúc: ảnh chỉ qua `photoUri` (spec 005): không URL `places.googleapis.com` trong pool; pool không thêm `place_id`; ảnh Google mang `attribution`.
- Không chạm: payment, auth, schema DB, dữ liệu cá nhân người dùng; không liên hệ vendor; giá vendor (ADR-025); UI front; `scrape-vendors.yml`; `main.py`.
- **Quan hệ với T-106, T-109, T-110:**
  - T-111 chạy **sau T-110** (T-110 merge và chạy trước). Request của T-110 (≤ 9) tính chung vào trần $30 (log `run-logs/T-110/` được cộng tự động).
  - Trạng thái tạm đóng cửa: định nghĩa **một lần ở T-110**; T-111 dùng đúng tên trạng thái và trường audit (`temporarily_closed`, `retry`, `manual_override`); nếu T-110 đổi tên trường, đổi **một chỗ** ở `eval/T-111/_t111.py::is_temp_closed` và bất biến đề xuất.
  - Gộp: lỗi pool của T-109 (hạng mục 1) chuyển vào T-111; T-109 còn hạng mục 2 và 3.
  - **Va chạm cần Chief of Staff:** `eval/T-110/check_7_adr048_du_lieu_that.py` hiện đòi Pergola **còn trong pool** (v1); T-110 D1 B1 đã yêu cầu sửa thành "không có trong pool". Việc kiểm "tạm đóng cửa không vào pool" ở mức công cụ (regen) do T-111 `check_7` làm; T-110 check_7 đo trên dữ liệu thật sau khi công cụ có. Nếu T-110 merge trước T-111, check_7 của T-110 đo "không có trong pool" chỉ đạt khi PR pool của T-110 gỡ tay Pergola hoặc dùng công cụ T-111: cần Chief of Staff chốt (xem handoff).
- Bậc lưới lọc: **C** (đã giao, "Hỏi trước"): dịch vụ trả phí, gỡ vendor khỏi app, chạy thật cần Capu bấm. Capu merge PR dữ liệu và PR pool.

## Tiêu chí chấp nhận và eval
Mọi eval chạy offline: Google giả nạp qua `PYTHONPATH=eval/T-111/_fake`, chạy đúng lệnh CLI trong thư mục `tools/scraper` tạm (bản sao code thật, không `output/` thật), `python3 -I eval/T-111/<file>`. Cần `TOHONG_REPO` (mặc định `../tohong`); `check_1`, `check_7`, `check_11` dùng thêm dữ liệu/ repo thật. Hạ tầng dùng lại của T-110 (`eval/T-110/_t110.py`). Thiếu cài đặt thì in `FAIL`, không `ERROR`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | `--dry-run` trên dữ liệu thật in số vendor theo từng category của 14 category (bản ghi, id duy nhất, eligible, trong pool, ngoài pool, thử lại, đã khớp, trong phạm vi) **bằng** số tự đếm lại; 0 lượt Google; không đổi file | `python3 -I eval/T-111/check_1_pham_vi_dem.py` |
| 2 | Luật mỗi vendor: giữ+≤2 ảnh; `CLOSED_PERMANENTLY` gỡ ở mọi file; tạm đóng ở lại, ẩn, được nhận khi mở lại; `low_confidence` vào review không remove; `no_match` thử rút gọn rồi remove; số lượt Text Search/media đúng | `python3 -I eval/T-111/check_2_luat_moi_vendor.py` |
| 3 | Thử lại tên rút gọn đúng 1 lần: hàm `short_name` khớp bảng; truy vấn lượt 2 đúng; vendor không rút gọn được chỉ 1 lượt; chạy lại 0 lượt | `python3 -I eval/T-111/check_3_ten_rut_gon.py` |
| 4 | Duyệt tay (T-110) thắng luật gỡ; tập G4 chỉ nhận `CLOSED_PERMANENTLY` Google báo; audit cũ không tìm lại, `no_match` cũ thử đúng 1 lượt rút gọn; lỗi HTTP không tính là đã thử | `python3 -I eval/T-111/check_4_tuong_tac_t110_va_audit.py` |
| 5 | Trần $ tự dừng giữa chừng không vượt trần (net và gross), phần chưa làm nguyên vẹn và làm tiếp được, trần > 30 bị từ chối, log nhiều việc được cộng, log tháng khác không | `python3 -I eval/T-111/check_5_tran_chi_tu_dung.py` |
| 6 | Dry-run in số lượt + ước tính $ (kỳ vọng, cận trên, tích luỹ theo category, điểm dừng) đúng công thức, 0 request | `python3 -I eval/T-111/check_6_dry_run.py` |
| 7 | Tạm đóng cửa và vendor đã remove không có trong pool (thoát 0, lỗi T-109 giải quyết); tạm đóng quay lại pool khi được nhận; `low_confidence` ở lại; ảnh Google mọi category; `--prune` an toàn | `python3 -I eval/T-111/check_7_pool_tam_dong_va_remove.py` |
| 8 | Remove khôi phục được: bản ghi nguyên vẹn, `--restore` đưa về, không bị tìm/gỡ lại | `python3 -I eval/T-111/check_8_remove_khoi_phuc_duoc.py` |
| 9 | Báo cáo theo category (giữ/remove/tạm đóng/review/có ảnh) đúng định nghĩa và khớp dữ liệu; `GOOGLE_USAGE` khớp | `python3 -I eval/T-111/check_9_bao_cao_theo_category.py` |
| 10 | Một workflow chung cho mọi category: input `dry_run`, `budget_usd`, `categories`, `max_photos`, `cap_basis`, `include_non_pool`; chặn > 30; không `--all`; log T-111; không tự tạo pool | `python3 -I eval/T-111/check_10_workflow.py` (cấu trúc YAML; workflow cần runner GitHub nên không chạy được offline, hành vi lệnh đã đo ở 2–9) |
| 11 | INV-012..019 xanh trên dữ liệu thật và INV-015..019 xanh trên trạng thái fixture sau khi chạy luật (hai lần) | `python3 -I eval/T-111/check_11_bat_bien_xanh.py` |

Đỏ hôm nay (đúng dự kiến, FAIL không ERROR): cả 11 (CLI chưa có cờ mới, workflow chưa có, pool tool còn lỗi T-109). Đã xanh sẵn: phần A của check_11 (INV-012..019 trên dữ liệu thật) và bất biến đề xuất. check_3 đã khoá hàm `short_name` (20 ca) trước khi đỏ ở bước CLI. check_7 tái hiện đúng lỗi T-109 ("✗ 1 vendor trong pool nền không có trong …").

Giới hạn đã biết: (a) eval dùng Google giả nên **không** đo được tỉ lệ khớp thật hay "khớp đúng nhà hàng"; đó là mắt Capu trên `review-needed.csv` và báo cáo category; (b) giá và hạn mức miễn phí là công thức trên log, không phải hoá đơn: Capu đối chiếu console sau mỗi lần chạy (agent không đọc được); (c) mọi ước tính tỉ lệ khớp ở trên là giả định từ venue/photography; (d) kiểm đúng "ảnh Google thuộc đúng nhà hàng" dựa vào sáu cổng đã có (T-106), không thêm cổng.

## Bất biến đề xuất (tầng 2)
- **A. Pool không chứa vendor đã gỡ hoặc đang tạm đóng cửa** (`planner/vendor/images`): bản nháp chạy được `eval/T-111/inv-proposed-pool-khong-vendor-tam-dong-hoac-da-go.py` (xanh hôm nay: pool 960, 8 vendor đã gỡ, 0 tạm đóng). Lý do: ADR-049 "không hiển thị trên app". Phụ thuộc định nghĩa tạm đóng của T-110.
- **B. Hạn mức tháng không bị tiêu mù** (đề nghị sau, chưa có file): sổ dùng Google ghi chung (T-106 đã nêu `google-usage.jsonl`); với T-111 `usage-baseline.json` + `run-logs/*` đã là sổ. Không rút bất biến vì baseline đổi theo tháng.
- INV-012..019 giữ nguyên, không đề xuất đổi.

## Không làm
- Đổi luật sáu cổng hoặc hàm chuẩn; vendor tự gửi ảnh; đổi UI; đổi giá; thêm `place_id` vào pool; rating/reviews/mô tả Google vào pool.
- Gọi Google, đổi dữ liệu thật hay commit trong việc viết spec này (chạy thật là lần bấm workflow của Capu sau Code Gate).
- Tạo pool trong workflow dữ liệu; sửa `scrape-vendors.yml`; chạy `main.py`; `enrich.py --all` bản cũ.
- Vendor ngoài pool (160) trừ khi Capu bật `include_non_pool`.
- Ảnh còn thiếu của 4 vendor đã có place_id (photography): `refresh_photos.py` có sẵn, không nằm trong workflow này.
- Phone/website: không đổi cách ghi (T-109 hạng mục 2). **Rủi ro đã biết:** pipeline ghi đè phone/website marry.vn bằng Google không lưu bản cũ; vendor bị hạ sau này mất số gốc. Pool không dùng phone nên không ảnh hưởng app.
- Mask Text Search hẹp hơn để rẻ hơn (cơ hội ghi nhận: bỏ phone/website/rating/reviews/mô tả thì SKU xuống Pro $32/1.000, Google ghi 5.000 lượt miễn phí nhưng **chưa kiểm**; đồng thời hết ghi đè phone). Đổi dữ liệu thu về nên không làm trừ khi Capu bảo.

## Câu hỏi mở
Một: trần $30 tính theo **tiền thật sau hạn mức miễn phí của Google** (mặc định `net`, kỳ vọng $8,56, tối đa $17,79 cho 795 vendor trong pool) hay theo **giá niêm yết bất kể miễn phí** (`gross`, kỳ vọng $43, workflow dừng sau khoảng 62% phạm vi)? Spec dùng `net` mặc định; Capu đổi bằng input `cap_basis` lúc bấm chạy. Dry-run in cả hai số trước khi chạy thật.

## Lịch sử sửa
- v1 (2026-11-08): bản đầu. Gộp lỗi pool T-109 hạng mục 1 theo đề nghị của Chief of Staff; khớp T-110 D1 (tạm đóng cửa định nghĩa ở T-110, duyệt tay thắng luật tự động, tập G4 chỉ nhận CLOSED_PERMANENTLY Google báo, T-110 merge trước T-111, request T-110 tính chung trần).
