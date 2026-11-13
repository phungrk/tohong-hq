# Spec T-140: chat-ghep-vendor-computematches

> v1 · Spec Writer (product) · 2026-11-13 · bậc B · vùng `planner/vendor/images` (chạm cả `planner/vendor/matching`) · repo `phungrk/tohong-back` (bước 1), `phungrk/tohong-back` + `phungrk/tohong` (bước 2, việc sau). Nguồn: `board/T-140.md`, `decisions/2026-11-13-adr-077-chat-ghep-vendor-trong-worker-bo-cloud-run.md`. Liên quan: `products/T-136-chat-vendor-theo-pool.md` (v3), `handoffs/T-138-v2.md`, `products/T-072-hop-dong-style-chung.md`.

## Ý định
Capu (ADR-077, 2026-11-13): "B giữ được chất lượng của A và bỏ hẳn Cloud Run". Chat AI gợi ý vendor bằng bộ ghép JS chạy trong Worker, cùng pool + overlay admin với tab Vendor, không gọi mạng; hai thứ Python có mà JS chưa có (nới điều kiện khi thiếu, đa dạng MMR) được chuyển sang JS; Cloud Run bị bỏ hẳn, bước gỡ tách ra làm sau.

## Bằng chứng
- Đường chat hiện tại (đọc `tohong-back` origin/main): `lib/contextBuilder.js` → `callMatcher` (`lib/matcherAdapter.js`, `fetch` tới `MATCHER_URL`) → `filterMatchesByPool` (`lib/poolFilter.js`, T-138) → `applyOverlayToMatches` → `formatMatchBlock`. Cloud Run `matcher-service` đang "Service is disabled" (ADR-077) nên chat **hiện không có ứng viên nào**.
- Tab Vendor: `api/vendors.js` gọi `computeMatches` (`lib/vendorMatcher.js`) với `limit/offset/minScore`; bộ này tự bỏ vendor admin ẩn, áp giá overlay (`applyToVendor`), lọc `isVerified` và rating 0<r<3,5, chấm điểm (style .35, lịch .25, ngân sách .20, sức chứa .10, chất lượng .10), **không có lọc cứng theo ngân sách, không nới, không MMR**; nếu pool không có vendor ở thành phố của cặp đôi thì bỏ lọc thành phố.
- Python (`matcher/matcher.py`, `stage1_filters.py`, `stage3_boosts.py`): lọc cứng (verified, category, city, ngân sách `price_min <= budget`, sức chứa, lịch, dealbreaker, lead time) → nếu `< top_k` thì `_relax_and_retry` → top 20 theo điểm → boost → MMR (λ=0,3, tương tự Jaccard của style tag, R8) → top 5. `_relax_and_retry` chỉ có **một** bước thật: ngân sách ×1,2 (`int(...)`), nhận khi thêm được vendor; "bước 2 bỏ lead_time" chỉ là ghi chú chưa cài, chỉ thêm cảnh báo.
- Pool JS (`lib/vendorPool.generated.js`, 867 vendor, 100% HCMC) không có: sức chứa, lịch ngày, lead time, tọa độ, `top_reviews`, `reviews.last_updated`, `cultural_specialties`; 11 vendor không có giá (10 là `stationery`); 405 vendor không có tag style; 2 vendor rating 0<r<3,5. Hệ quả: các bước lọc cứng sức chứa/lịch/lead time của Python **không có dữ liệu để chạy trên pool** (Python cũng cho qua khi thiếu dữ liệu), và các boost (cultural, recent_reviews, crisis, rush, low_availability) **không tái hiện được** từ pool. ADR-077 chỉ yêu cầu chuyển hai phần (nới + MMR); boost không chuyển (xem Diff hành vi).
- Router của chat chỉ nhận ý định ghép cho 6 hạng mục: photography, attire, makeup, decor, transport, venue (`lib/router.js` + `lib/intentDetector.js`; đã chạy thử: "thiệp cưới" → domain `guest`, "nhẫn cưới" → không domain, nên stationery/jewelry không bao giờ vào đường ghép). Ngoài phạm vi, giữ nguyên.
- **Đo chuẩn trước khi viết** (bản cài mẫu em dựng ở thư mục tạm để hiệu chuẩn ngưỡng, không đưa vào repo; chạy `matcher/matcher.py` thật trên **cùng pool đông cứng** 867 vendor, 82 hồ sơ mẫu = 6 hạng mục × 3 ngân sách × 4 bộ gu + 10 hồ sơ ngân sách sát mép): số kết quả giống Python 82/82 hồ sơ; `relaxations_applied` giống Python 82/82 (10 hồ sơ Python phải nới); độ đa dạng gu top-5 trung bình 0,844 (Python 0,844; **không MMR 0,683**); trùng top-5 so Python (recall@5) **0,583** (**không MMR 0,471**); cùng đúng tập 5 vendor chỉ 19/82 hồ sơ. Nghĩa là: công thức chấm điểm JS (T-080) khác Python và ADR-077 không đổi nó, nên "không kém" **không** có nghĩa trùng top-5; nó có nghĩa là các mặt mà hai phần chuyển sang làm được thì phải ngang Python (số lượng, nới, đa dạng) và độ trùng top-5 không rơi xuống mức khi thiếu MMR.
- Bể: `eval/invariants/planner/inv-005` (worker khởi động trong workerd: không thêm import `node:*`/Buffer), `planner/vendor/matching/inv-001..003` (đọc `matcher/*.py` và `computeMatches`; xem "Không làm": giữ thư mục `matcher/`), `planner/vendor/images/inv-033` (file matcher == pool) và `inv-034` (match ngoài pool không vào prompt, **vế dương dùng matcher giả qua `fetch`**).

