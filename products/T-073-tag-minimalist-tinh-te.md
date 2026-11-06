# Spec T-073: Bỏ 'tinh tế' khỏi minimalist, enrichment tính lại tag từ đầu, tạo lại vendor pool

## Ý định
Capu (issue #17): tag `minimalist` trong pool đang gắn cho vendor chỉ vì chữ "tinh tế" (sáo ngữ marketing); cặp đôi chọn phong cách "tối giản" sẽ được gợi ý vendor không tối giản. Sửa tận gốc ở extractor, ở pipeline (chỉ cộng tag, không bao giờ bỏ) và tạo lại pool.

## Bằng chứng
- Pool thật `tohong-back/lib/vendorPool.generated.js` @6a9a9c7: 968 vendor, **124** có `minimalist`. Văn bản nguồn của chỉ **6/124** có "tối giản/minimalist/minimal" (đếm bằng regex ở mục Hành vi trên `tohong/tools/scraper/output/HCMC/*/vendors.json`; id: marry_0e752724a7e2, _23302408ceb4, _c56947feceb7, _7995ddfb23d1, _3e5638955c77, _62587be7151d). 118 vendor còn lại chỉ nhờ "tinh tế". Số 6/130 trong brief lệch nhẹ với số đếm trên pool này (6/124); lấy số đếm lại làm chuẩn.
- Mọi `styles` hiện tại của pool khớp đúng kết quả extractor chạy trên văn bản nguồn (0/968 lệch; đã tự kiểm). Hệ quả: dữ liệu hiện không có tag "mồ côi", nên sửa extractor + tạo lại pool là đủ để chỉ `minimalist` giảm.
- `StyleTagExtractor._build_corpus` đọc cả `vendor["style_tags"]` hiện có; `enrichment/pipeline.py` (khối "Style tags") gọi `extract(vendor)` rồi chỉ cộng tag mới vào tập cũ. Hai điều này khiến tag cũ tự củng cố: `minimalist` đã gắn thì chữ "minimalist" trong chính style_tags khớp lại pattern `minimali[sz]t`. Cùng kiểu cộng-thêm còn ở `backfill.py`, `merge.py::_merge_style_tags`, `build_pool.py::collapse_by_id` (xem Không làm / Câu hỏi mở).
- `clean_style_tags.py` đã có cách tính lại từ đầu đúng (không seed từ style_tags cũ), dùng lại được cho dữ liệu scrape.

## Giả thuyết
Nếu bỏ "tinh tế" khỏi luật minimalist và tạo lại pool thì vendor gợi ý cho cặp đôi chọn "tối giản" phản ánh đúng văn bản vendor (minimalist 124 → 6). Chỉ số bảo vệ: số vendor mỗi tag khác và mọi trường khác của pool không đổi. (Chưa có số liệu hành vi người dùng; tác động lên tỷ lệ chọn vendor là GIẢ ĐỊNH, tự tin ~50%, không thuộc phạm vi đo của việc này.)

## Hành vi (người dùng thấy gì)
Định nghĩa dùng chung: **văn bản nguồn** của một vendor = name + description + merchant_description + từng `top_reviews[].text`. Style_tags hiện có KHÔNG phải văn bản nguồn.
**Dấu hiệu minimalist** = văn bản khớp không phân biệt hoa thường một trong `t[ốo]i\s*gi[ảa]n`, `minimali[sz]t`, `\bminimal\b`.

1. Extractor: văn bản chứa "tinh tế" (mọi kiểu hoa/thường, nhiều dấu cách) mà không có dấu hiệu minimalist thì KHÔNG ra `minimalist`; văn bản có "phong cách tối giản" (hoặc dấu hiệu minimalist khác) ra `minimalist`, kể cả khi đi kèm "tinh tế". "Tinh tế" đứng một mình ra danh sách rỗng, không ra tag nào khác thay thế. Chín tag còn lại (korean, luxury, rustic, natural, editorial, soft, traditional, modern, simple) giữ nguyên luật; "cao cấp" vẫn không ra tag nào.
2. Pool: sau khi tạo lại, so với pool trước: cùng tập id, cùng thứ tự; mọi trường ngoài `styles`/`tags` của mọi entry y hệt; `styles` == `tags`; `styles` mới == `styles` cũ bỏ `minimalist` (giữ thứ tự các tag còn lại), TRỪ vendor có dấu hiệu minimalist trong văn bản nguồn của BẤT KỲ bản ghi nào cùng id thì `styles` giữ nguyên. Tức chỉ `minimalist` giảm (124 → 6 trên dữ liệu hiện tại); không tag nào được thêm, không tag nào khác mất.
3. Enrichment (`_apply_enrichment`): style_tags sau enrich = kết quả extractor chạy trên văn bản nguồn SAU khi cập nhật merchant_description/top_reviews, **thay thế hoàn toàn** danh sách cũ (không cộng vào, không đọc style_tags cũ làm bằng chứng), theo thứ tự extractor trả. Tag cũ không còn bằng chứng bị bỏ, kể cả khi lần enrich đó không có text mới (danh sách có thể thành rỗng). `enrichment_log[-1].changes` ghi `style_tags_added` (tag mới so với trước) và `style_tags_removed` (tag bị bỏ), mỗi khoá chỉ có khi danh sách khác rỗng. Chạy lại lần hai trên cùng dữ liệu cho cùng kết quả.

Đường tạo lại pool (không bắt buộc, thứ tự bắt buộc): sửa extractor → tính lại style_tags của `tools/scraper/output/HCMC/*/vendors.json` từ văn bản nguồn (`clean_style_tags.py` đã làm đúng việc này) → `build_pool.py --out` → `generate-vendor-pool.js` ghi `tohong-back/lib/vendorPool.generated.js`. Đảo thứ tự hoặc bỏ bước 2 thì `build_pool` gộp lại tag cũ và pool vẫn còn 124.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (extractor, pipeline, dữ liệu scrape), `phungrk/tohong-back` (pool); nhánh `t-073-...` mỗi repo · Vùng: `planner/vendor/pool`
- Biến môi trường eval: `TOHONG_REPO` (mặc định `../tohong` so với gốc tohong-hq), `TOHONG_BACK_REPO` (mặc định `../tohong-back`). Không thấy repo thì eval FAIL có lý do, không PASS giả.
- Bất biến đã đọc: `_shared/` (INV-001 không secret, INV-002 số cái đọc được); `planner/`, `planner/vendor/`, `planner/vendor/pool/` chưa có bất biến nào. Anh em `planner/vendor/images` không chạy cho vùng này, nhưng spec đã khoá "mọi trường ngoài styles/tags không đổi" nên ảnh (URL marry.vn, chưa có manifest mirror ở tohong-back@6a9a9c7) không bị đụng. Không vi phạm bất biến nào.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng. Chỉ dữ liệu vendor công khai.
- Bậc đề xuất: A (đồng ý với Chief of Staff) — eval tự động phủ cả 3 tiêu chí; rollback là revert PR. Lưu ý việc chạm 2 repo: Engineering theo quy trình Spec Kit của repo gốc nếu cần.
- Eval `check_2.py` so với `baseline-pool.json` (tohong-back@6a9a9c7) nên chỉ có nghĩa tới khi PR pool merge; sau đó thay bằng bất biến đề xuất bên dưới.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | 'không gian tinh tế' qua extractor không ra minimalist; 'phong cách tối giản' ra minimalist; chín tag khác không đổi | `python3 -I eval/T-073/check_1.py` |
| 2 | So pool trước và sau: chỉ minimalist giảm, các tag và trường khác không đổi | `python3 -I eval/T-073/check_2.py` |
| 3 | Enrichment tính lại style_tags từ đầu, không cộng thêm, không tự củng cố tag cũ | `python3 -I eval/T-073/check_3.py` |

Tiêu chí 3 là cụ thể hoá vế "pipeline tính lại từ đầu" trong ý định của Capu và brief; board mới liệt kê 2 tiêu chí đầu.
Đã tự kiểm: ba eval ĐỎ trên code hiện tại (1: 11 lỗi; 2: 118 lỗi; 3: 8 lỗi) và XANH trên bản sửa mẫu dựng ở thư mục tạm (không nằm trong repo). `baseline-pool.json` sinh bằng `eval/T-073/make_baseline.py`, không chạy lại.

## Bất biến đề xuất (tầng 2), vùng `planner/vendor/pool`
- `eval/T-073/inv-proposed-pool-khop-nguon.py`: mọi `styles` của pool == hợp tag extractor hiện hành cho ra từ văn bản nguồn của các bản ghi cùng id. Chạy được ngay (PASS trên pool trước T-073, PASS trên pool mẫu sau sửa). Chặn tái phát: đổi luật extractor mà quên tạo lại pool, hay tag cũ nằm lại.
- Bất biến thứ hai (cho spec-critic cân nhắc, chưa viết file): "enrichment không bao giờ làm style_tags chứa tag mà extractor không ra từ văn bản nguồn" — check_3 đã phủ; chỉ rút nếu critic muốn phủ cả các đường backfill/merge.

## Không làm
Sửa tag simple; thêm tag boho (đã nằm trong pattern rustic, giữ nguyên); gắn tag bằng người hoặc bằng ảnh; đổi 9 tag khác; đổi `ALLOWED_TAGS`; đổi giá, ảnh, rating, thứ tự của pool; sửa `backfill.py`, `merge.py`, `build_pool.py` (cùng kiểu cộng-thêm nhưng ngoài ý định; nếu chạy lại chúng trên dữ liệu cũ thì tag cũ có thể quay lại, bất biến đề xuất sẽ bắt).

## Câu hỏi mở
`backfill.py`, `merge.py`, `build_pool.py` cũng chỉ cộng tag: có mở việc riêng để chúng tính lại từ đầu như pipeline không (đề xuất: có, bậc A, sau T-073)?
