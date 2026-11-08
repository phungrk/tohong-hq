# Spec T-106: enrich-venue

## Ý định
Capu thấy card "Tiệc & nhà hàng" vẫn hiện "Ảnh minh hoạ" (T-068) sáng 2026-11-08, trong khi ảnh Google đã chạy cho 68 vendor chụp ảnh/làm đẹp (T-104, ADR-041). Cặp đôi chọn nhà hàng bằng mắt: vendor venue cần ảnh thật của nhà hàng, trong hạn mức miễn phí của tháng 11. Nguồn: `board/T-106.md` (Brief), `decisions/2026-11-08-adr-041-anh-vendor-google-place-photos.md`.

## Bằng chứng
- Venue chưa từng được enrich: pool tohong-back có 96 vendor `category=venue`, 0 vendor có `enrichment_log[source=google_maps].place_id` (đo 2026-11-08 trên `tohong/tools/scraper/output/HCMC/venue/vendors.json`: 99 bản ghi, cả 99 `auto_scraped`, cả 99 có địa chỉ nên đủ điều kiện enrich). Lý do chưa chạy (suy luận, tự tin ~65%): `scrape-vendors.yml` chạy `enrich.py --all --budget 5.0` theo thứ tự thư mục (venue đứng sau 7 category khác), trần $5 ≈ 142 lượt có thể hết trước venue; và lần chạy 2026-11-01 đỏ sau 16 giây (`gh run list`, lần duy nhất liệt kê được), chưa tới bước enrich.
- Mẫu cùng quy trình: photography có place_id 73/97 (75%); refresh run 2 (`gh run view 42427615510`): ok 66/73, requests=202 (details=73, media=129). Từ đó ước venue: ~72 place_id, ~65 có ảnh. **Phỏng đoán** (venue chưa có số): tên nhà hàng riêng biệt hơn tên studio nhưng địa chỉ dài và bẩn hơn. Tự tin ~50% cho việc đạt tiêu chí 1 (≥60), ~60% cho tiêu chí 2 (≥50).
- Khớp sai có thật trong dữ liệu: trong 73 place_id của photography, 29 có `confidence` < 0,6 và 11 < 0,5 (đo từ `enrichment_log`). Đọc bằng mắt, ít nhất 5 khớp sai rõ: LOVIDOVI → "Lavender Studio" (0,50; hiện đang mang ảnh của Lavender trong pool), PHOTOTELLER → "PHOTOBY VIETNAM" (0,46), Lamour Digital → "L'amour Laser Centre" (0,49), Phim trường HeBe → "BỜM WEDDING" (0,44), 2Lstudiosaigon → "2Q Studio" (0,55). Ngược lại nhiều khớp đúng cũng dưới 0,6: Ahihi Studio (0,43), Tony Wedding (0,48), Moza (0,50), Hera Studio (0,50). Ngưỡng cứng 0,4 (code hiện tại) nhận sai; ngưỡng cứng 0,6 bỏ khoảng 40% khớp đúng và dự đoán còn ~44/96 venue, không đạt tiêu chí 1. Vì vậy luật nhận khớp dưới đây dùng thêm địa chỉ (venue có địa chỉ gốc, photography thì không).
- Giá Google (đọc `developers.google.com/maps/billing-and-pricing/pricing` 2026-11-08): Text Search Enterprise $35/1.000, Enterprise + Atmosphere $40/1.000, Place Details Photos $7/1.000; cả ba **miễn phí 1.000 lượt/tháng**. Field nào thuộc SKU nào **chưa xác nhận** được (trang giá không liệt kê); mask hiện có `reviews` và `editorialSummary`, nhiều khả năng rơi vào Enterprise + Atmosphere (tự tin ~65%), nên eval dùng $0,04/lượt làm chặn trên. Text Search tháng 11 đã dùng: **giả định ~0** (enrich photography chạy 2026-05-28 và 06-16; scrape tuần đỏ), tự tin ~75%. Không ghi là câu hỏi mở.
- Hạn mức ảnh: đã dùng 606/1.000 (brief). 606 = 3 × 202 khớp với việc refresh chạy 3 lần (run 1 đỏ ở bước mở PR vẫn tiêu request), suy luận tự tin ~60%. Cách đếm của eval: tính **cả Place Details lẫn media** vào SKU Photos (chặn trên, nhất quán với 606).