## Giả thuyết
Nếu chat lấy ứng viên từ bộ ghép JS trong Worker (lọc cứng → nới một bước → chấm điểm JS → MMR) thì chat có lại ứng viên mà không phụ thuộc mạng/Cloud Run, với số lượng, hành vi nới và đa dạng gu ngang matcher Python, và vendor vượt ngân sách không còn lọt vào top 5. Chỉ số bảo vệ: tab Vendor không đổi một byte đầu ra; chat vẫn trả lời được khi không có ứng viên; mọi ứng viên là vendor trong pool hiện hành, tên/giá đúng pool + overlay.

## Hành vi (người dùng thấy gì)

### 1. Ứng viên chat lấy từ pool + overlay, không mạng
Khi cặp đôi nhờ tìm vendor (ý định như hiện nay), `buildChatContext` dựng ứng viên bằng bộ ghép chạy ngay trong Worker từ `VENDOR_POOL` đã áp overlay admin (vendor admin ẩn bị bỏ; giá admin ghi đè giá pool, `price_source` như cũ). **Không gọi `fetch`** ở bước này, kể cả khi `MATCHER_URL`/`MATCHER_API_KEY` vẫn còn trong môi trường. `matchMetadata` giữ đúng hình dạng cũ để `formatMatchBlock` và debug không phải đổi: `{matches:[{vendor_id, name, final_score, boost_detail, style_tags, price_range}], total_pool, passed_filters, warnings, relaxations_applied}`:
- `vendor_id`, `name`: id và tên của vendor trong pool (tên không bao giờ lấy từ nguồn nào khác).
- `final_score`: điểm `totalScore` do công thức chấm điểm của `computeMatches` (không đổi công thức).
- `price_range`: `{min_vnd, max_vnd}` tính từ `priceMin/priceMax` (triệu → VND) **sau overlay**; `null` nếu cả hai không > 0 (prompt in "Liên hệ để hỏi báo giá").
- Không có `phone`, `contact` hay ảnh (FR-036, như cũ). `boost_detail` là chuỗi rỗng (xem mục 6).
Danh sách ứng viên nằm trong cùng tập vendor mà tab Vendor có thể trả cho hồ sơ đó (cùng pool, cùng overlay, cùng điều kiện đủ tư cách: `isVerified`, rating không trong (0; 3,5), không bị admin ẩn); không có vendor nào chỉ chat thấy mà tab không thấy.

