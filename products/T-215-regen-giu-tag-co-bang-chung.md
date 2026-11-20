# Spec T-215: regen giữ tag có bằng chứng, không làm bẩn nguồn

## Ý định
Capu (chọn cách 1, "merge luôn khi xong"): giữ style_tags mà tohong#108 đã gán qua Google AI Mode kèm bằng chứng trong `enrichment_log`, không để bước tạo lại pool ghi đè; Sync vendor pool phải chạy xanh với dữ liệu của tohong `eadf6d75259578e6feab2c190033a0916ff52a29` (#108) cộng công cụ sau T-215, nghĩa là Sync chạy bằng SHA merge của T-215 trên main (xem Hành vi 6). Việc nằm ở bước 6 (Sync) của vòng đời dữ liệu vendor (ADR-136, `handbook/vong-doi-du-lieu-vendor.md`); bằng chứng được ghi ở bước 2 (Enrich).

## Bằng chứng
Mọi số đo do Product chạy lại trên bản sao của tohong `eadf6d75` + tohong-back `de5a17c` (thư mục tạm, không chạm repo thật), lệnh `bash tools/regen-pool-styles.sh --back <back> --photos-for all`:
- Regen ghi vào `tools/scraper/output/HCMC/venue/vendors.json` (85 vendor đổi `style_tags`) và `photography/vendors.json` (chỉ mất dòng cuối, không đổi dữ liệu). Nguyên nhân: `clean_style_tags.py` (bước 1 của regen) ghi đè nguồn bằng tag tính từ văn bản, rồi `json.dump` không có xuống dòng cuối.
- Báo cáo đã commit ở eadf6d75 TƯƠI trước regen (sinh lại từ dữ liệu cùng commit thì giống từng byte) và LỆCH sau regen: đúng điểm đỏ "Kiểm báo cáo tươi" của run 44756600169.
- Pool sau regen hiện tại: 76/76 vendor có bằng chứng bị đổi tag (vd PARKROYAL Saigon `natural,luxury,modern` thành `natural`); 73 vendor mất ít nhất một tag có bằng chứng.
- Dữ liệu #108: 77 bản ghi venue có dòng `enrichment_log` `source:"google_ai_mode"` mang `changes.style_tags` dạng `[{"tag","evidence","source_urls"}]` (228 phần tử trên mọi dòng như vậy, đều là object đủ ba khoá; ở dòng cuối của 77 bản ghi, mọi tag thuộc 10 tag chuẩn và mọi evidence không rỗng); 12 bản ghi không có; chỉ 1 vendor `verified` (Bình Quới 2, #108 bỏ qua, không có bằng chứng style). 29/77 bản ghi có `style_tags` rộng hơn tập tag có bằng chứng (tag cũ do văn bản nguồn sinh ra còn nằm lại).
- Sau regen, `npm test` của back xanh 204/204 (với cách chạy hiện tại, chỉ để biết đường nền).
- Mức tự tin về chẩn đoán nguyên nhân: cao (~95%, đã dựng lại). Mức tự tin chọn luật "giữ cả vendor" (xem Định nghĩa): trung bình (~75%), đây là điểm chọn của Product, không phải ý Capu đã nói.

## Giả thuyết
Nếu regen (a) giữ nguyên `style_tags` của vendor có bằng chứng và (b) không ghi vào dữ liệu nguồn, thì Sync vendor pool cho eadf6d75 qua bước "Kiểm báo cáo tươi" và pool mang đúng tag của #108. Chỉ số bảo vệ: pool của vendor không có bằng chứng giống hệt như hôm nay (ADR-025: tag từ văn bản nguồn; giá, ảnh, trường khác không đổi).

## Hành vi (người dùng thấy gì)
Người thật chạm tới là Capu (quản trị) và cặp đôi (thẻ vendor). Cặp đôi thấy tag phong cách trên thẻ vendor của pool.

