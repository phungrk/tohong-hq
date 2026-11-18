# Spec T-211: sua-tay-dia-chi-sdt-vendor

> v1 · Spec Writer (product) · 2026-11-19 · **bậc B** (xem "Bậc") · vùng `planner/admin` · chạm tohong-back và tohong-front (không chạm tohong).
> **Đọc trước (phát hiện làm đổi cách hiểu brief):** brief nói "cặp đôi thấy giá trị mới ở chi tiết vendor, thẻ, chat và luồng kết nối". Đo trên mã hiện tại: **không có bề mặt nào của cặp đôi đang hiện địa chỉ hay SĐT vendor**. Pool (`lib/vendorPool.generated.js`, 867 vendor) không có trường `address`/`phone`, chỉ có `city`; `lib/matchFormatter.js` chủ ý không đưa liên hệ vendor vào prompt (FR-036); `contact` của overlay "KHÔNG bao giờ đưa ra" (`applyToVendor`); hộp kết nối của cặp đôi chỉ trả `{id, vendor_id, trạng thái, created_at}`. FR-036 (`tohong/specs/002-admin-phase1/spec.md:276`): "Liên hệ vendor do admin thêm KHÔNG hiển thị cho cặp đôi; chỉ dùng cho admin". Spec này theo **mặc định an toàn**: địa chỉ + SĐT là dữ liệu **chỉ admin thấy** (chi tiết vendor admin, hộp kết nối admin). Cho cặp đôi thấy địa chỉ/SĐT là một việc khác (đổi chính sách FR-036, "Hỏi trước"): xem Câu hỏi mở.

## Ý định
Capu (2026-11-19): "tạo việc sửa tay địa chỉ và số điện thoại". Sau khi bàn: admin tự mở Google Maps, thấy địa chỉ/SĐT khác dữ liệu đang có thì **gõ sửa tay**; hệ thống **không** tự lấy từ trang Maps (điều khoản Google). Mục đích vận hành: Tơ Hồng gọi/đến đúng vendor khi xử lý yêu cầu kết nối (Tơ Hồng làm cầu nối, cặp đôi không nhận liên hệ vendor trực tiếp).

## Bằng chứng
Đo ngày 2026-11-19 trên `/home/user/tohong-back` và `/home/user/tohong-front` (đọc, không sửa). Tự tin cao (~90%).
- `lib/vendorOverlay.js`: `EDITABLE_LIMITS` (name_max, description_max, styles_max, photos_*, capacity_*); `POOL_FIELDS = [name, description, styles, photos, capacity]`; trường cũ `contact = {phone, zalo, website}` đã sửa được từ trước (tab Dữ liệu vendor, ô "Số điện thoại" `aria-label`), kiểm tối thiểu: `cleanStr(…, 200)`, **không kiểm định dạng**, không chuẩn hoá; tham số không phải chuỗi bị **lặng lẽ coi là rỗng**. `contact` thay nguyên khối (PUT `contact` không có `phone` = xoá số). `diffChanges` ghi lịch sử `contact` chỉ `{changed:true}` (quyết định T-152 4.4, eval `eval/T-152/check_3_lich_su_va_etag.mjs` dòng 46 khoá "không lộ số").
- `api/admin.js`: `putOverride` ghi một dòng Nhật ký `vendor.override` với `before/after` **cả bản ghi** (đã gồm `contact`); `deleteOverride` ghi `vendor.override_clear`. `connectView` đã trả `vendor.contact = o?.contact` (SĐT admin nhập đã hiện ở hộp kết nối admin, chưa kiểm định dạng) và chưa có địa chỉ. `vendorDetail` trả `override = userOverride(entry)`, `editable.limits`.
- `src/admin/VendorData.jsx`: nhóm "Liên hệ vendor (chỉ admin thấy)" có ô Số điện thoại / Zalo / Fanpage; mỗi lần "Lưu ghi đè" gửi **cả** `contact` (nên số cũ nhập trước T-211 sẽ được gửi lại mỗi lần lưu). `src/admin/ConnectInbox.jsx`: dòng "Liên hệ vendor" = `fmtContact(vendor.contact)` ("ĐT <số> · Zalo …").
- Ghép vendor chỉ dùng `city` (`normaliseCity` ở `lib/vendorMatcher.js`, `lib/chatMatcher.js`); không có quận/phường nào trong pool. Địa chỉ trong dữ liệu nguồn marry dài tối đa 206 ký tự (870 địa chỉ ở `lib/vendorEnrichReport.generated.js`, chỉ admin thấy ở drawer enrich).
- ADR-127/129: xoá vendor chỉ thêm khoá `deleted*` vào bản ghi overlay; khôi phục gỡ khoá, bản sửa còn; sửa khi đã xoá 409 `vendor_deleted`.
- Bất biến đã đọc: `planner/admin` inv-001..012, `members/inv-001..006`, `vendor-enrich/inv-001..015`, `planner/vendor/inv-001..007`, `planner/vendor/matching`, `_shared`.

