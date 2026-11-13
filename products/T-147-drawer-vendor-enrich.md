# Spec T-147: drawer-vendor-enrich

> v1 · Spec Writer (product) · 2026-11-13 · bậc B · vùng `planner/admin/vendor-enrich` · chạm 3 repo (tohong, tohong-back, tohong-front) · nối tiếp `products/T-124-bang-enrich-vendor.md` (bảng) và T-125 (code bảng)

## Ý định
Capu (2026-11-13, `board/T-147.md`): "khi click vào item vendor, hiển thị drawer bên phải (co giãn được); hiển thị tất cả thuộc tính được dùng để tạo vendor pool". Mục đích: xem đầy đủ dữ liệu sinh ra pool của từng vendor ngay trong bảng enrich, không phải mở file.

## Bằng chứng
Đo bằng chạy thật trên bản chụp tohong (`tools/scraper/output/HCMC`, 1109 bản ghi, 870 vendor trong báo cáo) và tohong-back (pool 867 vendor). Tự tin cao (~90%) cho danh sách trường (đo thực nghiệm, xem Hành vi 1); số kích thước đo trên **bản dựng thử không giao** (đã bỏ).
- **Generator nằm ở tohong, không ở tohong-back.** `tools/generate-vendor-pool.js` (tohong) đọc `output/pool-vendors.json`, file này do `tools/scraper/build_pool.py` gộp từ `vendors.json` + `enrichment-audit.json` (không được commit). `tools/regen-pool-styles.sh` chạy thật: `clean_style_tags.py` → `build_pool.py` → `generate-vendor-pool.js --styles-only --prune [--photos-for]`. tohong-back chỉ có `tools/generate-vendor-enrich-report.js`.
- **Generator và hai bước trước không đọc `manual_overrides.json` hay `enrich-report.json`** (đổi mọi trường của hai tệp này, hoặc xoá hẳn, đầu ra không đổi). Duyệt tay tác động gián tiếp: lần enrich/refresh sau ghi kết quả vào `vendors.json` (`enrichment_log`, `google_photos`) hoặc chuyển vendor sang `removed_vendors.json`. Vì vậy danh sách "dùng để tạo pool" chỉ có hai tệp nguồn.
- Hiện Worker chỉ có báo cáo enrich nhúng (655 KB thô / 98 KB nén) và pool (874 KB); không có `vendors.json` thô (698 KB chỉ riêng `venue`, 3,2 MB cả bộ). Worker hiện: `worker.js` 2,38 MB thô / **445 KB nén**.
- Pool 867 vendor, báo cáo 870 dòng: ba dòng ngoài pool đều là nhóm `temp_closed`.
- **Quan sát ngoài phạm vi** (không sửa ở việc này): `marry.address` trong báo cáo hiện có sẵn của một số vendor còn dính chữ cào từ marry.vn lẫn số điện thoại / website (vd `marry_57790d6f6f08`: "…Hồ Chí Minh097 204 77 88Điện thoạiSĐThttps://…Website…Facebook"). Chỉ nằm sau route admin, nhưng trái tinh thần "không lộ liên hệ"; đề nghị Chief of Staff mở việc riêng.

## Giả thuyết
Nếu Capu xem được đúng các trường nguồn mà generator đọc, cạnh giá trị pool và lớp ẩn/giá của admin, ngay trên dòng vendor, thì thời gian trả lời "vì sao vendor này hiện sai giá / sai ảnh / không hiện" giảm từ mở 3 tệp xuống một cú bấm. Chỉ số bảo vệ: không có dữ liệu liên hệ nào ra khỏi route admin; kích thước Worker không vượt ngưỡng; bảng Approve / Sửa thủ công (T-124) không đổi hành vi.

## Hành vi (người dùng thấy gì)

