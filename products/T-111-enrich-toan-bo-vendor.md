# Spec T-111: enrich-toan-bo-vendor

## Ý định
Capu (ADR-049, 2026-11-08) muốn mọi vendor còn dùng ảnh marry.vn (đã chết từ 2026-11-03) được tra trên Google Maps ngay trong tháng 11, tổng chi tối đa $30: có trên Maps thì giữ và lấy ảnh Google; không có thì thử một lần với tên rút gọn rồi gỡ (khôi phục được); tạm đóng cửa thì ẩn khỏi app; đóng vĩnh viễn thì gỡ; khớp lưng chừng thì đưa Capu duyệt, không gỡ. Nguồn: `board/T-111.md`, `decisions/2026-11-08-adr-049-enrich-toan-bo-vendor.md`, `products/T-106-enrich-venue.md` (v4.1, sáu cổng), `products/T-110-duyet-tay-venue.md` (trạng thái tạm đóng cửa, file duyệt tay, `--restore`), `handoffs/T-110-D1.md`.

## Bằng chứng
Đo 2026-11-08 trên `tohong` main (386392c) thư mục `tools/scraper/output/HCMC/` và `tohong-back/lib/vendorPool.generated.js`; đếm lại được bằng `check_1`.

**Phạm vi (một vendor = một id; cùng id ở nhiều category file là MỘT vendor, tính vào category đầu tiên theo thứ tự chạy ở mục "Thứ tự ưu tiên"):**

| Category file | Bản ghi | Vendor (id duy nhất) | Id trùng với file trước | Đã có place_id | Có dòng audit | **Cần tìm (eligible)** | Trong đó trong pool | Ngoài pool |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| venue | 94 | 94 | 0 | 62 | 94 | 0 (+4 chỉ lượt 2, xem dưới) | 0 | 0 |
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
- **Chỉ lượt 2 (4):** `venue/enrichment-audit.json` có 6 dòng `no_match`; 2 trong đó là Én (`marry_d4380c0b3cf3`, duyệt tay nhận) và Tự Do (`marry_e38f1e755f9c`, duyệt tay loại) do T-110 xử lý, còn 4 (`marry_f554315c63a7`, `marry_ef5456500d0e`, `marry_cd0998479977`, `marry_4746352cf425`) là dòng `no_match` cũ không có trường `attempts` = đã thử 1 lần (còn đúng 1 lượt 2 theo Hành vi 2).
- 26 venue `low_confidence` giữ nguyên (đi review, ADR-049 mục 2 cuối).
- 4 vendor đã có place_id mà chưa có ảnh Google (photography): ngoài phạm vi (xem "Không làm").
- Mẫu tỉ lệ để ước tính (suy ra từ venue, **giả định** áp cho category khác, tự tin ~50%): nhận khớp 62/94 = 66%, `low_confidence` 26/94 = 28%, `no_match` 6/94 = 6%; photography 73/97 = 75% có place_id (data tháng 6). Category toàn cá nhân/cửa tiệm nhỏ (makeup, áo cưới, quà) nhiều khả năng khớp thấp hơn và `no_match` cao hơn venue.
- Chi phí: lần chạy T-106 thật (log `tools/scraper/run-logs/T-106/`): Text Search 99, ảnh 50 + 156 (52 Place Details + 104 media). Giá và hạn mức: xem "Chi phí".
- Không có dữ liệu "category nào người dùng xem nhiều": `insights/2026-11-06-weekly.md` ghi 11 `vendor_viewed` trong 30 ngày, đều của một người. Thứ tự ưu tiên dưới đây là **GIẢ ĐỊNH, tự tin ~50%** (theo tầm quan trọng của hạng mục trong ngân sách cưới và số vendor trong pool).

## Giả thuyết
Nếu chạy luật ADR-049 cho 795 vendor trong pool thì vendor trong pool có ảnh Google đi từ 128/960 lên khoảng 128 + 480 (kỳ vọng, khoảng 128 + 320 đến 128 + 600), card các hạng mục hết "Ảnh minh hoạ" ở phần lớn vendor, và vendor không tồn tại hay đóng cửa không còn hiện trên app. Dự báo review: khoảng 96 dòng `review-needed.csv` mới từ lượt 2 (đoán, tự tin ~40%). Chỉ số bảo vệ: chi thật ≤ $30; không vendor nào hiện ảnh của nơi khác (INV-015..019 xanh); không vendor nào bị gỡ mà không khôi phục được.

## Hành vi (người dùng thấy gì)
"Người dùng" gồm cặp đôi (xem card vendor trên app) và Capu (bấm chạy, đọc báo cáo, merge hai PR).

### 1. Luật cho mỗi vendor
Mỗi vendor trong phạm vi được Text Search (lượt 1: truy vấn "<tên> <địa danh>", địa danh như hôm nay: Quận N / HCM / đoạn cuối địa chỉ). Kết cục theo kết quả Google, xét theo thứ tự:

| Kết quả Google | Kết cục | Vendor trong `vendors.json` | Trong pool app | Ảnh |
| --- | --- | --- | --- | --- |
| Ứng viên qua **sáu cổng** (G1..G6, T-106 v4.1, **không đổi**), `businessStatus` OPERATIONAL hoặc vắng | **giữ**: `place_id`, `enriched` | còn | có | lấy tối đa `max_photos` ảnh (mặc định 2) từ chính kết quả Text Search, không Place Details |
| Ứng viên qua G1, G2, G3, G5 và `CLOSED_PERMANENTLY` | **gỡ** (ADR-044) | gỡ khỏi **mọi** category file có id đó | không | không. Vào `removed_vendors.json` (lý do chứa `CLOSED_PERMANENTLY`), vào tập G4 |
| Ứng viên `CLOSED_TEMPORARILY` qua sáu cổng | **tạm đóng cửa** (T-110 Hành vi 6 nguồn (ii), **dùng lại**): dòng audit `closed_state="temporarily_closed"` + `retry=true` | còn, không `place_id` | **không** | không |
| Ứng viên `CLOSED_TEMPORARILY` nhưng **bị một cổng từ chối** | `low_confidence` + `reject_reason` **kèm** `closed_state` + `retry` (T-110 nguồn (ii)); đúng một dòng `review-needed.csv` | còn, không `place_id` | **không** (có `closed_state`) | không. **Không remove** |
| Ứng viên bị một cổng từ chối, **không** `CLOSED_TEMPORARILY` | `low_confidence` + `reject_reason` (như T-106) | còn | còn (ảnh minh hoạ như hôm nay) | không. Đúng một dòng `review-needed.csv`. **Không remove, không thử lại** |
| Google không trả gì ở lượt 1 | `no_match` lần 1 → **lượt 2** (Hành vi 2) | còn trong lúc chờ | — | — |
| Lượt 2 trả ứng viên | áp lại đúng các hàng trên; cổng G1 chấm bằng **tên gốc** của vendor (B4, Hành vi 2) | như hàng tương ứng | | |
| Lượt 2 vẫn không trả gì, vendor **không** ở `closed_state` | **remove** | gỡ khỏi **mọi** category file có id đó, vào `removed_vendors.json` | không | không |
| Lượt 1 (và lượt 2) không trả gì, vendor **đang** `closed_state` (tạm đóng do Capu hoặc do Google trước đó) | **giữ nguyên trạng thái ẩn**: vẫn `closed_state` + `retry`, lần sau thử lại | còn | không | không. **Không remove** khi đang ở `closed_state` |
| Vendor tạm đóng **do Google báo** (nguồn (ii), không mục duyệt tay) đã thử lại **3 lần** (`closed_retries` = 3) mà vẫn tạm đóng hoặc không trả gì | **dừng retry**: `retry=false`, `retry_exhausted=true`, **giữ `closed_state`**; đúng một dòng `review-needed.csv` cờ `closed_retry_exhausted` để Capu quyết (nhận bằng `accept_place` hoặc `remove`). **Không remove** | còn | không (ẩn) | không |
| Lỗi HTTP/timeout | `error`: **không** tính là đã thử, không remove, không ghi dòng audit nhận khớp/từ chối | còn | còn | không. Lần chạy sau tìm lại |