### 2. Bộ lọc cứng của chat (chỉ chat; tab giữ nguyên)
Một vendor chỉ là ứng viên khi qua **tất cả**: (a) đủ tư cách như trên; (b) `category` đúng hạng mục ý định; (c) thành phố trùng thành phố của cặp đôi (so bằng chuẩn hoá thành phố của `computeMatches`; **không có** nhánh "bỏ lọc thành phố khi pool không có": cặp đôi ở thành phố pool không có thì không có ứng viên); (d) ngân sách: `priceMin × 1.000.000 <= ngân sách hạng mục` (giá **sau overlay**, tức đúng giá chat hiển thị; vendor có `priceMin` không > 0 thì qua, như Python khi không có `price_range`); (e) dealbreaker: không có tag style nào (so sánh sau cắt khoảng trắng + chữ thường) nằm trong `dealbreakers` của hồ sơ. Sức chứa, lịch ngày, lead time: không có dữ liệu trong pool nên **không có bước lọc** (Python cũng cho qua khi thiếu dữ liệu). Không ai qua: chat dùng khối "Không có vendor phù hợp" như cũ, không ném lỗi.

### 3. Nới điều kiện (chỉ chat), đúng các bước Python
Nếu số vendor qua bộ lọc cứng `< 5`: thử **một** bước nới duy nhất, ngân sách `Math.trunc(ngân sách × 1,2)` (đúng `int(budget*1.2)` của Python), lọc lại; chỉ **nhận** bước nới khi số vendor qua lọc **tăng**. Nhận thì `relaxations_applied = ["budget +20%"]`, `warnings` có "Đã mở rộng ngân sách +20% để tìm thêm lựa chọn", và prompt có dòng sẵn có "kết quả đã nới lỏng một số tiêu chí…" (formatter không đổi). Không nhận (hoặc đã đủ 5) thì `relaxations_applied = []`, prompt không có dòng đó. Nới rồi vẫn `< 5`: trả đúng số có, không lỗi. Không có bước nới thứ hai (bước "bỏ lead_time" của Python chưa từng được cài, và pool không có dữ liệu lead time: thừa). Các điều kiện còn lại (thành phố, dealbreaker, đủ tư cách) **không** được nới.

### 4. Chấm điểm và MMR đa dạng (chỉ chat)
Các vendor qua lọc (sau nới nếu có) được chấm bằng công thức `computeMatches` hiện có (không đổi, kể cả hợp đồng style T-072/T-080); lấy top 20 theo thứ tự của `computeMatches` (điểm giảm dần, bằng điểm thì vendor khớp gu đứng trên). Nếu có `> 5` vendor thì chọn 5 bằng MMR đúng như `apply_mmr_diversity` của Python: vendor đứng đầu được chọn trước; mỗi lượt chọn vendor có `(1−λ)·điểm/100 − λ·(độ giống lớn nhất với vendor đã chọn)` cao nhất, λ = 0,3; độ giống = Jaccard của tập style tag (chữ thường), cả hai rỗng = 1, một bên rỗng = 0; **R8 (T-072) giữ nguyên**: một ứng viên bị loại khỏi lượt chọn nếu còn vendor khác nhóm (khớp gu / không khớp gu) chưa chọn có điểm cao hơn, hoặc bằng điểm mà ứng viên không khớp gu. Có `<= 5` vendor thì giữ nguyên thứ tự (không MMR). `final_score` là điểm `totalScore` của vendor.

### 5. Tab Vendor không đổi
`computeMatches` và `GET /api/vendors/match|categories|:id|status` trả đúng như trước (kể cả `whyThoseVendors`, phân trang `offset`, nới lọc thành phố, không lọc cứng ngân sách, không nới, không MMR). Chọn có chủ ý (xem "Cách hiểu thứ hai"): nới + MMR chỉ ở chat.