## Giả thuyết
Nếu admin sửa được địa chỉ/SĐT sai ngay tại tab Dữ liệu vendor (có kiểm định, lịch sử, bỏ được) thì lần Tơ Hồng liên hệ vendor theo yêu cầu kết nối ít bị trượt vì số/địa chỉ sai, và không cần quy trình PR/pipeline cho việc sửa một số. Chỉ số bảo vệ: địa chỉ/SĐT vendor không bao giờ ra phía cặp đôi (FR-036); không thay đổi ghép vendor; không gọi Google.

## Hành vi (người dùng thấy gì)

### 1. Hai trường và nơi lưu (quyết định, một chỗ duy nhất cho mỗi giá trị)
- **SĐT** = trường `contact.phone` **đã có** (không thêm trường `phone` thứ hai; không có hai nơi lưu SĐT). **Địa chỉ** = trường mới `address` ở cấp bản ghi sửa của vendor, cạnh `name`, `description`, `contact`.
- **Không có "giá trị gốc"**: pool không có địa chỉ/SĐT. "Về giá trị gốc" nghĩa là **không có giá trị** (chưa có). Drawer enrich đọc địa chỉ marry từ báo cáo là việc khác, không đổi.
- Vẫn qua route sẵn có `PUT /api/admin/vendors/<id>/override` (body: `expected_version`, `address`, `contact`), quyền mọi admin (`ADMIN_USER_IDS`); `DELETE …/override` là "Bỏ ghi đè". Không thêm route.
- **Cặp đôi không thấy hai giá trị này ở bất kỳ đâu** (mục 7). Hai giá trị chỉ xuất hiện ở các bề mặt admin liệt kê ở mục 5.

### 2. SĐT: kiểm định và chuẩn hoá (khi `contact.phone` được gửi)
Thứ tự áp dụng, mỗi bước chỉ có một kết quả:
1. Giá trị `null` hoặc chuỗi mà sau bước 2–3 rỗng nghĩa là **không có SĐT** (xoá, mục 4). Mọi kiểu khác chuỗi (số, mảng, đối tượng, boolean) → 400 `invalid_phone` (**đổi so với hiện tại**: trước đây bị lặng lẽ coi là rỗng).
2. Bỏ ký tự điều khiển hướng chữ và ký tự không hình: U+200B–200F, U+202A–202E, U+2060, U+2066–2069, U+061C, U+FEFF, U+00AD; đổi khoảng trắng Unicode (gồm U+00A0, U+202F) thành dấu cách; **trim** hai đầu (kể cả xuống dòng cuối).
3. Dài tối đa **40** ký tự sau bước 2, nếu hơn → `invalid_phone`.
4. Chỉ được chứa: chữ số ASCII `0-9`, dấu cách, `.`, `-`, `(`, `)`, và **một** dấu `+` ở đầu. Bất kỳ ký tự nào khác (chữ cái, `/`, `,`, `;`, xuống dòng giữa chuỗi, chữ số toàn-góc, nhiều số) → `invalid_phone`. **Chỉ một số** mỗi lần (nhiều số cách bằng `/`, `,`, `;` bị từ chối).
5. Lấy mọi chữ số ra thành dãy `D`. Nếu có `+` mà `D` không bắt đầu bằng `84` → `invalid_phone`. Nếu `D` bắt đầu bằng `0084` → thay bằng `0`; nếu bắt đầu bằng `84` → thay `84` bằng `0`.
6. Hợp lệ khi `D` khớp **một** trong: di động `^0[35789]\d{8}$` (10 chữ số); cố định `^02\d{9}$` (11 chữ số); tổng đài `^1[89]00\d{4,6}$` (8–10 chữ số). Khác → `invalid_phone`.
7. **Giá trị lưu và hiển thị = `D` (chỉ chữ số)**, vd `+84 912 345 678` → `0912345678`; `028 3822 2222` → `02838222222`; `1900 1234` → `19001234`.
- **Số cũ** (nhập trước T-211, chuỗi tự do) đã nằm trong dữ liệu: nếu PUT gửi lại **đúng chuỗi đã lưu** thì giữ nguyên, **không kiểm, không chuẩn hoá, không 400** (biểu mẫu luôn gửi lại cả `contact`, nên đổi zalo không bị chặn bởi số cũ). Gửi chuỗi **khác** chuỗi đã lưu thì áp đủ bước 1–7.
- `zalo`, `website`: **không đổi** (luật cũ, ≤ 200 ký tự, không kiểm định dạng; sửa website là ngoài phạm vi).
- Lỗi: HTTP 400 `{"error":"invalid_phone"}`, không ghi gì (không R2, không phiên bản, không lịch sử, không Nhật ký).