- **Trạng thái tạm đóng cửa là định nghĩa của T-110 (Hành vi 6), không định nghĩa lại ở đây:** dòng audit mới nhất của vendor (ở bất kỳ category file nào) có `closed_state: "temporarily_closed"` **và** `retry: true`. Vendor còn trong `vendors.json`, không trong `removed_vendors.json`, **không có trong pool**, mỗi lần enrich đều thử lại; khi Google báo OPERATIONAL và vendor qua đủ sáu cổng thì nhận lại vào pool (`reopened=true`, hết `closed_state`/`retry`). T-111 chỉ áp thêm nguồn (ii) cho mọi category và hai ca ở bảng trên (cổng từ chối; không trả gì).
- **Trạng thái ẩn không kéo dài mãi (D2 M5):** vendor tạm đóng do Google báo được thử lại tối đa **N = 3** lần (audit `closed_retries`: 0 lúc phát hiện, +1 mỗi lần thử lại, mỗi lần thử gồm cả lượt 2); hết 3 lần thì dừng và vào review như bảng trên. Mục `temporarily_closed` do **Capu** đánh dấu (T-110 nguồn (i)) thử lại không giới hạn vì Capu giữ mục trong file. Mở rộng so với T-110: `retry_exhausted=true` đi cùng `retry=false` nhưng `closed_state` còn nên vendor vẫn ẩn khỏi pool (INV-021 (f) đọc `closed_state`); cần T-112 chấp nhận tổ hợp này. Số vendor cạn lượt được thấy qua `review` trong `CATEGORY_REPORT` và `temp_closed` của các lần chạy trước.
- **Bản ghi remove do `no_match`**: `removed_vendors.json` của mỗi file bị gỡ có `{removed_at, reason, vendor}`, `reason` nêu `no_match` (ví dụ "no_match sau lượt 2"), **không chứa** `CLOSED_PERMANENTLY`, **không** `manual`; `vendor` = bản ghi nguyên vẹn (bằng nhau từng trường) trước khi gỡ. Dòng audit giữ: `status="no_match"`, `attempts=2`, `query_1`, `query_2` (hai chuỗi đã gửi).
- **Tập G4 (nhà hàng đã gỡ) chỉ nhận vendor `CLOSED_PERMANENTLY` do Google báo.** Vendor bị T-111 gỡ vì `no_match` không vào tập G4: vendor khác cùng địa chỉ gốc không bị `same_address_as_closed` vì nó.
- **Đơn vị xử lý là id**: mỗi lần chạy mỗi id chỉ bị Text Search một lần (lượt 1) dù nằm ở nhiều category file; kết cục áp cho **mọi** file có id đó. Hiện `enrich.py` chạy theo từng file nên 88 id trùng sẽ bị tìm hai lần nếu không gộp: phải gộp.

### 2. Lượt thử lại duy nhất khi Google không trả gì (ADR-049 mục 2)
- Chỉ khi lượt 1 **không trả gì** (`no_match`). Đúng **một** lượt nữa với truy vấn **khác lượt 1**, tổng một vendor luôn ≤ 2 lượt Text Search mỗi lần "thử"; không bao giờ lượt thứ ba, kể cả chạy lại (dòng audit `attempts=2` hoặc vendor đã bị gỡ chặn). **Không vendor nào bị remove sau đúng một lượt Text Search.**
- **Chọn truy vấn lượt 2, theo thứ tự:**
  1. Nếu `short_name(tên vendor)` ≠ `None`: "<tên rút gọn> <địa danh>" (địa danh như lượt 1).
  2. Nếu `short_name` = `None`: **tên gốc không kèm địa danh** (đúng chuỗi tên vendor). Nếu sau chuẩn hoá truy vấn này vẫn trùng lượt 1 (địa danh rỗng) thì thêm " Hồ Chí Minh".