### 6. Hành vi T-136/T-138 còn hay thừa
- **A9 (câu Vendor trong khối "Quy tắc dữ liệu") còn nguyên văn**; chat vẫn chỉ được đề xuất vendor trong khối ứng viên.
- **Thứ tự**: pool → bỏ vendor admin ẩn → áp giá overlay → lọc cứng → (nới) → chấm điểm → MMR → khối prompt. Pool và overlay nằm **trước** mọi bước nên hai bước sau của T-136 là thừa trên đường chat: `filterMatchesByPool` (id luôn lấy từ pool; tên/giá luôn theo pool + overlay theo cấu trúc) và `applyOverlayToMatches` (overlay đã áp trong bộ ghép). Engineering được bỏ lời gọi hai hàm này ở `contextBuilder`; `lib/poolFilter.js` + `test/test_pool_filter.js` thành mã chết (xoá ở bước 2 hoặc để, không bắt buộc, không có eval).
- **Khối "Dữ liệu vendor đang cập nhật" (T-136 A4)**: không còn tới được (`dropped` luôn 0) nên thừa; mã trong `matchFormatter.js` giữ hay xoá tuỳ Engineering. `matchMetadata.pool_filter` và `console.warn("bỏ N match ngoài pool")` (T-136 A6): không còn bắt buộc.
- **Lỗi bộ ghép**: nếu bộ ghép ném lỗi bất ngờ, `buildChatContext` vẫn trả prompt hợp lệ không có khối ứng viên (không ném).
- **Boost Python không chuyển**: pool JS không có dữ liệu (đánh giá gần đây, cultural, crisis, lead time, lịch). Hệ quả người dùng thấy: lý do "có nhiều review tích cực gần đây" / "chuyên xử lý đám cưới hai họ khác vùng" không còn ở dòng "Phù hợp vì"; lý do theo gu và câu mặc định giữ nguyên. Thứ hạng khác Python ở phần chấm điểm (đã đo, trên).

## Cách hiểu thứ hai cần chốt (Spec critic hỏi: nới + MMR áp cho cả tab hay chỉ chat?)
**Mặc định: chỉ chat.** Lý do: (1) ADR-077 nói rõ mục tiêu là chat ngang chất lượng A; (2) tab là danh sách dài có `offset/limit/minScore` và `total`: MMR xếp lại theo đa dạng sẽ phá phân trang ổn định (trang 2 trùng/thiếu) và đổi điều cặp đôi đang quen; (3) tab không có lọc cứng ngân sách (ngân sách chỉ là điểm mềm, vendor trên 120% ngân sách điểm 0) nên "thiếu thì nới" không có nghĩa ở đó; (4) giữ tab nguyên là chỉ số bảo vệ đo được (eval 7), cho phép Capu đòi tab sau bằng việc riêng. Cách hiểu khác (áp cả tab) sẽ đổi đầu ra của `/api/vendors/match` cho mọi người dùng và sẽ phải tách phân trang; không làm ở đây.