### 3. Địa chỉ: kiểm định và chuẩn hoá (khi `address` được gửi)
1. `null` nghĩa là xoá (mục 4). Mọi kiểu khác chuỗi → 400 `invalid_address`.
2. Chuẩn hoá NFC. Bỏ ký tự hướng chữ/không hình như mục 2 bước 2. Mỗi đoạn ký tự điều khiển (U+0000–001F gồm `\n \r \t`, U+007F–009F, U+2028, U+2029) hoặc khoảng trắng Unicode (`\p{Zs}`) thay bằng **một dấu cách**; gộp dấu cách liên tiếp thành một; trim. (Khác `name` ở chỗ không từ chối xuống dòng: địa chỉ dán từ Maps thường có xuống dòng; giống `description`.)
3. Rỗng sau bước 2 → **xoá** (mục 4). Chỉ gồm ký tự không hình còn sót (vd U+3164) → `invalid_address`.
4. Độ dài tính theo **code point** (không theo UTF-16): **5..250**. Ngoài khoảng → `invalid_address`. Hằng số công bố ở `editable.limits.address_min = 5`, `address_max = 250` (cạnh `name_max`…).
5. Phải có ít nhất một chữ cái hoặc chữ số (`\p{L}` hoặc `\p{N}`); chuỗi toàn dấu câu → `invalid_address`.
6. Lưu nguyên văn phần còn lại: **không** bỏ thẻ HTML, không viết hoa/thường lại, không tách quận/phường (giao diện hiển thị dạng chữ, không HTML).
- Lỗi: 400 `{"error":"invalid_address"}`, không ghi gì.

### 4. Giá trị trống, xoá từng trường, Bỏ ghi đè
- **Trống = xoá trường, không lỗi.** Địa chỉ: `address` là `null`, `""`, chỉ khoảng trắng hoặc chỉ ký tự bị bỏ ở bước 2 → xoá địa chỉ. SĐT: `contact` không có `phone`, hoặc `phone` là `null`/`""`/khoảng trắng → xoá SĐT, **zalo/website/địa chỉ còn nguyên**. Xoá địa chỉ không đụng SĐT và ngược lại.
- Xoá khi chưa có giá trị, hoặc lưu **đúng** giá trị đang có (kể cả viết khác khoảng trắng / dấu cách trong số) = **không làm gì**: 200, không ghi R2, không tăng `version`, không thêm lịch sử, không thêm Nhật ký (luật "không đổi gì" của T-152).
- Sau mọi thay đổi, nếu bản sửa của vendor không còn nội dung nào thì không còn bản ghi (`override: null`, `version: 0`), như luật hiện có.
- **Bỏ ghi đè** (nút "Bỏ ghi đè" = `DELETE …/override`, luật cũ **cả vendor**, không theo trường): xoá **mọi** bản sửa của vendor, gồm địa chỉ và SĐT; về "chưa có". Pool y nguyên (không có trường `address`/`phone`). DELETE lần hai: 404 `override_not_found`. Xoá theo trường = để trống rồi Lưu (hoặc PUT `null`); biểu mẫu không có nút "Bỏ" riêng từng trường.

