# Spec T-073: Bỏ 'tinh tế' khỏi minimalist, enrichment tính lại tag từ đầu, tạo lại styles của vendor pool

Phiên bản 2 (spec rework theo `handoffs/T-073-D1.md` và `decisions/2026-11-06-adr-025-t073-pool-chi-doi-styles.md`). Đã sửa: (1) Hành vi 2 và mục Bằng chứng: "tạo lại pool" nghĩa là chỉ tạo lại `styles`/`tags`, giá giữ như @6a9a9c7; thêm đường tạo lại bằng một lệnh và tiêu chí 4 + eval; (2) Định nghĩa dùng chung và Hành vi 1: chọn rõ cách xử lý `style_tags` hiện có, khoá bằng check_1; (3) check_3 đo qua `EnrichmentPipeline.run()`, không gọi hàm nội bộ.

## Ý định
Capu (issue #17): tag `minimalist` trong pool đang gắn cho vendor chỉ vì chữ "tinh tế" (sáo ngữ marketing); cặp đôi chọn phong cách "tối giản" sẽ được gợi ý vendor không tối giản. Sửa tận gốc ở extractor, ở pipeline (chỉ cộng tag, không bao giờ bỏ) và tạo lại tag trong pool.

## Bằng chứng
- Pool thật `tohong-back/lib/vendorPool.generated.js` @6a9a9c7: 968 vendor, **124** có `minimalist`. Văn bản nguồn của chỉ **6/124** có "tối giản/minimalist/minimal" (đếm bằng regex ở mục Hành vi trên `tohong/tools/scraper/output/HCMC/*/vendors.json`; id: marry_0e752724a7e2, _23302408ceb4, _c56947feceb7, _7995ddfb23d1, _3e5638955c77, _62587be7151d). 118 vendor còn lại chỉ nhờ "tinh tế". Số 6/130 trong brief lệch nhẹ với số đếm trên pool này (6/124); lấy số đếm lại làm chuẩn.
- Mọi `styles` hiện tại của pool khớp đúng kết quả extractor chạy trên văn bản nguồn (0/968 lệch; đã tự kiểm). Hệ quả: dữ liệu hiện không có tag "mồ côi" **về styles**.
- **Chỉ đúng với styles.** Dữ liệu scrape hiện tại KHÔNG khớp giá trong pool @6a9a9c7: chạy generator đầy đủ làm 36 vendor đổi giá (vd marry_9d6993dd9e74: 5–15 → 2–933,4 triệu); Product đã tự chạy lại và xác nhận số đếm của Spec critic (chi tiết `insights/2026-11-06-lech-gia-scrape-vs-pool.md`). Vì vậy theo ADR-025 pool KHÔNG được tạo lại toàn phần trong T-073; chỉ `styles`/`tags` đổi, qua đường ở mục "Đường tạo lại pool".
- `StyleTagExtractor._build_corpus` đọc cả `vendor["style_tags"]` hiện có; `enrichment/pipeline.py` (khối "Style tags") gọi `extract(vendor)` rồi chỉ cộng tag mới vào tập cũ. Hai điều này khiến tag cũ tự củng cố: `minimalist` đã gắn thì chữ "minimalist" trong chính style_tags khớp lại pattern `minimali[sz]t`. Cùng kiểu cộng-thêm còn ở `backfill.py`, `merge.py::_merge_style_tags`, `build_pool.py::collapse_by_id` (xem Không làm / Câu hỏi mở).
- `sources/marry.py` (khối "Suy style_tags", khoảng dòng 350) truyền tag thô của marry (tên gói, vd "Gói dịch vụ chủ đề LUXURY PARTY") vào extractor qua khoá `style_tags` để cứu tín hiệu `luxury` ở lúc scrape. Tín hiệu này đáng giữ; xem Định nghĩa dùng chung.
- `clean_style_tags.py` đã có cách tính lại từ đầu đúng (không seed từ style_tags cũ), dùng lại được cho dữ liệu scrape.

## Giả thuyết
Nếu bỏ "tinh tế" khỏi luật minimalist và cập nhật styles của pool thì vendor gợi ý cho cặp đôi chọn "tối giản" phản ánh đúng văn bản vendor (minimalist 124 → 6). Chỉ số bảo vệ: số vendor mỗi tag khác và mọi trường khác của pool (giá, ảnh, rating, thứ tự) không đổi. (Chưa có số liệu hành vi người dùng; tác động lên tỷ lệ chọn vendor là GIẢ ĐỊNH, tự tin ~50%, không thuộc phạm vi đo của việc này.)

## Hành vi (người dùng thấy gì)
Định nghĩa dùng chung:
- **Văn bản nguồn** của một vendor = name + description + merchant_description + từng `top_reviews[].text` + **chuỗi thô** trong `style_tags`.
- **Chuỗi thô** = phần tử của `style_tags` KHÔNG trùng nguyên văn (so sánh chính xác, chữ thường) một trong 10 tag chuẩn (korean, luxury, rustic, natural, editorial, soft, traditional, modern, minimalist, simple). Phần tử trùng nguyên văn một tag chuẩn là **kết quả của lần extract trước**, KHÔNG phải văn bản nguồn: extractor bỏ qua nó. Cách chọn này (ADR-025 mục 3): giữ tín hiệu tên gói từ `sources/marry.py` ("Gói dịch vụ chủ đề LUXURY PARTY" vẫn ra `luxury`), đồng thời tag chuẩn không tự củng cố. Chọn vì không mất tín hiệu hiện có và không phải sửa `sources/marry.py`; cái giá: sau scrape, tag thô đã bị đổi thành tag chuẩn nên bước enrichment (tính lại từ văn bản) không còn thấy tên gói; vendor chỉ có tín hiệu từ tên gói sẽ mất tag đó khi enrich. Pool hiện tại không có vendor như vậy (0/968 lệch so với extractor chạy không có style_tags).
- **Dấu hiệu minimalist** = văn bản khớp không phân biệt hoa thường một trong `t[ốo]i\s*gi[ảa]n`, `minimali[sz]t`, `\bminimal\b`.

1. Extractor: văn bản nguồn chứa "tinh tế" (mọi kiểu hoa/thường, nhiều dấu cách, ở name/description/merchant_description/review/chuỗi thô) mà không có dấu hiệu minimalist thì KHÔNG ra `minimalist`; văn bản có "phong cách tối giản" (hoặc dấu hiệu khác) ra `minimalist`, kể cả khi đi kèm "tinh tế". "Tinh tế" đứng một mình ra danh sách rỗng, không ra tag nào khác thay thế. Chín tag còn lại giữ nguyên luật; "cao cấp" vẫn không ra tag nào. Tag chuẩn trong `style_tags` không bao giờ góp phần ra tag (vd `style_tags=["minimalist"]` và không có văn bản khác ra rỗng).
2. Pool: sau khi cập nhật, so với pool @6a9a9c7: cùng tập id, cùng thứ tự; **mọi trường ngoài `styles`/`tags` của mọi entry y hệt, kể cả `priceMin`/`priceMax`** (ADR-025); `styles` == `tags`; `styles` mới == `styles` cũ bỏ `minimalist` (giữ thứ tự các tag còn lại), TRỪ vendor có dấu hiệu minimalist trong văn bản nguồn của BẤT KỲ bản ghi nào cùng id thì `styles` giữ nguyên. Tức chỉ `minimalist` giảm (124 → 6 trên dữ liệu hiện tại); không tag nào được thêm, không tag nào khác mất; giá không đổi dù dữ liệu scrape lệch.
3. Enrichment (`EnrichmentPipeline.run()`): với vendor được enrich thành công, style_tags sau run = kết quả extractor trên văn bản nguồn SAU khi cập nhật merchant_description/top_reviews, **thay thế hoàn toàn** danh sách cũ (không cộng vào, không đọc tag chuẩn cũ làm bằng chứng), theo thứ tự extractor trả. Tag cũ không còn bằng chứng bị bỏ, kể cả khi lần enrich đó không có text mới (danh sách có thể thành rỗng). `enrichment_log[-1].changes` ghi `style_tags_added` (tag mới so với trước) và `style_tags_removed` (tag bị bỏ), mỗi khoá chỉ có khi danh sách khác rỗng. Chạy lại lần hai trên cùng dữ liệu cho cùng kết quả.
4. Đường tạo lại pool = **một lệnh** chạy từ gốc repo `tohong`: `bash tools/regen-pool-styles.sh --back <thư mục tohong-back>` (mặc định `--back` là `edge`). Lệnh ghi lại `<back>/lib/vendorPool.generated.js` từ chính file đó, chỉ thay `styles`/`tags`; từ pool @6a9a9c7 ra đúng pool đã commit trong tohong-back, từng byte; chạy lần hai không đổi gì. Nếu pool có vendor không còn trong dữ liệu scrape: lệnh thoát khác 0, nêu id, không ghi đè pool. Không sửa tay file pool.

Thứ tự bên trong lệnh (bắt buộc): sửa extractor xong → tính lại `style_tags` của `tools/scraper/output/HCMC/*/vendors.json` từ văn bản nguồn (`clean_style_tags.py` đã làm đúng việc này; thay đổi duy nhất trong các file đó là dòng style_tags) → `build_pool.py --out output/pool-vendors.json` (trung gian, không commit) → `generate-vendor-pool.js` ở chế độ chỉ cập nhật styles/tags trên pool nền. Đảo thứ tự hoặc bỏ bước tính lại thì `build_pool` gộp lại tag cũ và pool vẫn còn 124. Tên cờ của generator là chi tiết cài đặt; bản tham khảo (không bắt buộc) ở `handoffs/T-073-v2-reference.diff`.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (extractor, pipeline, scraper output, lệnh tạo lại, generator), `phungrk/tohong-back` (pool); nhánh `t-073-...` mỗi repo · Vùng: `planner/vendor/pool`
- Biến môi trường eval: `TOHONG_REPO` (mặc định `../tohong` so với gốc tohong-hq), `TOHONG_BACK_REPO` (mặc định `../tohong-back`). Không thấy repo thì eval FAIL có lý do, không PASS giả. check_4 cần git của tohong-back để đọc pool @6a9a9c7.
- Bất biến đã đọc: `_shared/` (INV-001 không secret, INV-002 số cái đọc được); `planner/`, `planner/vendor/`, `planner/vendor/pool/` chưa có bất biến nào. Anh em `planner/vendor/images` không chạy cho vùng này; ảnh không bị đụng vì mọi trường ngoài styles/tags được khoá. Không vi phạm bất biến nào.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, **giá vendor** (lệch giá là việc bậc C riêng, xem Không làm). Chỉ dữ liệu vendor công khai.
- Bậc đề xuất: A (đồng ý với Chief of Staff; ADR-025 giữ nguyên bậc A) — eval tự động phủ cả 4 tiêu chí; giá không đổi nên không chạm ranh giới cứng; rollback là revert PR. Việc chạm 2 repo: Engineering theo quy trình Spec Kit của repo gốc nếu cần.
- Eval `check_2.py` so với `baseline-pool.json` (tohong-back@6a9a9c7) nên chỉ có nghĩa tới khi PR pool merge; `check_4.py` đọc pool @6a9a9c7 từ git nên vẫn chạy được sau merge. Sau merge dùng bất biến đề xuất bên dưới.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | 'không gian tinh tế' qua extractor không ra minimalist; 'phong cách tối giản' ra minimalist; chín tag khác không đổi; tên gói thô vẫn cho tín hiệu, tag chuẩn cũ không tự củng cố | `python3 -I eval/T-073/check_1.py` |
| 2 | So pool trước và sau: chỉ minimalist giảm, các tag khác và mọi trường khác (kể cả giá) không đổi | `python3 -I eval/T-073/check_2.py` |
| 3 | Enrichment (qua `run()`) tính lại style_tags từ đầu, không cộng thêm, không tự củng cố tag cũ | `python3 -I eval/T-073/check_3.py` |
| 4 | Pool tạo lại bằng một lệnh từ pool @6a9a9c7 ra đúng pool đã commit, chạy lại không đổi, dừng khi vendor vắng nguồn | `python3 -I eval/T-073/check_4.py` |

Tiêu chí 3 và 4 là cụ thể hoá ý định của Capu (pipeline tính lại từ đầu; pool tạo lại) và ADR-025; board mới liệt kê 2 tiêu chí đầu.
Đã tự kiểm: bốn eval ĐỎ trên code hiện tại (check_1, 2, 3 đỏ với lỗi nội dung; check_4 đỏ vì chưa có lệnh) và XANH cả bốn, cộng bất biến đề xuất, trên bản sửa mẫu ở scratchpad chạy từ đầu đến cuối bằng đúng lệnh `regen-pool-styles.sh` (minimalist 118 mất, 6 giữ; 968 entry; giá không đổi). Bản sửa mẫu không nằm trong repo; diff tham khảo ở `handoffs/T-073-v2-reference.diff`. Cách cài khác bị bắt: extractor bỏ hẳn style_tags (mất tín hiệu tên gói) đỏ ở check_1; extractor vẫn đọc tag chuẩn đỏ ở check_1 và check_3; tạo lại toàn phần pool đỏ ở check_2 (36 vendor đổi giá); sửa tay pool đỏ ở check_4 nếu khác đầu ra của lệnh. `baseline-pool.json` sinh bằng `eval/T-073/make_baseline.py`, không chạy lại.

## Bất biến đề xuất (tầng 2), vùng `planner/vendor/pool`
- `eval/T-073/inv-proposed-pool-khop-nguon.py`: mọi `styles` của pool == hợp tag extractor hiện hành cho ra từ văn bản nguồn của các bản ghi cùng id (không đọc style_tags). Chạy được ngay (PASS trên pool trước T-073, PASS trên pool mẫu sau sửa). Chặn tái phát: đổi luật extractor mà quên chạy lệnh tạo lại, hay tag cũ nằm lại. Nếu sau này nguồn có vendor chỉ mang tín hiệu từ tên gói thô, bất biến cần cập nhật (hiện 0 vendor).
- Bất biến thứ hai (cho spec-critic cân nhắc, chưa viết file): "enrichment không bao giờ làm style_tags chứa tag mà extractor không ra từ văn bản nguồn" — check_3 đã phủ; chỉ rút nếu critic muốn phủ cả các đường backfill/merge.
- Gợi ý cho spec-critic (không tự thêm): "mọi trường ngoài styles/tags của pool chỉ đổi qua việc bậc C có diff giá" cần chạy được; hiện chưa có cách máy kiểm khi không có baseline, nên để ngỏ.

## Không làm
Sửa tag simple; thêm tag boho (đã nằm trong pattern rustic, giữ nguyên); gắn tag bằng người hoặc bằng ảnh; đổi 9 tag khác; đổi `ALLOWED_TAGS`; **đổi giá, ảnh, rating, thứ tự của pool, kể cả khi dữ liệu scrape khác** (lệch giá 36 vendor thuộc việc bậc C riêng, `insights/2026-11-06-lech-gia-scrape-vs-pool.md`); sửa `sources/marry.py`; sửa `backfill.py`, `merge.py`, `build_pool.py` (cùng kiểu cộng-thêm nhưng ngoài ý định; nếu chạy lại chúng trên dữ liệu cũ thì tag cũ có thể quay lại, bất biến đề xuất sẽ bắt).

## Câu hỏi mở
1. Lệch giá 36 vendor: mở ý định riêng bậc C theo ADR-025 (insight đã ghi, chưa mở issue; chờ Chief of Staff). Không chặn T-073.
2. `backfill.py`, `merge.py`, `build_pool.py` cũng chỉ cộng tag: có mở việc riêng bậc A để chúng tính lại từ đầu không (đề xuất: có, sau T-073)?