- **`short_name` là hàm chuẩn** `eval/T-111/_short.py` (v3), bảng khoá `eval/T-111/short_name_cases.json` (36 ca, gồm ca D1 và D2). Trả tên rút gọn **chỉ khi còn tên riêng có nghĩa**: mỗi bước (S1 bỏ ngoặc, **trừ ngoặc ở đầu tên** như "[Paper Color]"; S2 cắt tại cụm đuôi "tại"/"chuyên"/"cho thuê" **so có dấu** nên "Tài" không bị cắt; S3 bỏ cụm loại hình chung và từ nối "và"/"TNHH" ở đầu cuối; S4 tách tại phân cách {" - ", " | ", ": ", ", ", " & ", " + "}, **không tách tại "&"/"+" khi một vế chỉ có một từ** ("Marks & Spencer"), bỏ vế mở đầu bằng từ hành chính (Quận/Huyện/Phường/TP), rồi chọn **vế hợp lệ đầu tiên từ trái**) chỉ được nhận nếu kết quả "hợp lệ": ≥ 2 từ hoặc ≥ 4 ký tự chữ-số **và** có ít nhất một từ ngoài tập từ chung COMMON (loại hình, sản phẩm/dịch vụ cưới, từ nối, và các từ D2: cô dâu, nhà, giấy, in, giá rẻ, quay, đẹp, lãng mạn, thế giới, nổi, shop, store, tiệc). Ví dụ: "Trung Tâm Hội Nghị & Tiệc Cưới GALA" → "GALA"; "In Thiệp Cưới Giá Rẻ - Quang Minh" → "Quang Minh"; "Tiệc lãng mạn - Remember Event" → "Remember Event"; "[Paper Color] - Thiệp nổi 3D" → "Paper Color"; "Makeup cô dâu tại nhà Kim Hanyoung", "Marks & Spencer", "Thế giới thiệp cưới - Quận Bình Thạnh" → `None` (dùng tên gốc, không bao giờ thành từ chung). Khi chọn vế, tên "Hoa giấy, hoa cưới ViVi FlowPer" cho "hoa cưới ViVi FlowPer".
- **Số đo trên dữ liệu thật** (795 vendor trong phạm vi): **141/795 (17,7%) có tên rút gọn**; **654/795 (82,3%) dùng lượt 2 = tên gốc không kèm địa danh**. Ước tính kỳ vọng `no_match` lần 1 là 15% (khoảng 119 vendor), vì vậy khoảng 98 vendor dùng tên gốc trần và khoảng 21 dùng tên rút gọn ở lượt 2 (giả định, tự tin ~40%). Lượt 2 tên gốc trần có thể cứu vendor mà địa danh cũ của marry.vn làm lệch, nhưng không cứu vendor Google thật sự không có; vendor bị gỡ đều **khôi phục được** bằng `--restore` (Hành vi 3). **Lượng review tăng thêm (đoán, tự tin ~40%):** lượt 2 bằng tên gốc không kèm địa danh dễ trả ứng viên ở tỉnh khác hoặc cùng tên; các vendor đó bị G1/G2 từ chối và vào `review-needed.csv` (không bị gỡ): kỳ vọng khoảng **96 dòng review mới** nằm trong số vendor `no_match` lượt 1. Capu nên chờ khoảng đó trong PR dữ liệu.
- **Cổng G1 ở lượt 2 chấm bằng tên GỐC của vendor**, không bằng tên rút gọn (cách chặt hơn, theo "sáu cổng không đổi"): "Golf Royal" trả về cho "Nhà hàng Tiệc Cưới Golf Royal Palace Garden" có độ giống 0,377 < 0,4 nên là `low_confidence`/review, vendor ở lại. Ứng viên tên rút gọn "Én Banquet" cho "Én Banquet & Event Space" tương tự có thể vào review: chấp nhận (chặt hơn là an toàn; Capu duyệt).
- Dòng `no_match` cũ (từ T-106/T-108, không có `attempts`) = đã thử 1 lần: vendor còn trong `vendors.json` được thử **đúng 1 lượt (lượt 2)** theo quy tắc trên rồi theo bảng. 4 venue trong "Bằng chứng".
- **Danh sách vendor bị gỡ để Capu duyệt (M5):** mỗi vendor bị remove vì `no_match` in một dòng `REMOVED_VENDOR {"id","category","name","q1","q2"}` (category = category đầu tiên chứa id; q1, q2 là hai truy vấn đã gửi), và workflow đưa danh sách đó vào body PR dữ liệu kèm lệnh `--restore <id>` cho vendor sai.

### 3. Tương tác với T-110 và luật "đã có audit thì không tìm lại"
1. **Duyệt tay thắng luật tự động.** Vendor có mục trong `tools/scraper/output/HCMC/manual_overrides.json` **không bao giờ bị luật T-111 gỡ**, kể cả khi `no_match` ở cả hai lượt. `accept_place` đã áp, `remove` không bị Text Search (T-110). `temporarily_closed` do Capu đánh dấu vẫn được thử lại mỗi lần, **gồm cả lượt 2** (≤ 2 lượt mỗi lần chạy), và nếu không trả gì thì ở lại. Vendor Capu đã `remove` thì `--restore` bị chặn `still_overridden` (T-110).
2. **Đã có audit thì không tìm lại** (luật hiện có `ATTEMPTED_STATUSES`, giữ nguyên) với **hai ngoại lệ**: (a) dòng `retry=true` luôn được thử lại (T-110); (b) dòng `no_match` có `attempts` < 2 hoặc thiếu được thử đúng một lượt 2. Dòng `enriched`, `low_confidence` (không `retry`), `closed_permanently`, `no_match` với `attempts=2` không bao giờ bị tìm lại. Dòng `error` không phải "đã thử".
3. **Khôi phục:** `enrich.py --state HCMC --restore <id>` (T-110 Hành vi 7) khôi phục vendor bị T-111 gỡ; vì dòng audit giữ nguyên nên lần chạy sau **không** tìm lại và **không** gỡ lại; vendor trở lại pool ở lần tạo pool kế tiếp.
4. **Vendor đã có place_id** (133 vendor) không bị Text Search lại (luật `_already_matched` hiện có).