### 5. Admin thấy ở đâu
1. **Chi tiết vendor admin** `GET /api/admin/vendors/<id>`: `override.address` (chuỗi, vắng khi không có) và `override.contact.phone`. `edited_fields` **không đổi** (không thêm địa chỉ/SĐT).
2. **Tab Dữ liệu vendor** (`VendorData`): trong nhóm "Liên hệ vendor (chỉ admin thấy)" có ô tên "Địa chỉ" (`aria-label` đúng "Địa chỉ") cạnh ô "Số điện thoại". "Lưu ghi đè" gửi `address` và `contact`. Sau khi lưu, hai ô hiện **giá trị đã chuẩn hoá** do back trả (phải phản ánh vào biểu mẫu). Lỗi 400: hiện đúng chữ **"Số điện thoại không hợp lệ"** (kèm gợi ý một số, vd "0912 345 678 hoặc +84 912 345 678") hoặc **"Địa chỉ không hợp lệ"** (kèm "5 đến 250 ký tự"); biểu mẫu còn nguyên giá trị người gõ; không gọi lại. Nhãn nhóm nói rõ không hiện cho cặp đôi (giữ chữ "chỉ admin thấy").
3. **Hộp kết nối admin** (danh sách và chi tiết một yêu cầu): `vendor.address` (chuỗi hoặc `null`; **khoá luôn có**) và `vendor.contact` (như cũ, nay `phone` ở dạng chuẩn hoá) lấy **trực tiếp từ bản sửa hiện tại** của vendor, nên đổi/xoá sau lúc tạo yêu cầu thì hộp theo ngay, kể cả yêu cầu cũ. Chi tiết yêu cầu có thêm dòng **"Địa chỉ vendor"** (hiện `—` khi không có) ngay trên/dưới "Liên hệ vendor" (hiện `ĐT 0912345678`). Không chép địa chỉ/SĐT vào tài liệu yêu cầu kết nối (dữ liệu người dùng, ADR-127).
4. **Danh sách vendor admin**: hàng vendor có bản sửa địa chỉ/SĐT là `overridden: true`; `has_contact` như cũ.
5. **Nhật ký** (mục 6). Không có thêm màn nào.
- Vendor đã Xoá: hộp kết nối vẫn đọc được địa chỉ/SĐT đã lưu để Tơ Hồng biết nó là vendor nào; không sửa được (mục 8).

### 6. Lịch sử sửa và Nhật ký
- **Lịch sử sửa** (`history` ở `GET /api/admin/vendors/<id>`): thêm cho mỗi mục `changes.address = {before, after}` và `changes.phone = {before, after}` khi hai giá trị đó đổi (`null` khi không có; **giá trị hiệu lực**, SĐT ở dạng chuẩn hoá). Mục `clear` (Bỏ ghi đè) liệt kê `address`/`phone` về `null`. Khi **zalo hoặc website** đổi, mục có `changes.contact = {changed:true}` và **không** chứa zalo/website; khi chỉ SĐT đổi, mục có `changes.phone` và **không** có `changes.contact`. Không đổi/bị từ chối: không thêm mục. Trần 20 mục, mới nhất trước, như cũ.
- **Nhật ký** (`/api/admin/audit`): hành vi cũ giữ: mỗi lần sửa thành công đúng một dòng `vendor.override` (`before`/`after` là bản ghi sửa cả vendor, nên có `address` và `contact.phone` trước/sau), `vendor.override_clear` cho Bỏ ghi đè (`before` có giá trị cũ, `after: null`). Không dòng nào cho lần không đổi gì hoặc bị từ chối.
- **Đổi so với T-152** (nói thẳng): T-152 4.4 cấm số điện thoại vào lịch sử (`changes.contact = {changed:true}`, eval chặn chuỗi `0909000111`). T-211 **thay** điều đó **chỉ cho SĐT**; zalo/website giữ luật cũ. Lý do: brief yêu cầu "lịch sử sửa ghi trước/sau"; Nhật ký đã chứa số này từ trước và cũng chỉ admin đọc. Eval T-152 `check_3` dòng 46 phải sửa (xem "Eval cũ bị đổi").