### 1. Danh mục thuộc tính "dùng để tạo vendor pool" (một chỗ duy nhất)
Một file trong repo tohong: **`tools/scraper/pool-input-fields.json`** = `{schema_version:1, fields:[{file, key, label, stages, pool, max_chars?}]}`.
- `file` ∈ `vendors.json` | `enrichment-audit.json` | `manual_overrides.json` | `enrich-report.json`; `key` = đường dẫn trong bản ghi của tệp đó, tối đa hai cấp: `k`, `k.sub` (dict) hoặc `k[].sub` (mảng dict), không trùng `(file, key)`.
- `stages` ⊆ {`style` = `clean_style_tags.py`, `build` = `build_pool.py`, `gen` = `generate-vendor-pool.js`}, không rỗng. `pool` = tên các trường của vendor trong pool bị ảnh hưởng. `label` = nhãn tiếng Việt hiện trên drawer. `max_chars` = chuỗi dài hơn bị cắt khi nhúng vào báo cáo.
- Báo cáo enrich và drawer **chỉ lấy danh sách từ file này** (drawer nhận qua API, không liệt kê cứng). Không có bản thứ hai. Không có mục nào thuộc `contact`.

Nội dung khởi đầu (đo ngày 2026-11-13 trên mã hiện tại; eval #1 giữ danh mục khớp với mã **hai chiều**):

| Tệp | Khoá | Bước đọc | Trường pool bị ảnh hưởng | Lớp admin R2 (`vendor_overrides.json`) |
| --- | --- | --- | --- | --- |
| vendors.json | `id` | build, gen | `id` | khoá của ghi đè |
| | `name` | style, gen | `name`, `styles`, `tags` | — |
| | `categories` | gen | `category`, `catLabel`, `catIcon` (hạng mục matcher đầu tiên; không có hạng mục nào trong 10 hạng mục matcher thì vendor không vào pool) | — |
| | `city` | gen | `city` (thiếu: `HCMC`) | — |
| | `description` | style, gen | `description` (220 ký tự đầu), `styles`, `tags` | — |
| | `merchant_description` | style | `styles`, `tags` | — |
| | `style_tags` | gen | `styles`, `tags` | — |
| | `price_range.min_vnd`, `price_range.max_vnd` | gen | `priceMin`, `priceMax` (triệu VND, làm tròn 0,1; thiếu hoặc 0 thì giá mặc định theo hạng mục) | `priceMin`, `priceMax` (số) **thay** giá pool khi trả cho cặp đôi; `price_verified` chỉ đổi nhãn nguồn giá |
| | `reviews[].source`, `.rating`, `.count` | gen | `rating`, `reviewCount` (phần tử đầu có `source=google_maps`) | — |
| | `top_reviews[].text`, `.author`, `.rating` | style (`text`), gen | `reviews` (tối đa 5 phần tử có `text`), `styles`, `tags` | — |
| | `google_photos[].uri`, `.attributions` | gen | `photos` (nguồn google, tối đa 4, qua danh sách cho phép host googleusercontent) | — |
| | `portfolio_urls` | gen | `photos` (nguồn marry, tối đa 4, chỉ khi không có ảnh Google hợp lệ) | — |
| | `enrichment_log[].source`, `.place_id` | build, gen | giữ hoặc hạ ảnh Google của pool (T-131: mất `place_id` thì ảnh Google bị hạ về ảnh marry khi sinh lại) | — |
| enrichment-audit.json | `vendor_id`, `closed_state`, `status`, `retry` | build | không có trường pool: dòng tạm đóng cửa (`closed_state=temporarily_closed`, hoặc `status=temporarily_closed` cùng `retry=true`) làm vendor **không vào pool** | — |

Ngoài danh mục (không phải trường nguồn, hiện ở phần pool): giá mặc định theo hạng mục, cắt mô tả 220 ký tự, `capacity {100,300}` của venue, `isVerified`, `availability`. Lớp admin còn có `hidden`: vendor bị ẩn khỏi kết quả ghép cho cặp đôi (không đổi pool). `contact` của lớp admin **không bao giờ** ra drawer.

Danh mục là **điều kiện đúng hai chiều với mã**: mọi trường mà một bước đọc phải có mục (nếu không, drawer thiếu); không mục nào được thừa (nếu không, drawer nói dối). Generator đọc thêm một trường mới thì eval #1 đỏ cho tới khi mục tương ứng được thêm vào danh mục, và khi đó báo cáo, API, drawer tự có trường đó (eval #2, #3, #6 đo đúng chuỗi này).

### 2. Dữ liệu lấy từ đâu khi chạy
**Chọn: nhúng thêm bản rút gọn vào chính `enrich-report.json` khi sinh** (tohong sinh; tohong-back nhúng như cũ qua `lib/vendorEnrichReport.generated.js`; Worker không đọc mạng, R2 hay GitHub cho phần này). Lý do: báo cáo đã có đủ máy móc giữ tươi (INV-003 "báo cáo = sinh lại từ dữ liệu cùng commit", sáu workflow đã sinh lại báo cáo, bất biến chờ merge của T-135), nên chi phí thêm bằng không.
Phương án đã loại, kèm cái giá: (a) file sinh thứ hai (`enrich-detail.json`): phải thêm bất biến tươi riêng và sửa add-paths của sáu workflow; (b) đẩy `vendors.json` lên R2 từ workflow: thêm đường ghi, thêm secret, thêm chế độ lỗi; (c) Worker tải GitHub lúc chạy: cần token, thêm mạng; (d) nhúng nguyên `vendors.json`: 3,2 MB thô, kèm toàn bộ liên hệ (số điện thoại, website, facebook của vendor).
- Báo cáo thêm `pool_catalog` ở **gốc** (= mảng `fields` của danh mục, nguyên văn) và `pool_input` ở **mỗi dòng** `vendors[]` = `{record, audit, truncated}` (nội dung ở docstring eval #2): `record` = bản ghi `vendors.json` sau khi gộp theo id bằng đúng `build_pool.collapse_by_id` (không lọc tạm đóng, để vendor ngoài pool vẫn có nguồn), chỉ các khoá của danh mục và chỉ những phần tử generator dùng; `audit` = dòng audit làm vendor tạm đóng nếu có, không thì dòng audit theo luật T-124, chỉ các khoá của danh mục; `truncated` = `{khoá: độ dài gốc}`. **Không có `contact`/số điện thoại/website/facebook trong `pool_input`.** Thay đổi chỉ thêm khoá (`schema_version` vẫn 1); mọi khoá T-124 giữ nguyên.
- `tools/regen-pool-styles.sh` phải sinh lại báo cáo (vì `style_tags` nằm trong `pool_input` và bước này sửa chúng); các workflow khác không đổi (đã sinh lại báo cáo).
- Kích thước (đo trên bản dựng thử): báo cáo 655 KB → 1,96 MB thô (98 KB → 473 KB nén); `worker.js` 2,38 MB → 4,04 MB thô, **445 KB → 837 KB nén**. Ngưỡng ghi vào eval #5: worker nén ≤ **1.000.000 byte** (một phần ba giới hạn 3 MB của gói Worker miễn phí; chưa biết chắc gói đang dùng: GIẢ ĐỊNH, tự tin ~60%, nên lấy giới hạn nhỏ nhất), báo cáo nhúng ≤ 2.500.000 byte thô. Còn chỗ trống ~160 KB nén: việc nào cần thêm dữ liệu vào báo cáo sau này phải đo lại, không tự nới ngưỡng.
- **INV-005** (Worker khởi động trong workerd với `wrangler.toml` thật) chạy ở tầng 2 cho mọi việc chạm vùng `planner`; eval #5 còn chạy nguyên văn nó một lần nữa và đòi xanh. Không thêm `nodejs_compat`, không thêm import `node:*` (INV-005 sẽ đỏ).
- Danh sách `GET /api/admin/vendor-enrich` **không** mang `pool_input`/`pool_catalog` (kích thước phản hồi và an toàn).

### 3. API chi tiết (repo tohong-back)
`GET /api/admin/vendor-enrich/<id>/detail`, `Cache-Control: no-store`, chỉ đọc. Phản hồi 200 có đúng các khoá:
- `data_as_of` (= báo cáo), `id`, `name`.
- `catalog` = `pool_catalog` của báo cáo, nguyên văn.
- `source` = `{available, record, audit, truncated}` = `pool_input` của dòng; dòng báo cáo không có `pool_input` (báo cáo cũ) thì `{available:false, record:null, audit:null, truncated:{}}` và vẫn 200.
- `pool` = `{in_pool, visible, vendor, reasons:[{code,text}]}`; `vendor` = đúng bản ghi trong `vendorPool.generated.js` (null nếu ngoài pool); `visible` = trong pool và chưa bị admin ẩn. Lý do theo thứ tự, mã và **chữ cố định**:
  - `temp_closed` "Tạm đóng cửa: không vào pool" (ngoài pool, nhóm `temp_closed`);
  - `removed` "Đã duyệt gỡ vendor: không vào pool" (ngoài pool, `override.action = remove`);
  - `not_generated` "Không có trong pool đang chạy: pool chưa được sinh lại sau lần enrich cuối" (ngoài pool, không thuộc hai mã trên);
  - `overlay_hidden` "Admin đã ẩn vendor (lớp R2): cặp đôi không thấy" (trong pool, lớp admin `hidden=true`);
  - `unverified` "Ảnh Google chưa qua kiểm khớp (T-104): vẫn đang chạy trong pool" (trong pool, nhóm `unverified`);
  - `stale_google_photos` "Pool còn ảnh Google nhưng nguồn không còn place_id: sẽ bị hạ ở lần sinh lại" (trong pool, có ảnh nguồn google, `google.matched` không đúng).
  Ba ý của Capu: "bị gỡ" = `temp_closed`/`removed`/`not_generated`; "hạ" = `stale_google_photos`; "chưa duyệt" = `unverified`.
- `overlay` = `null` nếu R2 `data/admin/vendor_overrides.json` không có ghi đè của vendor (hoặc ghi đè chỉ có `contact`); khác thì **chỉ** các khoá `hidden`, `hidden_reason`, `priceMin`, `priceMax`, `price_verified` có trong ghi đè (không `contact`, không `updated_by`/`updated_at`). Đọc R2 mới nhất **mỗi lần** (không dùng cache 5 phút của đường chat).
- Lỗi: id không có trong báo cáo 404 `not_found`; id sai dạng 400; phương thức khác GET 405. Không ghi R2, không đọc `conversations/`, không gọi mạng.
- Vendor đã gỡ khỏi `vendors.json` (`removed_vendors.json`, hiện 10) không có dòng trong bảng nên không mở được drawer: ngoài phạm vi (xem "Không làm").

### 4. Quyền
Chỉ **Capu**: người đăng nhập Clerk có user id nằm trong **cả** `ADMIN_USER_IDS` **lẫn** `CAPU_USER_IDS` (`isCapu` có sẵn). Kiểm Capu là việc **đầu tiên** của mọi yêu cầu tới `/<id>/detail`, trước kiểm phương thức, kiểm id và tìm vendor, nên mọi lý do từ chối (không token, token rác, user thường, admin không phải Capu, `ADMIN_USER_IDS` hoặc `CAPU_USER_IDS` rỗng/thiếu, token `dev:` khi `DEV_AUTH_BYPASS` tắt, người trong `CAPU_USER_IDS` mà không trong `ADMIN_USER_IDS`) đều trả **403 `{"error":"forbidden"}`** (thân đúng một khoá, không lộ vendor nào tồn tại) và không ghi gì. Các route cũ của bảng (danh sách, review, export) giữ nguyên quyền admin; admin không phải Capu vẫn xem được bảng nhưng drawer báo "Chỉ Capu xem được chi tiết này". Route công khai (`/api/vendors/*`) không bao giờ mang `pool_input`, `catalog`, audit.

### 5. Drawer (repo tohong-front, `src/admin/`)
- **Mở:** bấm vào dòng (chỗ không phải nút, liên kết, ô nhập) của "Bảng enrich vendor" gọi đúng một lần API chi tiết rồi mở drawer. Dòng nhận tiêu điểm bằng Tab (`tabindex 0`) và mở bằng Enter; **không thêm nút nào vào dòng** (T-124 đòi dòng đã duyệt tay không còn nút nào). Dòng đang mở có `aria-current="true"`. Bấm dòng khác thì drawer đổi sang vendor đó (vẫn một drawer); trả lời chậm của vendor cũ không đè lên vendor mới.
- **Hình dạng:** phần tử `role=dialog` tên **"Chi tiết vendor · <tên>"** (`aria-modal="false"`), dính mép phải khung nhìn, cao hết khung nhìn, rộng mặc định `min(560px, khung nhìn)`. Trên khung nhìn rộng hơn 480px nội dung trang chừa lề phải bằng đúng bề rộng drawer để **bảng không bị che**; Approve / Sửa thủ công của dòng khác vẫn bấm được và **không** mở drawer.
- **Kéo giãn:** tay cầm `role=separator` tên **"Kéo để đổi bề rộng ngăn kéo"** (`aria-valuemin`/`max`/`now`, nhận tiêu điểm). Min = `min(560, khung nhìn)`, max = `max(min, 90% khung nhìn)` (1280px: 560…1152). Kéo chuột sang trái làm rộng ra; phím ← / → đổi 24px, Home = min, End = max. Độ rộng được **nhớ** (localStorage) và áp lại sau khi tải lại trang.
- **Đóng:** nút **"Đóng"** hoặc phím Esc; khi hộp thoại "Sửa thủ công" đang mở thì Esc chỉ đóng hộp thoại đó. Đóng xong tiêu điểm về dòng đã mở.
- **Khung hẹp (≤ 480px):** drawer rộng đúng khung nhìn, phủ kín, **không** có tay cầm kéo, trang không cuộn ngang, nút "Đóng" cao ≥ 40px.
- **Nội dung** (toàn bộ từ phản hồi API; giao diện không liệt kê trường cứng): mục **"Thuộc tính nguồn dùng để tạo vendor pool"** hiện mỗi mục của `catalog` đúng một dòng "<label> <giá trị>", giá trị vắng ghi "—", mảng thì mỗi phần tử một dòng, trường bị cắt ghi "(rút gọn, gốc N ký tự)"; mục **"Kết quả trong pool"** ghi "Trong pool" | "Trong pool · đang ẩn" | "Ngoài pool", các lý do bằng chữ API trả, rồi mỗi trường của `pool.vendor` một dòng "<tên trường> <giá trị>"; mục **"Lớp admin (R2)"** ghi "Không có ghi đè" hoặc "Ẩn: có|không", "Lý do ẩn: …", "Giá tối thiểu ghi đè: …", "Giá tối đa ghi đè: …", "Giá đã xác minh: có|không". `source.available=false`: "Báo cáo chưa có dữ liệu nguồn của vendor này". Đang chờ: "Đang tải…".
- **Lỗi:** 403 → "Chỉ Capu xem được chi tiết này"; 404 → "Không có chi tiết cho vendor này"; lỗi khác → câu lỗi chung của admin. Drawer lỗi không hiện ba mục trên; bảng còn nguyên.
- Không request ra ngoài (không Google), không `track` (research R8 của admin).

### 6. Chia PR và thứ tự merge
1. **tohong** · nhánh `t-147-pool-input` · **merge trước**: `tools/scraper/pool-input-fields.json`; `build_enrich_report.py` (+ test `test_t147_pool_input.py`) thêm `pool_catalog` và `pool_input`; `tools/regen-pool-styles.sh` sinh lại báo cáo; `enrich-report.json` sinh lại và commit cùng PR (INV-003). Eval: #1, #2.
2. **tohong-back** · nhánh `t-147-api-detail` · **merge thứ hai, sau khi PR 1 vào `main`**: `lib/vendorEnrichReport.generated.js` sinh lại từ báo cáo đã merge (`node tools/generate-vendor-enrich-report.js`); `lib/vendorEnrich.js` (`getEnrichDetail`, bỏ `pool_input` khỏi dòng danh sách); route trong `api/admin.js`; `test/test_vendor_enrich_detail.js` thêm vào `npm test`. Deploy tự động có sẵn. Eval: #3, #4, #5.
3. **tohong-front** · nhánh `t-147-drawer` · **merge cuối, sau khi back đã deploy**: `src/admin/EnrichDrawer.jsx`, thay đổi dòng trong `EnrichTable.jsx`, `adminEnrichDetail` trong `src/api.js`, CSS trong `admin.css`. Eval: #6. Merge sớm hơn thì drawer chỉ hiện câu lỗi (an toàn).
Rollback: revert từng PR theo thứ tự ngược (front, back, tohong); mỗi PR đứng độc lập về mặt dữ liệu (thêm khoá, không đổi khoá cũ).

## Ràng buộc (vòi)
- Repo và nhánh: `phungrk/tohong` · `t-147-pool-input`; `phungrk/tohong-back` · `t-147-api-detail`; `phungrk/tohong-front` · `t-147-drawer`. Vùng: `planner/admin/vendor-enrich`.
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret, INV-002, INV-003), `planner/` (inv-001…006; **inv-005 Worker khởi động trong workerd** — spec giữ xanh, eval #5), `planner/admin/vendor-enrich/` (inv-001 phân hoạch báo cáo, inv-002 maps-link, inv-003 báo cáo commit bằng đúng báo cáo sinh lại, inv-004, inv-005 workflow đưa báo cáo vào cùng commit). Spec **không vi phạm**: chỉ thêm khoá vào báo cáo (phân hoạch giữ nguyên), `regen-pool-styles.sh` sinh lại báo cáo nên inv-003 xanh sau bước tạo pool, không đụng workflow, không ghi review/override. Không đề nghị đổi bất biến nào.
- Kiến trúc / design system: admin hiện có (`adm-*` trong `src/admin/admin.css`, `useLoad`, `ErrorNote`, `adminErrMsg`); tiền lệ drawer kéo giãn: `tohong-hq-dashboard/index.html` (T-100: min = mặc định, max = 90% khung nhìn, ≤ 480px phủ kín không kéo, localStorage, Esc, `role=separator`); route admin theo mẫu `handleVendorEnrich`; đọc lớp admin bằng `loadOverlay(env,{force:true})`.
- Không chạm: payment, auth (chỉ dùng `isCapu`, `requirePlatformAdmin` có sẵn), schema DB, dữ liệu cặp đôi, `vendorPool.generated.js`, `vendor_overrides.json` (chỉ đọc), `manual_overrides.json`, `decisions/`, `conversations/`. Không gọi Google từ bất kỳ đoạn mã nào của việc này.
- Bậc lưới lọc đề xuất: **B** (Chief of Staff giao B) — chỉ đọc, không ghi R2/Git, không đổi luật quyền, không chạm ranh giới cứng. Nếu adversary cho rằng route mới chạm ranh giới "dữ liệu người dùng/auth" thì nâng C theo luật chung.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; repo tìm bằng `TOHONG_REPO` / `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO`, rồi `../tohong`, `../tohong-back`, `../tohong-front`. Mỗi tiêu chí đúng một eval. Hiện đỏ trên `main` (chưa có code) là đúng, trừ #5 xanh sẵn (khoá ngưỡng kích thước và INV-005; sẽ đỏ nếu code làm phình Worker).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Danh mục `pool-input-fields.json` đúng dạng, không `contact`, và khớp **hai chiều** với những gì `clean_style_tags.py`, `build_pool.py`, `generate-vendor-pool.js` (cả `--styles-only --prune --photos-for`) thật sự đọc, đo bằng đổi từng trường rồi so đầu ra trên dữ liệu thật; `manual_overrides.json` và `enrich-report.json` không bị bước nào đọc | `cd /home/user/tohong-hq && python3 -I eval/T-147/check_1_danh_muc_thuoc_tinh_pool.py` |
| 2 | Báo cáo enrich mang `pool_catalog` (= danh mục) và `pool_input` đúng quy tắc cho cả 870 dòng, cắt chuỗi dài, không liên hệ, tất định, mạng bị chặn, không đổi byte dữ liệu; `regen-pool-styles.sh` giữ báo cáo tươi | `cd /home/user/tohong-hq && python3 -I eval/T-147/check_2_bao_cao_pool_input.py` |
| 3 | `GET …/<id>/detail` trả đúng khoá và nội dung (vendor trong pool, tạm đóng, unverified, bị ẩn bởi lớp R2, bị gỡ, không rõ lý do, ảnh Google sót, thiếu nguồn), 404/400/405, chỉ đọc, không lộ liên hệ, danh sách không phình, route công khai không lộ nguồn | `cd /home/user/tohong-hq && bash eval/T-147/check_3_api_chi_tiet.sh` |
| 4 | Chỉ Capu (10 kiểu người gọi × 5 đường) nhận 200; mọi người khác 403 `forbidden` và không ghi gì, kể cả id không có | `cd /home/user/tohong-hq && bash eval/T-147/check_4_quyen_chi_tiet.sh` |
| 5 | `worker.js` nén ≤ 1.000.000 byte, báo cáo nhúng ≤ 2.500.000 byte, INV-005 xanh | `cd /home/user/tohong-hq && python3 -I eval/T-147/check_5_bundle_worker.py` |
| 6 | Drawer: bấm dòng mở bên phải, nội dung lấy từ API (kể cả trường lạ), kéo giãn min/max + nhớ độ rộng, Esc/nút Đóng + tiêu điểm, 390px phủ kín, vendor ngoài pool/ẩn/thiếu nguồn/403/404, Approve và Sửa thủ công không hỏng, không request ra ngoài | `cd /home/user/tohong-hq && bash eval/T-147/check_6_ui_drawer.sh` |

Mỗi `.sh` chỉ bọc `.mjs`/`.cjs` tương ứng (`cd` vào repo qua `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO`). Eval đo theo nhãn người dùng thấy, hợp đồng API và hành vi thực nghiệm; không bám tên hàm hay class. #1 và #2 mất ~1–2 phút (chạy lại các bước sinh pool nhiều lần trên bản sao tạm).
Đã chạy thử trên bản dựng thử (không giao): trên `main` thật #1, #2, #3, #4, #6 đỏ (FAIL, không ERROR), #5 xanh; trên bản dựng thử cả 6 xanh. Đã thử phá để chắc eval phân biệt: #1 đỏ khi generator đọc thêm `geo_confidence` (báo "bước sinh pool đọc `geo_confidence`… danh mục không có") và khi danh mục thêm `flags` ("mục thừa"); #6 đỏ khi không nhớ độ rộng và khi bấm Approve cũng mở drawer. Bản dựng thử cũng cho thấy một nút "Xem chi tiết" thêm vào dòng làm đỏ T-124 check_8 (dòng đã duyệt tay phải không có nút): vì vậy hợp đồng cấm thêm nút vào dòng. Ghi chú: T-124 `check_8_ui_bang.cjs` đã đỏ sẵn trên `tohong-front` main trước T-147 (một lỗi ở bước cuối "bước thao tác không thực hiện được"), dùng làm mốc so sánh: bản dựng thử đỏ đúng lỗi đó, không thêm lỗi.

## Bất biến đề xuất (tầng 2)
- **Danh mục thuộc tính pool khớp mã sinh pool** (bản nháp chạy được: `eval/T-147/bat-bien-cho-merge/inv-001-danh-muc-thuoc-tinh-pool.py`, đã chạy: "chưa áp dụng" trên `main`, xanh trên bản dựng thử). Mọi trường mà ba bước sinh pool đọc có mục trong `tools/scraper/pool-input-fields.json`, không mục thừa, `manual_overrides.json`/`enrich-report.json` không được đọc, không có `contact`. Lý do: Capu đọc drawer để tin vào "những gì tạo ra pool"; generator đổi mà danh mục không đổi thì drawer sai mà không ai thấy. Cần `eval/T-147/lib/pool_reads.py` ở lại trong bể (Chief of Staff chuyển sang `eval/lib/` khi đưa vào).
- Không đề xuất thêm: "chỉ Capu" khoá bởi eval #4; kích thước Worker khoá bởi eval #5 (đề nghị Spec critic cân nhắc đưa ngưỡng nén ≤ 1.000.000 vào INV-005 hoặc bất biến cấp `planner/`).

## Không làm
- Sửa/ghi bất cứ gì từ drawer: không chỉnh giá, ẩn, duyệt; Approve / Sửa thủ công giữ nguyên T-124.
- Gọi Google (Places, Maps, Photos) từ drawer, back hay bước sinh báo cáo.
- Hiện hay nhúng liên hệ của vendor (điện thoại, website, facebook) hoặc `contact` của lớp admin; sửa `marry.address` dính chữ liên hệ (việc riêng).
- Vendor đã nằm ở `removed_vendors.json` (10) không có dòng trong bảng nên không xem được; muốn xem cần một tab riêng (việc sau).
- Đổi luật sinh pool, danh sách hạng mục matcher, hằng số của generator; đổi `vendorPool.generated.js`.
- Nhúng thêm trường ngoài danh mục (vd vĩ độ/kinh độ, `flags`, `verification_notes`) vào báo cáo: chỉ khi generator đọc chúng.
- Nới ngưỡng kích thước Worker; thêm `nodejs_compat`.
- Phân trang hay tìm kiếm trong drawer; xuất file; thông báo.

## Câu hỏi mở
**Admin không phải Capu có được mở drawer không?** Spec hiểu "Chỉ admin (Clerk + CAPU_USER_IDS)" là chỉ Capu: user id phải nằm trong cả `ADMIN_USER_IDS` lẫn `CAPU_USER_IDS`, còn admin khác vẫn xem bảng nhưng drawer báo "Chỉ Capu xem được chi tiết này". **Mặc định nếu không trả lời: chỉ Capu.** Nếu Capu chọn "mọi admin": bỏ kiểm `isCapu` ở route chi tiết (đổi một dòng ở back), bỏ 3 dòng người gọi "admin không phải Capu" trong eval #4 và chữ thông báo 403 ở drawer; không đổi gì khác.