### Định nghĩa dùng chung
- **10 tag chuẩn**: `korean, luxury, rustic, natural, editorial, soft, traditional, modern, minimalist, simple`, chữ thường, so khớp đúng từng ký tự (ADR-025, "Không làm" bên dưới không đổi danh sách).
- **Bản ghi nguồn**: một phần tử trong `tools/scraper/output/HCMC/*/vendors.json`. Một vendor (cùng `id`) có thể có nhiều bản ghi ở nhiều hạng mục.
- **Bằng chứng hợp lệ** của một bản ghi: trong `enrichment_log` của bản ghi, lấy dòng CUỐI CÙNG (theo thứ tự trong danh sách, không theo `timestamp`) có `source` đúng bằng `"google_ai_mode"` và `changes` là object CÓ khoá `style_tags`. Bằng chứng hợp lệ khi `changes.style_tags` là danh sách có ÍT NHẤT MỘT phần tử là object với `tag` thuộc 10 tag chuẩn và `evidence` là chuỗi không rỗng sau khi cắt khoảng trắng. Không hợp lệ (nên bản ghi không được bảo vệ) khi: không có dòng nào như thế; dòng cuối đó có `style_tags` rỗng; mọi phần tử là chuỗi thay vì object; mọi `tag` ngoài 10 tag chuẩn; mọi `evidence` rỗng; `source` khác (kể cả `rescrape_marry`, `google_maps`, `geocoding`, ghi tay).
- **Vendor được bảo vệ**: có ít nhất một bản ghi nguồn với bằng chứng hợp lệ. **Tag của vendor được bảo vệ** = `style_tags` của các bản ghi hợp lệ của nó, gộp theo thứ tự đường dẫn file rồi thứ tự trong file, bỏ trùng giữ lần đầu (trong dữ liệu #108 mỗi vendor chỉ có một bản ghi hợp lệ nên đây chính là `style_tags` của bản ghi đó).
- Không dùng làm điều kiện bảo vệ: `verification_status` (verified, hay bất kỳ), cờ `flags`, ghi tay. Lý do ở mục Ràng buộc.

### Khi chạy regen-pool-styles.sh (Sync, bước 6)
1. **Vendor được bảo vệ còn trong pool**: `styles` và `tags` trong pool bằng đúng danh sách tag của vendor được bảo vệ, đúng thứ tự, kể cả tag mà văn bản nguồn không còn hỗ trợ và kể cả tag của vendor không có bằng chứng riêng (giữ cả danh sách, không cắt theo bằng chứng).
2. **Mọi vendor khác** (không bản ghi nào hợp lệ): y như hôm nay. Tag = tập tag extractor tính từ văn bản nguồn (name, description, merchant_description, top_reviews) của mọi bản ghi cùng id; tag cũ trong `style_tags` không bao giờ góp phần (ADR-025, INV pool/inv-002).
3. **Mọi trường khác của pool** (giá, ảnh, mô tả, sức chứa, danh mục, v.v.) giống hệt lần chạy mà không vendor nào được bảo vệ, trừ `styles` và `tags` của vendor được bảo vệ. `--prune` vẫn gỡ vendor đã remove hoặc tạm đóng cửa khỏi pool dù vendor có bằng chứng (vd Pergola Garden Restaurant). `--verified-only` vẫn không động vào tag.
4. **Regen không làm đổi bất kỳ file nào đang được git theo dõi trong tohong, NGOÀI thư mục back**, và không tạo file mới ngoài `.gitignore` (nhất là không ghi `tools/scraper/output/HCMC/*/vendors.json`, `enrich-report.json`, `output/vendors.json`). Thư mục back là đường dẫn `--back` trỏ tới khi nó nằm trong tohong (mặc định `edge`, một submodule của tohong trỏ tới tohong-back): ghi pool và `matcher-data/vendors.json` vào đó là việc đúng của regen và không tính vào phép kiểm này (nếu không `git status` hiện ` m edge`). Ghi được thêm: file trung gian bị `.gitignore`.
5. Hành vi trên không phụ thuộc có `--photos-for` hay không, không gọi mạng, không gọi Google.
6. Kết quả sync (back): sau regen, bước nhúng báo cáo và bước "Kiểm báo cáo tươi" (báo cáo sinh lại từ dữ liệu cùng commit giống từng byte `enrich-report.json` của tohong) qua; `npm test` của back qua. **"Sync xanh" nghĩa là**: Sync vendor pool chạy bằng SHA merge của T-215 trên main (công cụ mới T-215 + dữ liệu #108), nhãn nhánh khớp tiền tố workflow cho phép. Chạy lại Sync với chính eadf6d75 vẫn đỏ (workflow lấy cả công cụ cũ tại `tohong_ref`) và không thuộc tiêu chí. Vì thế eval và gate KHÔNG ghim commit cũ (không đặt `T215_REF`): chúng đo cây tohong được giao (`TOHONG_REPO`), cây này phải đã có dữ liệu #108, không thì eval FAIL kèm lý do.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (không sửa tohong-back, không sửa dữ liệu `vendors.json` của #108) · Nhánh: `t-215-regen-giu-tag-co-bang-chung` · Vùng: `planner/vendor`.
- Bất biến đã đọc: `eval/invariants/_shared/` và `eval/invariants/planner/vendor/**` (pool/inv-001..004, inv-001..007, matching/).
  - **Đề nghị đổi INV `planner/vendor/pool/inv-001-pool-khop-van-ban-nguon.py` ở (b)**: hiện đòi mọi `styles` == tag extractor từ văn bản nguồn nên đỏ ngay với pool của spec này (đã chạy thử: v1 đỏ 74 vendor trên pool mô phỏng đúng spec). Bản thay: `eval/T-215/inv-proposed-pool-khop-van-ban-nguon-v2.py`, khác v1 đúng một chỗ (vendor được bảo vệ thì `styles` == tag của vendor được bảo vệ). Đây là carve-out cho ADR-025 nên cần Chief of Staff ghi `decisions/` và thay file (agent khác không tự đổi).
  - Không mâu thuẫn pool/inv-002 (extractor không đọc tag cũ: giữ nguyên, bảo vệ làm NGOÀI extractor), inv-003, inv-004 (`pool-vendors.json` vẫn không vào git).
- Việc lân cận phải coi chừng (ngoài vùng `planner/vendor`, gate không tự chạy): nếu regen đọc thêm trường nguồn (vd `enrichment_log`) thì `tools/scraper/pool-input-fields.json` phải có mục tương ứng. Trên main hiện hành (sau #108) `planner/admin/vendor-enrich/inv-006` và `inv-014` ĐÃ đỏ sẵn (manual_overrides.json +16 mục, `price_range.price_source`): đó là sự cố bể riêng do Chief chuyển việc khác, **không thuộc T-215 và Engineering không sửa danh mục để làm chúng xanh**. Eval 5 đo tương đối: T-215 không được thêm lệch MỚI so với commit nền.
- Tài liệu: `tools/scraper/README.md` ghi luật bảo vệ (Định nghĩa) và dòng "regen không ghi nguồn"; thêm test vào `tools/scraper/test_style_tags_t075.py` hoặc file test mới cho các kiểu bằng chứng hỏng. Cách cài đặt do Engineering chọn.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng. Không gọi Google (không tốn tiền).
- Bậc lưới lọc: **B** (đổi logic sinh pool; không chạm ranh giới cứng; Capu đọc diff hành vi, Chief merge sau 48 giờ không phản đối; Capu đã nói "merge luôn khi xong" nên không cần chờ đủ 48 giờ nếu Capu xác nhận ở Slack).

### Vì sao luật bảo vệ hẹp nhất là "bằng chứng hợp lệ trong dòng google_ai_mode cuối"
- Phủ đủ #108: 77/77 bản ghi có tag gán bằng Google AI Mode đều hợp lệ, 0 bản ghi khác bị kéo vào (12 bản ghi không có bằng chứng, 1 verified Bình Quới 2 không có style evidence).
- `verified` không được thêm vào: trong mã, verified chỉ mở khoá mô tả, sức chứa, giá (`--verified-only`); #108 chủ động không đổi `verification_status` của vendor nào; vendor verified duy nhất không có bằng chứng style, nên thêm nó là mở rộng vô căn cứ.
- Cờ "ghi tay" không có trường nào trong dữ liệu hôm nay (`flags` chỉ có `insufficient_reviews`, `no_phone`, ...), thêm là bịa cơ chế. Nếu sau này cần, đó là việc riêng.
- "Dòng cuối quyết định" thay vì "bất kỳ dòng nào": tránh giữ vĩnh viễn tag mà một lần enrich sau đã bỏ.
- Giữ cả danh sách vendor thay vì chỉ tag có bằng chứng: pool phải khớp `style_tags` Capu đã merge ở #108 (29/77 vendor có tag rộng hơn bằng chứng; cắt đi thì pool khác #108 ở 29 vendor, trái "giữ style_tags của #108"). Mặt trái: tag không có bằng chứng riêng của 29 vendor đó ở lại cho tới lần enrich tiếp theo của vendor đó.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`: `TOHONG_REPO=<cây tohong đã có #108: main hiện hành hoặc worktree Engineering> TOHONG_BACK_REPO=<tohong-back> python3 -I <file>`. Mọi eval chạy trên bản sao tạm (không làm bẩn repo thật), không mạng. Không có biến ghim commit: ghim sẽ ghim cả công cụ về trước T-215 và làm eval 1-4 đỏ vĩnh viễn.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Sau regen, mọi vendor được bảo vệ còn trong pool có `styles` == `tags` == tag của vendor được bảo vệ (đúng thứ tự); với eadf6d75 là 76 vendor | `python3 -I eval/T-215/check_1_tag_co_bang_chung_duoc_giu.py` |
| 2 | Bản ghi có bằng chứng hỏng (5 kiểu: source lạ, evidence rỗng, tag ngoài 10, dòng cuối rỗng, phần tử là chuỗi) và vendor không bằng chứng: tag == tập tag từ văn bản nguồn; vendor còn được bảo vệ vẫn giữ tag; mọi trường khác của pool giống lần tham chiếu | `python3 -I eval/T-215/check_2_vendor_con_lai_hanh_vi_cu.py` |
| 3 | Sau regen `git status --porcelain` của tohong rỗng, không tính thư mục back (back đặt trong cây như `edge`) | `python3 -I eval/T-215/check_3_regen_khong_lam_ban_nguon.py` |
| 4 | Mô phỏng sync-vendor-pool: regen, nhúng báo cáo, "Kiểm báo cáo tươi" (cmp byte), `npm test` của back đều qua (cần `node_modules` ở back, không thì ghi "bỏ qua test back") | `python3 -I eval/T-215/check_4_mo_phong_sync_qua_bao_cao_tuoi.py` |
| 5 | Danh mục trường nguồn tạo pool: T-215 không thêm lệch MỚI (đo inv-006 và inv-014 của `planner/admin/vendor-enrich` trên commit nền và trên ứng viên; lệch có sẵn trên main không tính) | `python3 -I eval/T-215/check_5_danh_muc_truong_nguon_con_khop.py` |

Ghi chú trung thực về đỏ-trước: trên main hiện hành (tohong `eadf6d75`, tohong-back `de5a17c`) với regen hiện tại, eval 1-4 ĐỎ (1: 76/76 vendor đổi tag; 2: 0 vendor còn giữ tag; 3: 2 file bẩn; 4: báo cáo lệch sau regen). Eval 5 XANH ở dạng tương đối (ứng viên trùng nền thì PASS ngay; hai bất biến nó đo đang đỏ sẵn trên main và nằm ngoài phạm vi). Đã kiểm eval XANH được: một bản cài mẫu dựng riêng trong thư mục tạm (không phải mã giao) làm cả năm eval xanh. Eval cần cây tohong đã có #108 (không thì FAIL rõ lý do); commit nền của eval 5 là merge-base của HEAD với `origin/main` trong `TOHONG_REPO`, nên worktree Engineering cần là repo git dựng trên main.

## Bất biến đề xuất (tầng 2)
Cho `planner/vendor/pool/` (Spec critic rút khi spec qua, Chief đặt số):
1. **Thay** `inv-001` bằng `eval/T-215/inv-proposed-pool-khop-van-ban-nguon-v2.py` (carve-out ADR-025, xem Ràng buộc). Thứ tự (ADR-137, phần bổ sung): v2 đo pool đã commit trong back nên chỉ xanh sau khi PR Sync ở back (chạy bằng SHA merge của T-215) merge; Chief thay inv-001 sau đó và kiểm v2 xanh trên main mới. Gate của T-215 không chạy `pool/*` (vùng con) nên không bị chặn bởi việc này.
2. **Mới** `eval/T-215/inv-proposed-tag-co-bang-chung-song-qua-regen.py`: tag có bằng chứng sống qua regen (tính chất tiêu chí 1, chạy trên dữ liệu tohong hiện hành, "chưa áp dụng" khi chưa có vendor nào có bằng chứng).
3. **Mới** `eval/T-215/inv-proposed-regen-khong-lam-ban-nguon.py`: regen không làm bẩn cây tohong (tiêu chí 3; mở rộng ý (2) của pool/inv-004 từ một file trung gian sang mọi file được theo dõi).
Cả ba là đề xuất (Spec critic rút, Chief đặt số), chạy bằng `python3 -I`, dùng `eval/lib/regen_fixture.py` (thư viện dùng chung, đã nằm trong `eval/lib/`), ~2 giây mỗi cái.

## Không làm
- Đổi danh sách 10 tag; gọi Google; dựng lại PR #104; sửa `vendors.json`/`enrich-report.json` của #108; sửa tohong-back.
- Thêm điều kiện bảo vệ theo `verification_status` hoặc cờ ghi tay.
- Đổi hành vi extractor `StyleTagExtractor` (không đọc tag cũ; luật tinh tế/tối giản của T-073).
- Đổi hành vi khi chạy trực tiếp `clean_style_tags.py` (script one-off tự ghi nguồn): chỉ ràng buộc lệnh `regen-pool-styles.sh`. Rủi ro còn lại: ai chạy tay script đó sẽ ghi đè `style_tags` của nguồn; ghi cảnh báo trong README là đủ cho việc này.
- Đổi tag của vendor đã được bảo vệ khi bằng chứng sau này đổi: đó là việc của bước Enrich (ghi dòng `google_ai_mode` mới), không phải của regen.

## Diff hành vi cần nói thẳng với Capu (bậc B)
- 29/77 vendor có bằng chứng sẽ mang trên thẻ những tag KHÔNG có bằng chứng riêng (tag cũ do văn bản nguồn sinh ra, nằm lại trong `style_tags` của #108): luật giữ cả danh sách. Đây là điểm Product tự chọn (~75%), không phải lời Capu; tag thừa ở lại tới lần enrich tiếp theo của vendor đó. Luật thay thế (chỉ giữ tag có bằng chứng) làm pool khác #108 ở 29 vendor.

## Nhật ký spec rework (vòng 1, defect T-215-D1)
Đã sửa: (1) tiêu chí 5 và câu "xanh trên main": eval đo tuyệt đối đã đỏ sẵn trên main từ #108 nên sai; thành phép đo tương đối so với commit nền (Chief phân xử, ADR-137 bổ sung). (2) Ý định và Hành vi 6 "Sync cho eadf6d75 xanh": không thể đúng nghĩa đen vì Sync lấy công cụ tại `tohong_ref`; thành "Sync chạy bằng SHA merge của T-215", bỏ `T215_REF`. (3) Hành vi 4 tự mâu thuẫn với `--back` mặc định `edge` (submodule): loại thư mục back. (4) Diff hành vi nêu 29/77. Bất biến đề xuất giữ là đề xuất; v2 sửa cách dò gốc HQ theo scripts/gate.py (ADR-070).

## Câu hỏi mở
Không có câu cần Capu. Một đề nghị cho Chief of Staff (không phải của Capu): ghi `decisions/` carve-out ADR-025 ("tag có bằng chứng Google AI Mode được giữ qua regen") và thay `planner/vendor/pool/inv-001` bằng v2, vì nếu không Code Gate tầng 2 sẽ đỏ và trả spec.