## Bước 2 — bỏ Cloud Run (việc/PR riêng, tạo SAU khi bước 1 chạy ổn; không thuộc eval 1–7 của T-140)
Điều kiện bắt đầu: bước 1 đã merge và chạy ở production, Capu xác nhận chat có ứng viên. Hai PR, **thứ tự bắt buộc** (ranh giới T-135/T-139):
1. **PR `tohong` trước**: `tools/regen-pool-styles.sh` chỉ gọi `build_matcher_vendors.py` khi thư mục `<back>/matcher-data` tồn tại (hoặc bỏ lời gọi hẳn). Lý do: `sync-vendor-pool.yml` (T-139, `tohong-back`) chạy script này rồi **từ chối (đỏ) mọi file sinh ra ngoài `tools/pool-paths.txt`**; nếu `tohong-back` xoá `matcher-data/` và dòng `matcher-data/vendors.json` trong `pool-paths.txt` trước khi script ngừng ghi, mọi lần đồng bộ pool sau đó đỏ. Script ngừng ghi trước, file cũ còn nằm lại vô hại tới khi PR 2 xoá (dòng trong `pool-paths.txt` bị bỏ qua nếu file không tồn tại).
2. **PR `tohong-back`**: xoá `lib/matcherAdapter.js` (kèm `callMatcher`, test `callMatcher` trong `test/test_vendor_matching.js`), `.github/workflows/sync-matcher-vendors.yml`, `.github/workflows/deploy-matcher.yml`, thư mục `matcher-data/`, thư mục `matcher-service/` (nguồn Cloud Run; không có file nào trong đề bài nhưng nó chỉ để deploy Cloud Run; Capu duyệt), dòng `matcher-data/vendors.json` trong `tools/pool-paths.txt`, `MATCHER_URL`/`MATCHER_API_KEY` khỏi `.github/workflows/deploy.yml` (mục `secrets:` và `env:`) và mọi chỗ còn lại; `package.json` scripts.test không trỏ file đã xoá. **Giữ nguyên thư mục `matcher/` (Python)**: chuẩn so sánh của eval 4–6 và bất biến `planner/vendor/matching/inv-001..003` đọc nó.
Eval bước 2: `python3 -I eval/T-140/buoc2-go-cloud-run/check_go_cloud_run.py` (đỏ cho tới khi xong; **chưa đăng ký vào board**, Chief of Staff đăng ký khi tạo việc bước 2).
**Bất biến lỗi thời → Chief of Staff ghi `decisions/`** (spec không tự sửa): `planner/vendor/images/inv-033` (file matcher == pool) hết đối tượng khi `matcher-data/` bị xoá (nó tự PASS "chưa áp dụng"; đề xuất đưa vào thư mục lưu trữ). Xem thêm "Bất biến lỗi thời ngay ở bước 1" cho `inv-034`.
**Lệnh cho Capu tự chạy sau khi PR bước 2 đã merge và deploy xong** (không đảo ngược; spec và agent **không chạy**; thay `<PROJECT>` bằng `GCP_PROJECT_ID`):
```
# (tuỳ chọn, trước khi xoá) sao lưu dữ liệu bucket về máy
gcloud storage cp -r gs://wedding-planner-vendors ./wedding-planner-vendors-backup
gcloud run services delete matcher-service --region asia-southeast1 --project <PROJECT>
gcloud artifacts repositories delete matcher --location asia-southeast1 --project <PROJECT>
gcloud storage rm -r gs://wedding-planner-vendors
# secret trên GitHub (chỉ hai workflow đã xoá dùng GCP_SA_KEY, GCP_PROJECT_ID; kiểm lại trước khi xoá)
gh secret delete MATCHER_URL --repo phungrk/tohong-back
gh secret delete MATCHER_API_KEY --repo phungrk/tohong-back
gh secret delete GCP_SA_KEY --repo phungrk/tohong-back
gh secret delete GCP_PROJECT_ID --repo phungrk/tohong-back
# secret trên Cloudflare Worker (chạy trong thư mục tohong-back SAU khi deploy.yml không còn đặt chúng, nếu không lần deploy sau tạo lại)
npx wrangler secret delete MATCHER_URL
npx wrangler secret delete MATCHER_API_KEY
```
Giữa bước 1 và bước 2, `sync-matcher-vendors.yml` còn chạy ở mỗi PR pool (đổi `matcher-data/vendors.json`) và sẽ đỏ (Cloud Run đã tắt): phiền nhưng không hại; đừng để bước 2 trễ lâu. Chief of Staff có thể tạm tắt trigger `push` của workflow đó, ngoài phạm vi T-140.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-140-chat-computematches` · Vùng (`area`): `planner/vendor/images` (kèm đọc `planner/vendor/matching`).
- Chạy gate **từ gốc tohong-hq, KHÔNG kèm `--cwd`**: `python3 scripts/gate.py T-140` (`TOHONG_BACK_REPO` trỏ worktree PR).
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/` (inv-005: bộ ghép mới không được thêm import `node:*`/`Buffer`; inv-006), `planner/vendor/matching/inv-001..004` (inv-001/002/003 chạy `matcher/*.py` + `computeMatches`: không đổi), `planner/vendor/images/` (inv-021/022 pool; inv-033; **inv-034 sẽ đỏ**, xem dưới). Spec không vi phạm bất biến nào ngoài inv-034 (lỗi thời có chủ ý).
- Kiến trúc: bộ ghép nằm trong `lib/` (tên hàm/file do Engineering chọn; eval chỉ gọi `buildChatContext`, `computeMatches`, `buildMatchProfile` đã có). Tái dùng công thức chấm điểm của `computeMatches` và `lib/styleContract.js`; **không** nhân đôi công thức; **không** đổi chữ ký hay mặc định của `computeMatches` (mọi tuỳ chọn mới, nếu có, mặc định tắt và không bật ở `api/vendors.js`).
- Không chạm: thanh toán, auth, schema DB, dữ liệu người dùng; thuật toán `matcher/*.py`; công thức chấm điểm JS; `lib/prompts.js`; không gọi Google; không gọi GCP/gcloud/gsutil; không xoá gì ở bước 1.
- Bậc B vì: logic nghiệp vụ/engine ghép, eval tự động phủ gần hết, không chạm ranh giới cứng. Bước 2 có lệnh không đảo ngược nhưng do Capu tự chạy; Chief of Staff quyết bậc của bước 2.