### 7. Cặp đôi không thấy; không đổi ghép
- Địa chỉ/SĐT vendor do admin nhập **không xuất hiện** trong bất kỳ phản hồi hoặc văn bản nào ra phía cặp đôi: `GET /api/vendors/<id>`, `GET /api/vendors/match` (theo id, theo hạng mục), `POST /api/vendors/status`, `GET /api/vendors/categories`, ứng viên chat (`chatMatch`), khối `[VENDOR CANDIDATES]` của prompt AI, luồng kết nối của cặp đôi (tạo yêu cầu, xem danh sách yêu cầu của mình), kể cả khi vendor đang Ẩn. `applyToVendor` **không** được mang `address`/`phone`/`contact` ra (không thêm `address` vào tập trường áp lên vendor).
- Địa chỉ **không** ảnh hưởng ghép: `city`, hạng mục, điểm, thứ tự, đếm, ứng viên chat của mọi vendor **y hệt từng byte** trước/sau khi sửa địa chỉ, kể cả khi địa chỉ nói một tỉnh khác `city` của vendor. Không tự suy ra quận/phường/thành phố từ địa chỉ; không sửa `city`; không có "nhất quán quận" (quyết định: **không** làm trong T-211, vì ghép chưa dùng quận).

### 8. Giao thoa Ẩn / Xoá (T-203) và đồng bộ pool
- **Ẩn**: sửa địa chỉ/SĐT khi vendor đang Ẩn được (200); cờ Ẩn và lý do **không đổi**. Ẩn không đổi, không mất địa chỉ/SĐT.
- **Xoá**: PUT sửa địa chỉ hoặc SĐT khi đã Xoá → 409 `vendor_deleted` (luật hiện có), không ghi gì. Xoá rồi Khôi phục: địa chỉ + SĐT + cờ Ẩn + `history` **y nguyên** (xoá/khôi phục chỉ thêm/gỡ khoá `deleted*`, ADR-129, inv-011). Sau Khôi phục sửa lại được.
- **Pool sinh lại**: bản sửa nằm ở tài liệu overlay R2 riêng, tách khỏi `vendorPool.generated.js`; chạy lại pipeline/`sync-vendor-pool` **không** xoá, không đổi địa chỉ/SĐT sửa tay. Bản sửa còn khi (a) isolate mới đọc lại từ R2, (b) pool đổi tên/mô tả/ảnh của vendor, (c) vendor rời pool (thành "mồ côi", chi tiết admin 200 với `in_pool: false`, bản sửa còn). Bản sửa luôn thắng giá trị cùng tên nếu pool sau này có (không có `source_changed` cho hai trường này; nằm ngoài phạm vi, xem "Không làm").
- **Ghi đồng thời**: cơ chế `mutate` sẵn có: hai vendor khác nhau ghi đồng thời đều còn; cùng vendor với `expected_version` cũ → 409 `version_conflict`, không ghi.