### 4. Trần $30 cho CẢ ĐỢT (chi tiết ở mục "Chi phí")
ADR-049: "Trần chi: $30 cho cả đợt". **Cả đợt** = mọi lần chạy T-110 và T-111 trong tháng, cộng dồn: số đã chi đọc từ **mọi log** của đợt (`run-logs/T-106/` làm nền, `run-logs/T-110/`, `run-logs/T-111/`) trên nhánh `main` cộng `usage-baseline.json`; lần chạy sau `BUDGET_STOP` **không** có lại trọn $30, chỉ còn phần chưa tiêu (đã tiêu $27 thì lần sau còn $3). Hệ quả bắt buộc:
- **`run_id` (D2 M2):** duy nhất cho **mỗi tiến trình CLI**: `r<UTC YYYYMMDDTHHMMSS>-<GITHUB_RUN_ID hoặc "local">a<GITHUB_RUN_ATTEMPT hoặc 0>-<cli>-<8 ký tự hex ngẫu nhiên>` với `cli` ∈ {`enrich`, `refresh`, `resolve`}; bắt đầu bằng chữ `r` để dòng `GOOGLE_USAGE` vẫn khớp biểu thức `(\w+)=(\d+)` của T-106/T-110. **Đếm theo cặp (tệp log, run_id)**: một run có dòng `GOOGLE_REQUEST` thì chỉ đếm các dòng đó; run không có dòng REQUEST (ví dụ `refresh_photos.py` cùng job) đếm theo `GOOGLE_USAGE` của nó, nên không bị bỏ mất.
- **Mỗi request ghi log ngay**: một dòng `GOOGLE_REQUEST run=<run_id> kind=<search|details|media|geocode>` được ghi và flush **trước khi gửi**, kể cả lượt lỗi và lượt retry; dòng cuối vẫn là `GOOGLE_USAGE run=<run_id> …`. Lần chạy bị huỷ/giết/hết giờ vẫn đếm đúng số đã gửi (có thể thừa lượt chưa kịp gửi: sai về phía an toàn). Log kiểu T-106 (không `run=`) đếm theo `GOOGLE_USAGE`. Log **hỏng** (không có dòng nào trong hai loại) trong `run-logs/T-110/` hoặc `run-logs/T-111/` làm chạy thật bị từ chối (`USAGE_LOG_UNREADABLE`, thoát 2); dry-run vẫn chạy và cảnh báo.
- **Sổ đăng ký lần chạy (D2 B1): trước khi chạy thật, mọi lần chạy thật trước đó phải có log trên `main`.** Log có thể không bao giờ lên `main` khi bước mở PR hỏng, khi Capu đóng PR mà không merge, hoặc khi bước kiểm khoá xoá log; chỉ chặn "còn PR mở" không đủ.
  - Mọi workflow Google đặt `run-name` bắt đầu bằng `REAL ` khi chạy thật (có input `dry_run`: `REAL` khi `dry_run != 'true'`; không có input: luôn `REAL`), `DRY ` ngược lại. Tên log: `tools/scraper/run-logs/<việc>/YYYYMMDD-HHMMSS-run-<GITHUB_RUN_ID>-<cli>.log`.
  - Bước `python check_runs.py --runs <runs.json> --prs <prs.json> --usage-root run-logs --baseline run-logs/usage-baseline.json --current <GITHUB_RUN_ID>` đứng **trước mọi lệnh gọi Google thật** (`runs.json` = `gh run list --json databaseId,displayTitle,workflowName,status,conclusion` cho `enrich-vendors.yml`, `enrich-venue.yml`, `refresh-vendor-photos.yml`, `scrape-vendors.yml`, `resolve-overrides.yml`; `prs.json` = `gh pr list --state open --json number,headRefName`). Mỗi lần chạy `REAL ` khác lần hiện tại, mọi `conclusion` trừ `skipped` (kể cả failure, cancelled, đang chạy), phải có log trong `run-logs/*/` có tên chứa `-run-<id>-` (khớp nguyên id) **hoặc** có `id` trong `usage-baseline.json` `runs_accounted`; thiếu thì thoát 1 và in `MISSING_RUN_LOG <id> <workflow>` cho từng lần thiếu. Còn PR dữ liệu **mở** có nhánh bắt đầu `enrich-vendors/`, `venue-enrich/`, `resolve-overrides/` hoặc `refresh-photos/`: thoát 1, `OPEN_DATA_PR <số> <nhánh>`. Workflow `resolve-overrides` của T-110/T-112 phải dùng tiền tố nhánh `resolve-overrides/`.
  - **Lối thoát duy nhất:** Capu ghi tay vào `usage-baseline.json` (chỉ-ghi-thêm) số đã dùng (console) và liệt kê id lần chạy trong `runs_accounted`, kèm `source` và `decision` trỏ một file `decisions/…`; thiếu `decision` hoặc `source` thì `check_runs.py` thoát 2 (`BASELINE_NO_DECISION`). Agent không tự thêm.
  - **Log không bao giờ bị xoá:** bước kiểm khoá chỉ **che** chuỗi khoá trong log (thay `[REDACTED]`), không `rm`; thư mục `run-logs` luôn được upload artifact (`if: always()`, giữ ≥ 30 ngày) để Capu khôi phục log vào `main` nếu bước mở PR hỏng.
- Mọi chi phí Google của lần chạy nằm trong trần: Text Search, ảnh, Geocoding (Hành vi 7: tắt mặc định; bật thì đếm), kể cả retry HTTP.
Chạm trần thì workflow **dừng giữa chừng**, lưu phần đã làm, vendor chưa làm nguyên vẹn để lần sau làm tiếp.

### 5. Pool: "không hiển thị trên app" = id không có trong pool
- Sau khi Capu merge PR dữ liệu (tohong), pool được tạo lại bằng `bash tools/regen-pool-styles.sh --back <tohong-back> --photos-for all` và Capu merge PR tohong-back. Kết quả đo được:
  - vendor đã remove (có trong `removed_vendors.json`, không còn trong `vendors.json` nào): **không có trong pool**, kể cả khi pool nền còn nó; lệnh thoát 0;
  - vendor ở trạng thái tạm đóng cửa (T-110: `closed_state` + `retry`, kể cả ca `low_confidence` mang `closed_state`): **không có trong pool**; được nhận lại thì quay lại pool;
  - vendor `low_confidence` không `closed_state`: ở lại pool;
  - vendor có ảnh Google, mọi category: `photos` thay bằng đúng các ảnh Google (≤ `max_photos`, `source="google"`, host `lh*.googleusercontent.com`, có `attribution`); giá, rating, reviews giữ nguyên (ADR-025).
- **Công cụ pool gỡ vendor đã xoá là việc của T-110/T-112, T-111 dùng lại `--prune`** (không tự định nghĩa lại): `generate-vendor-pool.js --styles-only --prune` gỡ vendor mất khỏi nguồn; không `--prune` vẫn thoát 1; nguồn rỗng thì từ chối; `regen-pool-styles.sh` luôn truyền `--prune`; bước build nguồn pool bỏ vendor `closed_state`. `check_7` (b)(c) của T-111 giữ làm **kiểm hồi quy**; T-112 cũng phải đạt. T-111 chỉ thêm đúng một hành vi vào công cụ: `--photos-for all` áp ảnh Google cho **mọi** category (T-106 mới cho một category); `--photos-for <category>` vẫn đúng.

### 6. Báo cáo theo category
Stdout của `enrich.py` có, mỗi category chạy một dòng và một dòng tổng (định nghĩa chi tiết ở `eval/T-111/check_9`):
`CATEGORY_REPORT category=<c> processed=<n> kept=<n> with_photos=<n> removed=<n> temp_closed=<n> review=<n> error=<n> unprocessed=<n>`; `processed = kept + removed + temp_closed + review + error`; `with_photos ≤ kept`; `unprocessed` = vendor còn trong phạm vi nhưng chưa tìm vì dừng trần. Mỗi vendor bị remove vì `no_match` có một dòng `REMOVED_VENDOR {json}` (Hành vi 2). Dòng cuối stdout luôn là `GOOGLE_USAGE run=<id> text_search=<n> photo_details=<n> photo_media=<n>` (kèm `geocode=<n>` chỉ khi bật `--geocode`). Workflow đưa báo cáo vào Summary và body PR.