## Diff hành vi (Capu đọc; bậc B)
- Trước: chat gọi matcher Cloud Run (đang tắt) nên **không có ứng viên**; nếu bật lại thì ứng viên Python lọc ngân sách theo giá nguồn scraper (chỉ 221/867 vendor có giá), nới +20%, MMR.
- Sau: chat có ứng viên từ cùng pool + overlay với tab Vendor, không gọi mạng; ngân sách lọc theo **giá chat hiển thị** (mọi vendor có giá, kể cả giá "ước tính" mặc định theo hạng mục): cặp đôi ngân sách thấp có thể nhận **ít hơn 5** ứng viên (đo: 8/82 hồ sơ mẫu, đúng bằng Python chạy trên cùng dữ liệu) thay vì 5 vendor đắt hơn ngân sách; thiếu thì nới +20% một lần (có dòng báo "nới lỏng"); top 5 đa dạng gu bằng MMR; cặp đôi ở thành phố ngoài pool (hiện chỉ HCMC) **không có ứng viên** (tab vẫn hiện vendor HCMC) và nhận khối "Không có vendor phù hợp" như hiện có.
- Mất so với Python: lý do theo boost (review gần đây, vùng miền, sự cố) không còn ở "Phù hợp vì"; thứ hạng top-5 không trùng Python (đã đo 0,58, ngưỡng 0,54).
- Không đổi: tab Vendor (đầu ra y nguyên, có eval), A9, vendor admin ẩn không lọt, giá admin thắng, `matcher/*.py`, các hạng mục chat không nhận ý định (stationery, jewelry, ceremony, honeymoon).

## Tiêu chí chấp nhận và eval
Chạy từ gốc tohong-hq; `TOHONG_BACK_REPO` trỏ worktree PR (mặc định `../tohong-back`). Eval 4–7 dùng pool đông cứng `eval/T-140/fixtures/pool-frozen.json` (chụp 2026-11-13) nên không trôi khi pool đổi; eval 4–6 chạy `matcher/matcher.py` thật của repo back làm chuẩn (cần `python3`, không cần fastapi).
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Không có `MATCHER_URL/KEY` hoặc có cũng vậy, **không gọi mạng**; 1–5 ứng viên từ pool thật, id/tên/thứ tự khớp pool và khớp khối prompt, không phone/contact; vendor admin ẩn không lọt, giá admin đè pool ("giá đã xác minh"); mọi ứng viên có trong danh sách tab Vendor; A9 còn nguyên | `node eval/T-140/check_1_chat_tu_pool_khong_mang.mjs` |
| 2 | Lọc cứng: thành phố ngoài pool / hạng mục không vendor / ẩn hết → rỗng + khối "Không có vendor phù hợp", không ném; không vendor 0<rating<3,5; dealbreaker; ngân sách theo giá hiển thị (≤ ngân sách, hoặc ≤ ×1,2 khi đã nới); vendor không giá vẫn qua | `node eval/T-140/check_2_loc_cung.mjs` |
| 3 | Nới điều kiện (pool điều khiển bằng overlay): chỉ nới khi <5; một bước ×1,2 cắt phần thập phân, mép inclusive; chỉ nhận khi thêm vendor; `relaxations_applied` + dòng "nới lỏng" đúng; không nới khi đủ 5 | `node eval/T-140/check_3_noi_dieu_kien.mjs` |
| 4 | So Python trên 82 hồ sơ mẫu: cùng số ứng viên, cùng `relaxations_applied` (≥8 hồ sơ Python phải nới) | `node eval/T-140/check_4_nhu_python_noi_dieu_kien.mjs` |
| 5 | MMR: độ đa dạng gu top-5 ≥ Python − 0,04; R8 không đảo thứ tự theo điểm giữa hai nhóm gu | `node eval/T-140/check_5_mmr_da_dang.mjs` |
| 6 | Chất lượng tổng: recall@5 so Python ≥ 0,54 | `node eval/T-140/check_6_chat_luong_khong_kem.mjs` |
| 7 | Tab Vendor không đổi: `computeMatches` 23 ca (hạng mục × gu, phân trang, minScore, ngân sách thấp, Hà Nội, hồ sơ rỗng) cho đúng hash như trước | `node eval/T-140/check_7_tab_vendor_khong_doi.mjs` |
Trạng thái lúc viết spec (main, chưa có code): 1–6 đỏ (chat không có ứng viên vì không có matcher; có `MATCHER_URL` thì gọi mạng); 7 xanh (hồi quy, phải giữ xanh). Đã chạy cả 7 eval trên bản cài mẫu theo đúng spec này ở thư mục tạm: **cả 7 PASS** (recall 0,583 / ngưỡng 0,54; đa dạng 0,844); bản mẫu cố ý bỏ MMR thì eval 5, 6 đỏ (0,683 / 0,471); bỏ nới thì eval 3, 4 đỏ; chạy trên main thì đỏ như trên. Bước 2: `check_go_cloud_run.py` đỏ (còn `lib/matcherAdapter.js`); **chưa chạy được ở trạng thái xanh** vì chưa có code bước 2.