## Giả thuyết
Nếu 96 vendor venue có place_id + ảnh Google thì card "Tiệc & nhà hàng" hết "Ảnh minh hoạ" ở phần lớn vendor và cặp đôi tin gợi ý hơn. Chỉ số: tỉ lệ vendor venue có ảnh Google (hôm nay 0/96 → ≥50/96). Chỉ số bảo vệ: request SKU Photos tháng ≤ 1.000; không vendor nào hiện ảnh của nhà hàng khác.

## Hành vi (người dùng thấy gì)
1. Cặp đôi mở card Tiệc & nhà hàng: vendor có ảnh Google hiện 1–4 ảnh thật kèm tên tác giả (UI T-104 #64 giữ nguyên, không đổi UI); vendor chưa có ảnh Google hiện ảnh minh hoạ T-068 như hôm nay. Không vendor nào biến mất khỏi danh sách, trừ vendor có place_id Google trả 404 (cơ chế spec 005, vào `removed_vendors.json`).
2. **Luật nhận khớp.** Kết quả Text Search của một vendor chỉ được ghi `place_id` khi `confidence` ≥ 0,6, hoặc `confidence` ≥ 0,4 **và** `address_match` = true. Không đạt: vendor không có `place_id`, không có ảnh Google, audit ghi `status = "low_confidence"`, và vendor vào `review-needed.csv`. `confidence` là phép đo tên hiện có của pipeline (không đổi cách tính).
3. `address_match` = true khi (a) tên đường của địa chỉ vendor **trước khi enrich ghi đè** (phần trước dấu phẩy đầu tiên, bỏ số nhà ở đầu, bỏ dấu, chữ thường, dài ≥ 4 ký tự) là chuỗi con của `formattedAddress` Google (cùng cách chuẩn hoá), và (b) nếu cả hai địa chỉ đều nêu quận/huyện thì hai quận/huyện bằng nhau (số quận so theo số: "Quận 1", "Q1", "Q.1" là một; tên so sau khi bỏ dấu và bỏ chữ "Quận/Huyện"). Còn lại là false. Ví dụ: "309B – 311 Nguyễn Văn Trỗi, P.1, Quận Tân Bình…" với Google "309B Nguyễn Văn Trỗi, Phường 1, Tân Bình, Thành phố Hồ Chí Minh" → true; cùng tên đường nhưng Google ghi "Quận 3" còn vendor ghi "Quận Tân Bình" → false; vendor không có tên đường rút ra được → false. Giá trị được ghi vào `enrichment_log` của lần khớp.
4. **Review.** Mỗi vendor `low_confidence` có đúng một dòng trong `output/HCMC/venue/review-needed.csv` với `flags` chứa `low_confidence_place` và hai cột mới `google_matched_name`, `google_confidence` có giá trị, để Capu đọc và so tên. Vendor `no_match` (Google không trả gì) không cần dòng riêng.
5. **Pool.** Sau T-106 pool tohong-back khác pool trước đó ở đúng các trường `photos`, `styles`, `tags` của vendor venue (styles/tags chỉ đổi theo lệnh `tools/regen-pool-styles.sh`, ADR-025, vì văn bản nguồn venue có thêm đánh giá Google). Mọi trường khác của mọi vendor (đặc biệt `priceMin`, `priceMax`, `rating`, `reviewCount`, `reviews`) giữ nguyên; `rating`/`reviews` từ Google **không** đưa vào pool trong việc này. Vendor venue có `photos` đổi thì toàn bộ ảnh mới là `source = "google"`, host `lh*.googleusercontent.com`, mỗi ảnh có `attribution` (INV-013, T-104).
6. **Chạy.** Phiên cloud không có khóa và không gọi được Google. Việc chạy do Capu bấm (workflow_dispatch) hoặc chạy local. Thứ tự: (i) `--dry-run` cho riêng category venue: không gọi Google, không đổi file, in số vendor đủ điều kiện và ước tính request; (ii) Capu đồng ý (mức "Hỏi trước"); (iii) một lần enrich thật cho riêng venue (`--state HCMC --category venue --budget 5.0`, ảnh từ pipeline ≤ 50 lượt media); (iv) một lần `refresh_photos.py` chỉ cho vendor venue có place_id mà chưa có ảnh, với `--max-requests` do người chạy đặt sao cho 606 + (ảnh ở bước iii) + trần này ≤ 1.000 (khuyến nghị 250 → trần tổng 906); (v) tạo lại pool chỉ `photos` + `styles` cho venue và mở PR tohong-back. Không chạy `main.py` (scrape marry.vn đã chết) và không chạy `enrich.py --all`.
7. **Log.** Mỗi lần chạy thật của `enrich.py` và `refresh_photos.py` in đúng một dòng cuối `GOOGLE_USAGE text_search=<n> photo_details=<n> photo_media=<n>` và stdout được lưu vào `tools/scraper/run-logs/T-106/YYYYMMDD-<tên>.log` (commit cùng PR). Log không chứa khóa API.
8. Đơn vị đếm của ngân sách: dự kiến enrich 96–99 lượt Text Search (≤ $3,96 ở $0,04; kỳ vọng $0 vì trong 1.000 lượt miễn phí); ảnh tối đa 50 (bước iii) + ≤ 250 (bước iv) = 300 → 606 + 300 = 906 ≤ 1.000, còn dư 94. Ca xấu nhất mọi vendor đều khớp: bước iii tối đa 25 vendor có ảnh, bước iv cần (96 − 25) × 3 = 213 ≤ 250. Chạy lại vì lỗi: **đọc log trước**, không chạy lại mù (bài học run 1 của spec 005).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (tools/scraper, workflow) · `phungrk/tohong-back` (pool) · Nhánh: `t-106-enrich-venue` (mỗi repo) · Vùng (`area`): `planner/vendor/images`
- Bất biến đã đọc: `eval/invariants/_shared/` (inv-001 không secret, inv-002 sổ cái), `planner/` (001–004 vite, không liên quan), `planner/vendor/images/` (001–011). Spec không vi phạm INV-001/002/003/004 (không chạm manifest Pages/mirror; INV-001 images hôm nay "chưa áp dụng" vì chưa có manifest), INV-005..009 (Wayback/mirror, không chạm). Phụ thuộc INV-012 (pool không chứa `places.googleapis.com`) và INV-013 (ảnh Google có ghi công) do T-104 đang chờ adversary rút vào bể; chưa có file trong `eval/invariants/` ở thời điểm viết, nên check_4 đo lại ý INV-012 trực tiếp. Bất biến anh em `planner/vendor/pool` (001 styles khớp nguồn, 004 pool trung gian không vào git) không nằm trong cây cha của vùng này nhưng spec chạm pool, nên check_6 chạy lại pool/inv-001.
- Kiến trúc: ảnh chỉ qua `photoUri` (spec 005 FR-001/003): không tải byte ảnh, không URL `places.googleapis.com` trong pool; mirror (`vendor-images`) bỏ qua ảnh `source=google` (đã có).
- Không chạm: giá vendor (ADR-025), UI front, manifest ảnh, schema pool (không thêm `place_id` vào pool), `scrape-vendors.yml` (không được bật lại cho tới khi T-106 xong: nếu scrape chạy được thì `enrich.py --all` ăn 50 lượt media + ~142 Text Search mỗi tuần, phá hạn mức tháng 11).
- Bậc lưới lọc: **C** (đã giao) — dịch vụ trả phí + mức "Hỏi trước"; Capu đọc diff hành vi và tự merge PR tohong-back.
- Hợp đồng dữ liệu cho eval (Engineering phải sinh đúng):

| Thứ | Ở đâu | Nội dung |
| --- | --- | --- |
| place_id | `tohong/tools/scraper/output/HCMC/venue/vendors.json` → `enrichment_log[source=google_maps]` | `place_id`, `confidence`, `address_match` (bool) |
| audit | `…/venue/enrichment-audit.json` | danh sách `{vendor_id, status, confidence, matched_name, …}`, status gồm `low_confidence` |
| review | `…/venue/review-needed.csv` | cột `id`, `flags` (ngăn bằng `\|`), `google_matched_name`, `google_confidence` |
| log chạy | `tohong/tools/scraper/run-logs/T-106/*.log` (hoặc `T106_LOG_DIR`) | dòng `GOOGLE_USAGE …` (hoặc `RESULT … requests=n (details=a, media=b)` cũ của refresh) |
| pool | `tohong-back/lib/vendorPool.generated.js` | `photos[].source` / `.url` / `.attribution` |

## Tiêu chí chấp nhận và eval
Biến môi trường: `TOHONG_REPO` (mặc định `../tohong`), `TOHONG_BACK_REPO` (mặc định `../tohong-back`), `T106_LOG_DIR`, `T106_MONTH` (2026-11), `T106_PHOTOS_BASELINE` (606), `T106_BASE_REF` (mặc định merge-base HEAD origin/main của tohong-back; chạy `git fetch origin main` trước). Mọi eval chỉ đọc file/log, **không gọi Google**.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | ≥ 60/96 vendor venue của pool có place_id Google | `python3 -I eval/T-106/check_1_place_id.py` |
| 2 | ≥ 50 vendor venue trong pool có ≥ 1 ảnh Google (source=google, host lh*.googleusercontent.com) | `python3 -I eval/T-106/check_2_anh_google.py` |
| 3 | Request SKU Photos tháng 11 ≤ 1.000 (606 + log T-106) và Text Search ≤ $5, đo bằng log; log không lộ khóa | `python3 -I eval/T-106/check_3_han_muc.py` (hóa đơn thật: Capu đối chiếu console, agent không đọc được) |
| 4 | Pool (và `google_photos.uri` nguồn) không chứa `places.googleapis.com` | `python3 -I eval/T-106/check_4_khong_url_api.py` (xanh sẵn: lưới chặn hồi quy) |
| 5 | Vendor khớp sai (low_confidence) vào review-needed.csv, không vào pool; mọi place_id venue qua luật nhận khớp (hành vi 2–4) | `python3 -I eval/T-106/check_5_khop_sai_vao_review.py` |
| 6 | Ràng buộc kế thừa ADR-025/041 (không phải tiêu chí mới của Capu): pool chỉ đổi photos/styles/tags của venue, giá không đổi | `python3 -I eval/T-106/check_6_pool_chi_doi_photos.py` |

Giới hạn đã biết của eval: (a) tiêu chí 3 là phép đo thay thế từ log, không phải hóa đơn; (b) tiêu chí 5 kiểm dữ liệu nhất quán với luật nhận khớp, không kiểm được "khớp đúng nhà hàng" (cần Google), việc đó là mắt Capu trên `review-needed.csv`; (c) check_5 yêu cầu mọi vendor của pool venue "đã được thử" (có place_id hoặc có dòng trong audit) nên đỏ nếu enrich chưa chạy hết.

Đỏ hôm nay (đúng dự kiến): check_1, 2, 3, 5, 6; check_4 xanh. Đã chạy cả sáu trên fixture dựng sẵn (66 vendor khớp, 6 low_confidence, log mẫu): xanh 6/6, và đỏ đúng lý do khi cố ý phá (giá đổi, ảnh lẫn marry, URL API, vượt hạn mức, lộ khóa, low_confidence lọt vào pool, nhận khớp thiếu address_match).

## Bất biến đề xuất (tầng 2)
- **A · `planner/vendor/images`: ảnh Google truy được về place_id.** Mọi vendor trong pool có ảnh `source=google` đều có `place_id` trong dữ liệu nguồn cùng id (để làm mới hàng tháng và gỡ khi 404). Hôm nay đúng 68/68. File mẫu: `eval/T-106/inv-proposed-anh-google-truy-ve-place-id.py`.
- **B · `planner/vendor/images`: nhận khớp có cổng.** Mọi bản ghi `enrichment_log` có trường `address_match` (tức từ T-106 trở đi) thỏa `confidence ≥ 0,6` hoặc `confidence ≥ 0,4 và address_match = true`; mọi vendor có audit mới nhất `low_confidence` không có `place_id`. Phạm vi "có trường `address_match`" để không đỏ oan 73 bản ghi photography cũ (xem Rủi ro). File mẫu: `eval/T-106/inv-proposed-nhan-khop-co-cong.py`.
- **C · `_shared/inv-001`: thêm mẫu khóa Google `AIza[0-9A-Za-z_-]{35}`** vào bộ mẫu secret (hiện chỉ có Anthropic/PostHog/GitHub/Slack/AWS/khóa riêng); sửa bất biến có sẵn nên qua Chief of Staff và ghi `decisions/`. Lý do: T-106 là lần đầu log chạy Google được commit vào repo.
- Không đề xuất làm bất biến cho "request/tháng ≤ 1.000 theo log": đo cần baseline (606) sẽ cũ mỗi tháng và log tháng khác không nằm trong repo; để ở check_3 của việc. Đề xuất sau nếu muốn: sổ dùng Google `google-usage.jsonl` do chính hai công cụ ghi thêm.
- INV-012/013 đã được ADR-041 giao cho T-104, không đề xuất lại.

## Không làm
Các category khác (decor, attire, …: việc riêng sau 1/12); ảnh vendor tự gửi (T-070 B); đổi UI card; đưa rating/review/mô tả Google vào pool; thêm `place_id` vào pool; sửa hay bật lại `scrape-vendors.yml`; kiểm lại khớp sai của 73 vendor photography đã có (xem Rủi ro); duyệt tay `review-needed.csv` (Capu làm sau, ngoài việc này).

## Câu hỏi mở
Không.