### 7. Hợp đồng lệnh và workflow
- **CLI** (mở rộng `enrich.py`, không đổi hành vi các cờ cũ): `python enrich.py --state HCMC --category <c1,c2,…|all> --budget-usd <n> --cap-basis net|gross --max-photos <1..4> --usage-root run-logs --month YYYY-MM [--include-non-pool] [--geocode] [--dry-run]`.
  - `--category` nhận danh sách ngăn dấu phẩy **theo thứ tự chạy**; `all` = thứ tự ưu tiên ở mục sau (14 category, không `--all` của bản cũ).
  - `--budget-usd` > 30 → thoát 2, in `BUDGET_CAP_TOO_HIGH`, 0 request. Trần áp cho **cả đợt** (Hành vi 4).
  - `--max-photos` mặc định 2 (hiện là 2; T-106 dùng 2). `--cap-basis` mặc định `net`.
  - `--usage-root` + `--month`: nguồn "đã dùng tháng này" (xem "Chi phí").
  - **`--geocode` mặc định TẮT** (đảo mặc định cũ của `_ensure_geo`, vốn gọi Geocoding API cho mọi vendor chưa có toạ độ, ngoài `GOOGLE_USAGE`). Tắt thì 0 lượt Geocoding. Bật thì mỗi lượt là một dòng `GOOGLE_REQUEST kind=geocode`, vào `GOOGLE_USAGE` (`geocode=<n>`) và vào trần.
  - Dừng trần: in `BUDGET_STOP basis=<net|gross> cap_usd=<x.xx> est_usd=<x.xx> next_category=<c> processed=<n> remaining=<m>`, thoát **0**.
- **Workflow** `.github/workflows/enrich-vendors.yml` (mới, `workflow_dispatch`, **không** thay `enrich-venue.yml`): inputs `dry_run` (mặc định `true`), `budget_usd` (mặc định `30`, > 30 thì chặn trước khi gọi Google), `categories` (mặc định `all`, hoặc danh sách), `max_photos` (mặc định `2`), `cap_basis` (mặc định `net`), `include_non_pool` (mặc định `false`). Checkout `main`. Chạy thật: `run-name` `REAL …`; chạy `check_runs.py` (sổ đăng ký + PR mở, Hành vi 4) trước mọi lệnh Google; tee log vào `tools/scraper/run-logs/T-111/YYYYMMDD-HHMMSS-run-<GITHUB_RUN_ID>-<cli>.log`; kiểm log không lộ khoá (`AIza…`, chỉ che, không xoá); upload artifact `run-logs`; mở PR dữ liệu nhánh `enrich-vendors/run-<n>` (tohong) kể cả khi dừng vì trần, body có báo cáo category, danh sách `REMOVED_VENDOR` và lệnh `--restore`; **không** truyền `--geocode`. Workflow **không** tạo pool: pool là PR tohong-back riêng (Capu merge, bậc C).
- **Yêu cầu có eval (không chỉ đề nghị), cấu trúc YAML ở `check_10`:** mọi workflow trong `tohong` có dùng `GOOGLE_MAPS_API_KEY` (`enrich-vendors.yml`, `enrich-venue.yml`, `refresh-vendor-photos.yml`, `scrape-vendors.yml`, workflow `resolve-overrides` của T-110/T-112) dùng `concurrency.group: google-places` **với `cancel-in-progress: false`** (một lần bấm mới không giết lần đang chạy) và `run-name` đánh dấu `REAL`/`DRY`; `scrape-vendors.yml` **bỏ lịch hằng tuần** (`schedule`), chỉ còn `workflow_dispatch` (nó chạy `enrich.py --all --budget 5.0` ngoài trần và ngoài log; hiện hỏng ở bước đầu nên chưa tiêu tiền, nhưng sửa là tiêu).
- Tệp `tools/scraper/run-logs/usage-baseline.json` (Capu/Engineering tạo một lần, chỉ-ghi-thêm): `{"month":"2026-11","text_search":0,"photos":606,"source":"Capu console 2026-11-08"}`.

## Chi phí

### Đơn vị
- **Mọi SKU Google mà lần chạy gọi nằm trong trần (D1 B5):** Text Search, ảnh (media), Place Details (nếu có), Geocoding (mặc định tắt). Chi phí ngoài `enrich-vendors.yml` (`scrape-vendors.yml` hằng tuần, `refresh-vendor-photos.yml`) được kéo vào cùng nhóm `google-places`, và `scrape-vendors.yml` bỏ lịch (Hành vi 7).
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

Geocoding API (nếu bật `--geocode`): khoảng $0,005 mỗi lượt (tự tin ~60%, **chưa kiểm**), hạn mức miễn phí lớn; mặc định tắt nên không nằm trong ước tính bên dưới.

Hằng số trong code hiện tại `COST_PER_CALL_USD = 0.035` **thấp hơn giá thật** ($0,040) vì mask có `reviews`. Spec buộc dùng **$0,040** (và $0,007 cho ảnh) để trần không bị đếm thiếu.

### Hạn mức tháng 11 còn lại (đọc từ log, 2026-11-08)
- Text Search đã dùng: **99** (`run-logs/T-106/20261108-040329-enrich-venue.log`: `GOOGLE_USAGE text_search=99`). Còn 901 lượt miễn phí. Photography/venue tháng 11 không có Text Search khác (log enrichment photography ghi 05-28 và 06-16).
- Ảnh đã dùng: ghi chú của Capu **606** (console, trước T-106) + log T-106: 50 (enrich, `photo_media=50`) + 156 (refresh: `photo_details=52 photo_media=104`) = **812**. Còn **188** request ảnh miễn phí (con số "~94" trong brief là kế hoạch T-106 chưa trừ lượt thực dùng).
- T-110 sẽ dùng ≤ 3 Text Search + ≤ 6 ảnh (đã nằm trong trần $30 chung): còn khoảng 898 Text Search và 182 ảnh.
- Biên an toàn: `--free-margin` 50 cho mỗi SKU (tin hạn mức còn ít hơn 50 so với tính được). Hạn mức miễn phí hiệu dụng khi tính trần: Text Search **848**, ảnh **132**.