### 9. Không gọi Google, không chạm dữ liệu khác
Mọi thao tác trên **không gọi mạng ngoài** (không Maps/Places/Geocoding; eval chặn `fetch`). Chỉ ghi: bản ghi sửa của vendor và dòng Nhật ký. Không ghi dữ liệu hồ sơ/hội thoại/ngân sách/yêu cầu kết nối của cặp đôi; không tạo khoá R2 lạ. Không thêm secret, không đổi workflow.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` (nhánh `t-211-sua-tay-dia-chi-sdt-back`, **merge trước**: `lib/vendorOverlay.js` — `EDITABLE_LIMITS` thêm `address_min/address_max`, bộ làm sạch địa chỉ/SĐT, `diffChanges`/`view`; `api/admin.js` — `connectView` thêm `vendor.address`; test trong `npm test`) và `phungrk/tohong-front` (nhánh `t-211-sua-tay-dia-chi-sdt-front`, **merge sau**: `src/admin/VendorData.jsx`, `src/admin/ConnectInbox.jsx`, `src/admin/format.js` thông điệp lỗi). Vùng `planner/admin`.
- Bất biến đã đọc: `eval/invariants/_shared/` và `planner/admin/**` (inv-001..012; vendor-enrich inv-001..015; members inv-001..006), `planner/vendor/**` (inv-001..007, matching, images). Spec này **không vi phạm** INV nào. Chú ý: `planner/vendor` inv-007 (vendor bị gỡ không ra cặp đôi) và `planner/admin` inv-010/011/012 phải còn xanh; `vendor-enrich` inv-007 (báo cáo enrich không mang liên hệ/địa chỉ) không bị đụng (T-211 không sửa báo cáo).
- Kiến trúc: tái dùng route PUT/DELETE override, `mutate` (etag), `appendAudit`; bỏ ký tự ẩn/hướng chữ cùng tập như `name`/`description` (`BIDI`, `INVISIBLE_ONLY`). Front đếm độ dài theo **code point** (nợ ghi nhận ở ADR-129: front đếm UTF-16, lệch với emoji).
- Không chạm: payment, auth (chỉ dùng `requirePlatformAdmin` sẵn có), schema DB (R2 JSON hiện có thêm một khoá `address` tuỳ chọn), **tài liệu yêu cầu kết nối của cặp đôi**, hồ sơ/hội thoại/ngân sách, pool sinh ra, báo cáo enrich, workflow, `tohong`.
- **Bậc lưới lọc: B.** Lý do: dữ liệu liên hệ **doanh nghiệp** (vendor), chỉ admin đọc/ghi, qua route admin có sẵn, không payment/auth/DB schema/dữ liệu người dùng, đảo ngược được (Bỏ ghi đè). **Sẽ thành C nếu** Capu chọn cho cặp đôi thấy địa chỉ/SĐT (đổi chính sách FR-036, thành bề mặt người dùng thật chứa dữ liệu liên hệ người thật hoặc làm lộ liên hệ vendor) hoặc nếu cài đặt chép địa chỉ/SĐT vào yêu cầu kết nối (đã loại, ADR-127). Hai điều kiện đó không có trong spec này.

## Tiêu chí chấp nhận và eval
Dùng chung khung `eval/T-203/lib/` (Worker thật + R2 giả, chặn mạng; giữ thư mục này, ADR-129). Chạy từ gốc `tohong-hq` (repo ngoài: `TOHONG_BACK_REPO`, `TOHONG_FRONT_REPO`).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | SĐT: 26 dạng hợp lệ (di động, cố định, tổng đài, `+84`/`84`/`0084`, dấu `. - ( )`, ký tự ẩn/NBSP/hướng chữ) → 200 và lưu đúng chuỗi chỉ-chữ-số; 29 dạng sai (nhiều số, sai đầu số, sai độ dài, chữ, kiểu không phải chuỗi, >40 ký tự) → 400 `invalid_phone` không ghi gì; số cũ gửi lại nguyên chuỗi không bị 400, đổi số cũ thì phải hợp lệ | `node eval/T-211/check_1_sdt.mjs` |
| 2 | Địa chỉ: chuẩn hoá (NFC, gộp khoảng trắng/xuống dòng, bỏ ký tự ẩn/hướng chữ, giữ nguyên HTML), 5..250 code point (emoji tính 1), toàn dấu câu/ký tự ẩn/kiểu lạ → 400 `invalid_address` không ghi gì; `editable.limits.address_min/max` | `node eval/T-211/check_2_dia_chi.mjs` |
| 3 | Trống = xoá (`null`, `""`, khoảng trắng, ký tự ẩn); xoá từng trường không đụng trường khác (zalo/website/địa chỉ/SĐT); xoá hết thì không còn bản ghi; lưu y giá trị cũ không ghi gì; Bỏ ghi đè xoá cả hai, pool y nguyên, lần hai 404 | `node eval/T-211/check_3_xoa_trong_bo_ghi_de.mjs` |
| 4 | Admin thấy địa chỉ + SĐT ở chi tiết vendor, danh sách vendor (`overridden`), hộp kết nối (danh sách + chi tiết, kể cả yêu cầu có trước lúc sửa); sửa lại/xoá thì hộp theo ngay; liên hệ của cặp đôi không bị lẫn | `node eval/T-211/check_4_admin_thay_hop_ket_noi.mjs` |
| 5 | Cặp đôi không thấy địa chỉ/SĐT/zalo/website của admin ở 5 API vendor, `chatMatch`, khối prompt AI, `applyToVendor`, luồng kết nối (tạo + xem danh sách), kể cả vendor Ẩn; đối chứng phía admin có thấy | `node eval/T-211/check_5_cap_doi_khong_thay.mjs` |
| 6 | Sửa địa chỉ (kể cả nói tỉnh khác) không đổi từng byte kết quả ghép/đếm/trạng thái/chat và `city` | `node eval/T-211/check_6_khong_doi_ghep.mjs` |
| 7 | Lịch sử: `changes.address`/`changes.phone` trước/sau; zalo/website chỉ `contact.changed`; clear liệt kê về null; Nhật ký `vendor.override`/`override_clear` có trước/sau; không đổi/bị từ chối không ghi dòng nào | `node eval/T-211/check_7_lich_su_nhat_ky.mjs` |
| 8 | Bản sửa sống sót qua isolate mới, pool đổi nội dung, vendor rời pool và quay lại; ghi đồng thời hai vendor đều còn; cùng vendor sai phiên bản 409 | `node eval/T-211/check_8_song_sot_dong_bo_pool.mjs` |
| 9 | Giao thoa T-203: sửa được khi Ẩn (cờ Ẩn giữ); đã Xoá thì 409 `vendor_deleted`; hộp kết nối vendor đã Xoá vẫn đọc địa chỉ/SĐT; Xoá rồi Khôi phục y nguyên bản sửa + lịch sử | `node eval/T-211/check_9_giao_thoa_an_xoa.mjs` |
| 10 | Chỉ admin: không token / token rác / user thường / `ADMIN_USER_IDS` rỗng / dev bypass tắt / chỉ-Capu → 403 `forbidden` ở PUT, GET, DELETE, không ghi; admin thường (không phải Capu) 200 | `node eval/T-211/check_10_quyen.mjs` |
| 11 | Giao diện tab Dữ liệu vendor: ô "Địa chỉ" + "Số điện thoại" (chữ "chỉ admin thấy"); lỗi hiện "Số điện thoại không hợp lệ" / "Địa chỉ không hợp lệ" và giữ giá trị gõ; lưu xong ô hiện giá trị đã chuẩn hoá; để trống + Lưu xoá; Bỏ ghi đè xoá cả hai | `bash eval/T-211/check_11_giao_dien_sua.sh` |
| 12 | Chỉ ghi bản ghi sửa vendor + Nhật ký (dữ liệu cặp đôi nguyên từng byte, không khoá R2 lạ) và **không gọi mạng ngoài** (không Google) | `node eval/T-211/check_12_pham_vi_ghi_va_khong_goi_ngoai.mjs` |
| 13 | Giao diện hộp kết nối: dòng "Địa chỉ vendor" + "Liên hệ vendor: ĐT 0912345678" đúng giá trị đã sửa; "Liên hệ đã gửi" của cặp đôi không lẫn; xoá thì hiện `—` | `bash eval/T-211/check_13_giao_dien_hop_ket_noi.sh` |

Mọi eval ĐỎ trên `main` hiện tại (route trả 400 `field_not_editable` cho `address`; giao diện chưa có ô) và không ERROR. Mỗi eval tự kết thúc bằng kiểm "không request ra ngoài".

## Eval cũ bị đổi (cần ADR của Chief of Staff; tiền lệ ADR-074, T-152)
Chỉ **một** khẳng định cũ mâu thuẫn: `eval/T-152/check_3_lich_su_va_etag.mjs` dòng 46: sau khi sửa `contact.phone = "0909000111"` đòi `changes.contact.changed === true` **và** lịch sử **không** chứa `0909000111`. T-211 (mục 6) đổi: sửa SĐT ghi `changes.phone` (có số), không ghi `changes.contact`. Sửa: đổi lệnh ở dòng 46 sang sửa `contact.zalo` (đòi `changes.contact.changed === true` và lịch sử không chứa giá trị zalo). Script áp dụng: `python3 -I eval/T-211/ap-dung-sua-check3-t152.py` (idempotent, chạy **sau** ADR, **trước** khi giao Engineering). Mọi eval/bất biến khác đã kiểm không bị đụng (T-152 `edited_fields` không đổi; `has_contact` không đổi; inv-011 không đổi).

## Bất biến đề xuất (tầng 2)
1. **`planner/vendor`: liên hệ và địa chỉ vendor do admin nhập không ra phía cặp đôi.** Với vendor có `address` + `contact.{phone,zalo,website}` do admin nhập: không có chuỗi nào trong đó xuất hiện ở các phản hồi/prompt phía cặp đôi (danh sách ở Hành vi 7). Gốc: `eval/T-211/check_5_cap_doi_khong_thay.mjs` (rút nguyên; dạng dữ liệu sentinel). Khoá FR-036 bằng máy; trước đây chỉ có chú thích mã.
2. **`planner/vendor/matching`: sửa dữ liệu liên hệ/địa chỉ của vendor không đổi kết quả ghép.** Gốc: `check_6_khong_doi_ghep.mjs`. Đề nghị Chief ghép với bất biến cho mọi trường "chỉ hiển thị" sau này.
3. **`planner/admin`: bản sửa tay của vendor sống sót qua pool sinh lại** (đọc lại R2, đổi nội dung vendor ở nguồn, vendor rời pool). Gốc: phần (a)(b) của `check_8_song_sot_dong_bo_pool.mjs`; viết lại tổng quát cho mọi trường sửa tay hiện có (name, description, styles, photos, capacity, giá, liên hệ, địa chỉ).
Spec-critic chọn bản rút; thư mục `eval/T-203/lib/` phải giữ vì các bất biến này dùng nó.

## Không làm
- Tự động lấy địa chỉ/SĐT từ Google Maps/Places/Geocoding; mở link Maps từ hệ thống; nút "kiểm tra với Google".
- Cho **cặp đôi** thấy địa chỉ hoặc SĐT vendor (thẻ, chi tiết, chat, kết nối): xem Câu hỏi mở.
- Sửa email, website (zalo/website giữ nguyên luật cũ); nhiều SĐT cho một vendor; số máy lẻ/"ext"; sửa hàng loạt/nhập CSV.
- Trường `district`/`ward`/toạ độ; kiểm tra địa chỉ có nằm trong `city`; sửa `city`; đổi ghép theo quận.
- Ghi địa chỉ/SĐT ngược vào nguồn (`tohong`, `vendors.json`, `manual_overrides.json`), vào `vendorPool.generated.js`, vào tài liệu yêu cầu kết nối, hoặc báo cáo enrich; `source_changed`/`_base` cho hai trường này (pool chưa có giá trị để so).
- Nút "Bỏ" riêng từng trường (xoá từng trường = để trống + Lưu); hoàn tác từng mục lịch sử.
- Đổi quyền (mọi admin sửa được, như T-152), đổi `requirePlatformAdmin`, `isCapu`.

## Câu hỏi mở
Một: Capu có muốn cặp đôi nhìn thấy **địa chỉ** (và/hoặc SĐT) vendor không? Mặc định của spec: **không** (theo FR-036, Tơ Hồng làm cầu nối; brief gốc nói "cặp đôi thấy" nhưng hiện chưa có chỗ nào hiện, nên đây là tính năng mới chứ không phải sửa giá trị). Nếu có, đó là việc riêng ở bậc C ("Hỏi trước", đổi chính sách liên hệ) cần thêm bề mặt hiển thị; spec này không chặn nó (địa chỉ/SĐT đã lưu sẵn, đã chuẩn hoá).