## Bất biến đề xuất (tầng 2)
- **INV-A** (`planner/vendor/matching`): đường chat dựng ứng viên không gọi mạng và có ứng viên: `buildChatContext` với mọi `fetch` bị cấm, hồ sơ photography 30tr, **không** `MATCHER_URL/KEY` → khối `[VENDOR CANDIDATES]` có 1–5 vendor và không ném (rút gọn eval 1 vế (a)).
- **INV-B** (`planner/vendor/matching`): mọi ứng viên chat có `vendor_id` ∈ `VENDOR_POOL`, không bị admin ẩn, tên đúng pool, `price_range` đúng giá pool + overlay, không vendor 0<rating<3,5, và `priceMin × 1e6 ≤ ngân sách` (hoặc `≤ trunc(ngân sách × 1,2)` khi `relaxations_applied` không rỗng). Thay vế dương và vế "id ngoài pool" của inv-034 cho đường JS (rút gọn eval 1+2).
- **INV-C** (`planner/vendor/matching`): R8 sau MMR trên đường chat JS: không cặp ứng viên (khớp gu, không khớp gu) nào bị đảo thứ tự theo `final_score`; bằng điểm thì vendor khớp đứng trên. (inv-003 mục (ii) chỉ phủ đường chat Python.)
- **INV-D** (`planner/vendor/matching`): bất kỳ đầu vào nào của `buildChatContext` cho đường ghép (ngân sách rác, hồ sơ rỗng, pool toàn ẩn) không ném lỗi.

## Bất biến lỗi thời ngay ở bước 1 (Chief of Staff phải xử lý TRƯỚC Code Gate bước 1, không phải đợi bước 2)
`planner/vendor/images/inv-034` có vế dương: matcher giả (qua `fetch`) trả match `ok.id` → tên phải vào prompt. Chat không còn gọi matcher nên vế đó **đỏ trên chính PR bước 1** (đã chạy trên bản cài mẫu: `FAIL vendor trong pool (...) không vào prompt`; vế "id ngoài pool không lọt" thì tự đúng). Tầng 2 đỏ sẽ đẩy việc vào spec rework vô lý. Đề xuất: Chief of Staff ghi `decisions/` (ADR-077 là căn cứ) thay inv-034 bằng INV-B (lưu bản cũ ở nơi không chạy), **trước khi** giao Code Gate bước 1; spec không tự sửa bất biến. `inv-033` chỉ lỗi thời ở bước 2.

## Không làm
Đổi công thức chấm điểm `computeMatches` hay hợp đồng style; chuyển boost của Python (pool không có dữ liệu); áp nới/MMR cho tab Vendor; thêm bước nới thứ hai hay nới điều kiện khác ngoài ngân sách; lọc sức chứa/lịch/lead time (không có dữ liệu); thêm hạng mục chat chưa nhận ý định (stationery, jewelry, ceremony, honeymoon: router, nợ có sẵn); sửa khối "Không có vendor phù hợp" khi cặp đôi ở thành phố ngoài pool (lời khuyên "mở rộng ngân sách" trong khối đó không đúng cho ca này; nợ có sẵn, ghi nhận); xoá bất cứ thứ gì thuộc Cloud Run ở bước 1; chạy `gcloud/gsutil`; xoá `matcher/` Python; đổi `lib/prompts.js`; gọi Google.

## Câu hỏi mở
Cho tab Vendor cũng đa dạng hoá (MMR) như chat không? **Mặc định: không** (lý do ở "Cách hiểu thứ hai"; đổi sau bằng việc riêng nếu Capu muốn). Không chặn việc này.