### Công thức trần (workflow tự dừng): TÍCH LUỸ cho cả đợt
- `đã_dùng(SKU)` = baseline trong `usage-baseline.json` + mọi request trong `run-logs/*/<YYYYMM>*.log` của **tháng đang chạy** (thư mục T-106, T-110, T-111 đều tính; log tháng khác không). Cách đếm một log: theo `run=<id>`, nếu có dòng `GOOGLE_REQUEST` thì đếm các dòng đó (mỗi request gửi, kể cả lượt lỗi và retry, một dòng, ghi và flush **trước khi gửi**), nếu không thì `GOOGLE_USAGE` của run đó (log kiểu T-106 không có `run=`). Log không có dòng nào trong hai loại ở `run-logs/T-110/` hoặc `run-logs/T-111/`: chạy thật bị từ chối (`USAGE_LOG_UNREADABLE`). Đọc log từ nhánh `main` đã checkout; vì vậy mọi lần chạy thật trước đó phải có log trên `main` (sổ đăng ký, Hành vi 4).
- `TS_cum`, `PH_cum` = `đã_dùng` + request của lần này. **`net = 0,040 × max(0, TS_cum + 50 − 1000) + 0,007 × max(0, PH_cum + 50 − 1000)`** (biên an toàn 50 mỗi SKU; Place Details đếm vào ảnh; Geocoding, khi bật, giá $0,005 và hạn mức 10.000 chưa kiểm: đếm vào `gross`, `net` coi như miễn phí). `gross` của đợt = `0,040 × Text Search + 0,007 × ảnh + 0,005 × geocode` chỉ của các log `run-logs/T-110/`, `run-logs/T-111/` và lần này (không trừ miễn phí).
- `--cap-basis` chọn `net` hay `gross` để so với `--budget-usd` (**cho cả đợt, không cho riêng lần chạy**); mặc định **net** (chi tiền thật, ADR-049 "Trần chi: $30"). Không còn câu hỏi mở về cơ sở tính: mặc định `net`, đổi được bằng input `cap_basis`.
- Trước **mỗi request**: ước tính sau request ≤ trần, nếu không thì dừng. Trước **mỗi Text Search**: ước tính sau (Text Search + `max_photos` request ảnh) ≤ trần (không dừng giữa chừng một vendor). Dữ liệu từng vendor được lưu ngay khi xong (không đợi hết category).
- Dừng vì trần: thoát 0, `BUDGET_STOP`, vendor chưa làm không đổi byte và không có dòng audit; chạy lại **với cùng trần** không tiêu thêm (đợt đã tiêu), muốn làm tiếp phần còn lại thì tăng `budget_usd` (≤ 30).
- Dry-run in `DRY_RUN_SCOPE` (mỗi category), `DRY_RUN_COST`, `DRY_RUN_PLAN` (tích luỹ theo thứ tự chạy), `DRY_RUN_VERDICT` (`within_cap`, `stops_after`), 0 request, không cần khoá, không đổi file. Công thức "kỳ vọng": `Text Search = N × 1,15 + retry_only`, `ảnh = N × 0,60 × max_photos` (giả định khớp 60%, `no_match` lượt 1 là 15%, **tự tin ~50%**); "cận trên": `Text Search = N + ⌈N × 0,30⌉ + retry_only`, `ảnh = N × max_photos` (mọi vendor khớp, `no_match` 30%). Con số "kỳ vọng" không đổi so với v1 vì mọi `no_match` giờ đều có lượt 2 (trước đây 80% bị bỏ lượt 2).

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
- Không chạm: payment, auth, schema DB, dữ liệu cá nhân người dùng; không liên hệ vendor; giá vendor (ADR-025); UI front; `main.py`. **Chạm có chủ đích (v2):** `scrape-vendors.yml` chỉ để bỏ `schedule` và thêm `concurrency: google-places` (không đổi lệnh bên trong); `enrich-venue.yml`, `refresh-vendor-photos.yml` chỉ thêm `concurrency: google-places`.
- **Quan hệ với T-106, T-109, T-110, T-112:**
  - **T-112 hiện thực T-110.** T-110 (merge, chạy) trước T-111. Request của T-110 (≤ 9) và T-106 tính chung vào trần $30 của đợt (log `run-logs/T-110/` được cộng tự động).
  - Trạng thái tạm đóng cửa: định nghĩa **một lần ở T-110 Hành vi 6** (`closed_state="temporarily_closed"` + `retry=true`, ẩn khỏi pool, INV-021 (f)); T-111 dùng đúng dấu hiệu đó; nếu T-110 đổi dấu hiệu, đổi **một chỗ** ở `eval/T-111/_t111.py::is_temp_closed`.
  - Công cụ pool: `--prune` và bỏ vendor `closed_state` ở nguồn pool là của T-110/T-112; T-111 dùng lại, giữ `check_7` (b)(c) làm kiểm hồi quy và thêm `--photos-for all`. T-109 hạng mục 1 nằm ở T-112, T-109 còn hạng mục 2 và 3.
  - `scrape-vendors.yml` và các workflow Google khác: xem Hành vi 7 (yêu cầu có eval).
- Bậc lưới lọc: **C** (đã giao, "Hỏi trước"): dịch vụ trả phí, gỡ vendor khỏi app, chạy thật cần Capu bấm. Capu merge PR dữ liệu và PR pool.

## Tiêu chí chấp nhận và eval
Mọi eval chạy offline: Google giả nạp qua `PYTHONPATH=eval/T-111/_fake`, chạy đúng lệnh CLI trong thư mục `tools/scraper` tạm (bản sao code thật, không `output/` thật), `python3 -I eval/T-111/<file>`. Cần `TOHONG_REPO` (mặc định `../tohong`); `check_1`, `check_7`, `check_11` dùng thêm dữ liệu/ repo thật. Hạ tầng dùng lại của T-110 (`eval/T-110/_t110.py`). Thiếu cài đặt thì in `FAIL`, không `ERROR`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | `--dry-run` trên dữ liệu thật in số vendor theo từng category của 14 category (bản ghi, id duy nhất, eligible, trong pool, ngoài pool, thử lại, đã khớp, trong phạm vi) **bằng** số tự đếm lại; 0 lượt Google; không đổi file | `python3 -I eval/T-111/check_1_pham_vi_dem.py` |
| 2 | Luật mỗi vendor: giữ+≤2 ảnh; `CLOSED_PERMANENTLY` gỡ ở mọi file; tạm đóng (kể cả ứng viên bị cổng từ chối) ở lại, ẩn, không remove dù lần sau không trả gì, được nhận khi mở lại; **tạm đóng do Google báo thử lại tối đa 3 lần rồi dừng, vào review, không remove**; `low_confidence` vào review không remove; lượt 2 chấm G1 bằng tên gốc; `no_match` qua 2 lượt khác nhau rồi remove, có `REMOVED_VENDOR` | `python3 -I eval/T-111/check_2_luat_moi_vendor.py` |
| 3 | Lượt 2 duy nhất: hàm `short_name` khớp bảng 36 ca (không biến tên riêng thành từ chung, "Tài" ≠ "tại", Kim Hanyoung/Paper Color/Marks & Spencer…); MỌI vendor đúng 2 lượt khác nhau; không ai bị remove sau 1 lượt; chạy lại 0 lượt | `python3 -I eval/T-111/check_3_ten_rut_gon.py` |
| 4 | Duyệt tay (T-110) thắng luật gỡ; tập G4 chỉ nhận `CLOSED_PERMANENTLY` Google báo; audit cũ không tìm lại, `no_match` cũ đúng 1 lượt 2; lỗi HTTP không tính là đã thử và mọi lượt gửi được đếm; Geocoding mặc định tắt, bật thì được đếm | `python3 -I eval/T-111/check_4_tuong_tac_t110_va_audit.py` |
| 5 | Trần $ **tích luỹ cho cả đợt**, tự dừng giữa chừng không vượt trần (net, gross); lần sau cùng trần không tiêu thêm, tăng trần làm tiếp không đếm đôi; log nhiều việc cộng, tháng khác không; lần chạy bị giết vẫn được đếm; log hỏng từ chối; đếm theo (tệp, run_id) nên USAGE của `refresh` không bị bỏ; trần > 30 bị từ chối | `python3 -I eval/T-111/check_5_tran_chi_tu_dung.py` |
| 6 | Dry-run in số lượt + ước tính $ (kỳ vọng, cận trên, tích luỹ theo category, điểm dừng) đúng công thức, 0 request | `python3 -I eval/T-111/check_6_dry_run.py` |
| 7 | Pool: vendor đã remove và vendor `closed_state` (kể cả `low_confidence` mang `closed_state`) không có trong pool; quay lại pool khi được nhận; `low_confidence` thường ở lại; ảnh Google mọi category (`--photos-for all`). Kiểm hồi quy `--prune` của T-110/T-112 (không `--prune` thì thoát 1, nguồn rỗng bị từ chối) | `python3 -I eval/T-111/check_7_pool_tam_dong_va_remove.py` |
| 8 | Remove khôi phục được: bản ghi nguyên vẹn, `--restore` đưa về, không bị tìm/gỡ lại | `python3 -I eval/T-111/check_8_remove_khoi_phuc_duoc.py` |
| 9 | Báo cáo theo category (giữ/remove/tạm đóng/review/có ảnh) đúng định nghĩa và khớp dữ liệu; danh sách `REMOVED_VENDOR`; `GOOGLE_USAGE` khớp | `python3 -I eval/T-111/check_9_bao_cao_theo_category.py` |
| 10 | Một workflow chung cho mọi category: input `dry_run`, `budget_usd`, `categories`, `max_photos`, `cap_basis`, `include_non_pool`; chặn > 30; bước `check_runs.py` (gh run list + gh pr list) trước enrich thật; `run-name` REAL/DRY; log tên `run-<run_id>`, không xoá log, upload artifact; không `--all`, không `--geocode`; body PR có `REMOVED_VENDOR` + `--restore`; mọi workflow dùng khoá Google có `concurrency.group == google-places` và `cancel-in-progress: false`; `scrape-vendors.yml` hết lịch | `python3 -I eval/T-111/check_10_workflow.py` (cấu trúc YAML; workflow cần runner GitHub nên không chạy offline, hành vi lệnh đã đo ở 2–9, 12) |
| 11 | INV-012..019 xanh trên dữ liệu thật và INV-015..019 xanh trên trạng thái fixture sau khi chạy luật (hai lần) | `python3 -I eval/T-111/check_11_bat_bien_xanh.py` |
| 12 | Sổ đăng ký lần chạy: ba tình huống log không lên `main` (mở PR hỏng, đóng PR không merge, log bị xoá) bị liệt kê và chặn; đủ log (khớp nguyên id) thì chạy; DRY và lần hiện tại bỏ qua; `usage-baseline.json` `runs_accounted` + `decision` là lối thoát duy nhất; PR dữ liệu mở của `enrich-vendors/`, `venue-enrich/`, `resolve-overrides/` bị chặn | `python3 -I eval/T-111/check_12_so_dang_ky_lan_chay.py` |

Đỏ hôm nay (đúng dự kiến, FAIL không ERROR): cả 12 (CLI chưa có cờ mới, workflow chưa có, pool tool còn lỗi T-109). Đã xanh sẵn: phần A của check_11 (INV-012..019 trên dữ liệu thật) và bất biến đề xuất. check_3 đã khoá hàm `short_name` (36 ca) trước khi đỏ ở bước CLI. check_7 tái hiện đúng lỗi T-109 ("✗ 1 vendor trong pool nền không có trong …").

Giới hạn đã biết: (a) eval dùng Google giả nên **không** đo được tỉ lệ khớp thật hay "khớp đúng nhà hàng"; đó là mắt Capu trên `review-needed.csv` và báo cáo category; (b) giá và hạn mức miễn phí là công thức trên log, không phải hoá đơn: Capu đối chiếu console sau mỗi lần chạy (agent không đọc được); (c) mọi ước tính tỉ lệ khớp ở trên là giả định từ venue/photography; (d) kiểm đúng "ảnh Google thuộc đúng nhà hàng" dựa vào sáu cổng đã có (T-106), không thêm cổng.

## Bất biến đề xuất (tầng 2)
- **A. Pool không chứa vendor đã gỡ** (`planner/vendor/images`): bản nháp `eval/T-111/inv-proposed-pool-khong-vendor-da-go.py` (xanh hôm nay: pool 960, 8 vendor đã gỡ). Vế tạm đóng cửa **không** lặp lại: đã có ở INV-021 (f) của T-110 (`closed_state`); khi rút vào bể, gộp A vào INV-021 hoặc giữ riêng vế "đã gỡ" để không có hai định nghĩa.
- **B. Hạn mức tháng không bị tiêu mù** (đề nghị sau, chưa có file): sổ dùng Google ghi chung (T-106 đã nêu `google-usage.jsonl`); với T-111 `usage-baseline.json` + `run-logs/*` đã là sổ. Không rút bất biến vì baseline đổi theo tháng.
- INV-012..019 giữ nguyên, không đề xuất đổi.

## Không làm
- Đổi luật sáu cổng hoặc hàm chuẩn; vendor tự gửi ảnh; đổi UI; đổi giá; thêm `place_id` vào pool; rating/reviews/mô tả Google vào pool.
- Gọi Google, đổi dữ liệu thật hay commit trong việc viết spec này (chạy thật là lần bấm workflow của Capu sau Code Gate).
- Tạo pool trong workflow dữ liệu; chạy `main.py`; `enrich.py --all` bản cũ; đổi lệnh bên trong `scrape-vendors.yml` (chỉ bỏ lịch và thêm nhóm concurrency).
- Vendor ngoài pool (160) trừ khi Capu bật `include_non_pool`.
- Ảnh còn thiếu của 4 vendor đã có place_id (photography): `refresh_photos.py` có sẵn, không nằm trong workflow này.
- Phone/website: không đổi cách ghi (T-109 hạng mục 2). **Rủi ro đã biết:** pipeline ghi đè phone/website marry.vn bằng Google không lưu bản cũ; vendor bị hạ sau này mất số gốc. Pool không dùng phone nên không ảnh hưởng app.
- Mask Text Search hẹp hơn để rẻ hơn (cơ hội ghi nhận: bỏ phone/website/rating/reviews/mô tả thì SKU xuống Pro $32/1.000, Google ghi 5.000 lượt miễn phí nhưng **chưa kiểm**; đồng thời hết ghi đè phone). Đổi dữ liệu thu về nên không làm trừ khi Capu bảo.

## Câu hỏi mở
Không. (Cơ sở tính trần: Chief of Staff chốt mặc định `net`. Lượt 2 cho 80% vendor dùng tên gốc không kèm địa danh: Chief of Staff chốt ở D1 B3; vendor bị gỡ đều có trong danh sách `REMOVED_VENDOR` để Capu duyệt và `--restore`.)

## Lịch sử sửa
- v1 (2026-11-08): bản đầu. Gộp lỗi pool T-109 hạng mục 1 theo đề nghị của Chief of Staff; khớp T-110 D1 (tạm đóng cửa định nghĩa ở T-110, duyệt tay thắng luật tự động, tập G4 chỉ nhận CLOSED_PERMANENTLY Google báo, T-110 merge trước T-111, request T-110 tính chung trần).
- **v2 (2026-11-08, spec rework theo `handoffs/T-111-D1.md`, Chief of Staff phân xử; lỗi spec, không phải lỗi code):**
  - B1: trần $30 là **cho cả đợt**, tích luỹ qua mọi log T-106/T-110/T-111 trên `main`; từ chối chạy thật khi còn PR `enrich-vendors/*` mở; mỗi request ghi log ngay (`GOOGLE_REQUEST`, trước khi gửi); log hỏng thì từ chối. check_5 B đổi kỳ vọng (cùng trần: 0 lượt; tăng trần: làm tiếp phần còn lại), thêm F (lần chạy bị giết), G (log hỏng).
  - B2: dùng đúng dấu hiệu tạm đóng cửa của T-110 (`closed_state` + `retry`); thêm hai ca vào bảng luật: ứng viên `CLOSED_TEMPORARILY` bị cổng từ chối vẫn ẩn; vendor đang tạm đóng mà Google không trả gì thì giữ nguyên trạng thái ẩn, không remove. Sửa `is_temp_closed`, fixture `P_temp`/`P_tlow` của check_7, bất biến đề xuất (bỏ vế tạm đóng, đã có ở INV-021 f).
  - B3: lượt 2 luôn có và luôn khác lượt 1: tên rút gọn nếu rút được tên riêng có nghĩa, không thì tên gốc không kèm địa danh; không vendor nào bị remove sau một lượt. Sửa `short_name`: so có dấu ("Tài" ≠ "tại"), không biến tên riêng thành từ chung, từ nối đầu cuối bị bỏ; bảng 26 ca (thêm 6 ca D1). Số đo: 155/795 vendor có tên rút gọn, 640/795 dùng tên gốc trần. Thêm `REMOVED_VENDOR` và body PR (M5).
  - B4: G1 lượt 2 chấm bằng **tên gốc**; ca `s_golf` trong check_2 (độ giống 0,377 < 0,4 so với 0,588 nếu chấm bằng tên rút gọn).
  - B5: Geocoding tắt mặc định (`--geocode`), bật thì đếm; `concurrency: google-places` cho mọi workflow Google, `scrape-vendors.yml` bỏ lịch; thành yêu cầu có eval ở check_10 (và check_4 E).
  - M1: Hành vi 5 dùng lại `--prune` của T-110/T-112; check_7 (b)(c) giữ làm hồi quy. M2/M3: đếm theo `GOOGLE_REQUEST`, retry/lượt lỗi được đếm (check_4 D). M4: check_10 thêm kiểm bước chặn PR mở, nhóm concurrency bằng khoá YAML, các workflow khác. M5: danh sách vendor bị gỡ. Xoá câu hỏi `net`/`gross`.
- **v3 (2026-11-08, spec rework theo `handoffs/T-111-D2.md`; lỗi spec):**
  - B1: chặn "còn PR mở" không đủ (log có thể không bao giờ lên `main`: mở PR hỏng, đóng PR không merge, bước kiểm khoá xoá log, lần sau tìm lại cả phạm vi, chi thật ước tính ~$52). Thêm sổ đăng ký lần chạy: `run-name` REAL/DRY, tên log `run-<GITHUB_RUN_ID>`, `check_runs.py` (gh run list + gh pr list, PR mở của 4 tiền tố) trước mọi lệnh Google, lối thoát duy nhất là `usage-baseline.json` `runs_accounted` + `decision` của Capu, log không bao giờ bị xoá (chỉ che khoá, upload artifact). Eval mới check_12 (ba tình huống, baseline, tiền tố PR, va chạm `run-1010`), check_10 mở rộng.
  - M1: `short_name` v3 (thêm từ chung, S1 giữ ngoặc ở đầu, S4 không tách & một từ, bỏ vế hành chính, chọn vế hợp lệ đầu tiên), bảng 36 ca; số đo 141/795 có tên rút gọn. M2: định nghĩa `run_id`, đếm theo (tệp, run_id) (check_5 H). M3: `cancel-in-progress: false` (check_10). M4: ghi lượng review thêm ~96 dòng (đoán ~40%). M5: tạm đóng do Google báo thử lại tối đa 3 lần rồi dừng, vào review, không remove (`closed_retries`, `retry_exhausted`; check_2 lần 3 và 4); chỉ ra tổ hợp `closed_state` + `retry=false` cần T-112 chấp nhận.
