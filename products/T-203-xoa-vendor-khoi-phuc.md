# Spec T-203: Xoá vendor ở admin (gỡ khỏi pool, khôi phục được)

> v2 (spec rework vòng 1, trả lại D1/D2/D3, xem "Đã sửa ở v2") · Spec Writer (product) · 2026-11-18 · bậc đề xuất **B** (xem "Bậc") · vùng `planner/admin` (chạm cả `planner/vendor` ở phía cặp đôi) · chạm tohong-back và tohong-front (không chạm tohong, không chạm schema dữ liệu người dùng).

## Ý định
Capu (`board/T-203.md`, 2026-11-18): "thêm option delete dữ liệu vendor ở màn hình admin". Capu chọn **"Gỡ hẳn, khôi phục được"**: vendor biến khỏi pool/cặp đôi và khỏi danh sách admin thường, bản ghi giữ lại trong danh sách "Đã xoá" kèm lý do, có nút khôi phục. **Không xoá vĩnh viễn.**

## Bằng chứng
Đọc mã ngày 2026-11-18 (tự tin cao ~90%):
- Admin chỉ có **Ẩn** (`hidden` + `hidden_reason` trong overlay R2 `data/admin/vendor_overrides.json`, `tohong-back/lib/vendorOverlay.js`) và **Bỏ ghi đè** (`DELETE /api/admin/vendors/:id/override`, xoá cả bản sửa lẫn cờ ẩn). Không có "xoá".
- Mọi bề mặt cặp đôi đều đọc cờ ẩn qua `isHidden`: `computeMatches`, `getCategoryCounts` (`vendorMatcher.js`), `chatMatcher.js` (ứng viên chat, dùng bởi `contextBuilder.js`), `/api/vendors/status`, `/api/vendors/:id` (`getVendorById` trả `hidden:true`, thẻ đã lưu hiện "Không còn nhận đặt", `Budget.jsx`), tạo yêu cầu kết nối (`connectRequests.js`, `vendor_hidden_at_create`).
- Danh sách admin (`listVendors`) hiện mọi vendor của pool kể cả vendor ẩn (nhãn `hidden` = "Đang ẩn").
- Action enrich `remove` (`EnrichTable.jsx`, review R2 chờ Capu, áp qua export) **không** đổi pool hay overlay; không tác dụng tức thời.
- Hồ sơ / kế hoạch cặp đôi chỉ giữ id + bản chụp vendor; trạng thái "còn nhận đặt" luôn lấy từ `/api/vendors/status` lúc hiển thị, không từ bản chụp.

## Giả thuyết
Nếu thêm Xoá (gỡ khỏi pool + danh sách admin, giữ bản ghi, khôi phục được) thì admin dọn được dữ liệu vendor sai/trùng/đóng cửa mà không sợ mất dữ liệu và không làm lẫn với "Ẩn tạm". Chỉ số bảo vệ: kế hoạch cặp đôi đã lưu vẫn hiển thị bình thường; không byte dữ liệu người dùng nào đổi.

## Hành vi (người dùng thấy gì)

### Xoá khác Ẩn khác enrich "remove"
| | Ẩn (có sẵn) | **Xoá (mới)** | Enrich `remove` (có sẵn) |
| --- | --- | --- | --- |
| Là gì | Cờ tạm trong khung sửa, vẫn sửa được | Gỡ vendor khỏi pool và danh sách admin, giữ bản ghi | Một ĐỀ XUẤT trong bảng enrich, chờ Capu duyệt, áp qua export |
| Cặp đôi thấy | Không (khỏi ghép, chat, đếm hạng mục); thẻ đã lưu hiện "Không còn nhận đặt" | **Như Ẩn, y hệt** | Vẫn thấy bình thường (chưa áp) |
| Danh sách admin mặc định | **Còn**, nhãn "Đang ẩn" | **Không còn**; chỉ ở nhãn "Đã xoá" | Còn |
| Cần lý do | Có | Có, thêm bước xác nhận | Ghi chú tuỳ ý |
| Hoàn tác | Bỏ tích | Nút "Khôi phục vendor" | Rút lại review |
| Nhật ký | `vendor.override` | `vendor.delete` / `vendor.restore` | `vendor_enrich.review` |
| "Lịch sử sửa" của vendor | Có dòng (như mọi lần sửa) | **Không** thêm dòng (xoá/khôi phục chỉ vào Nhật ký) | Không |
| Hộp yêu cầu kết nối (admin) | Báo "đang ẩn" | Báo **riêng** "đã xoá" (không báo "đang ẩn") | Không |
Xoá **không** bật cờ Ẩn và Ẩn **không** thành Xoá. Hai cờ độc lập: vendor có thể vừa Ẩn vừa Xoá.
**Nói thẳng cho người duyệt: với cặp đôi, "Xoá" và "Ẩn" trông y hệt nhau** (cùng biến khỏi ghép/chat/đếm, thẻ đã lưu cùng ghi "Không còn nhận đặt"). Khác biệt chỉ nằm ở phía admin: Xoá rời danh sách mặc định, có nhãn/lý do riêng, có nút Khôi phục, hộp kết nối báo riêng.

### Tình huống 1: admin xoá một vendor
1. Admin mở tab "Dữ liệu vendor" > "Danh sách vendor", chọn một vendor. Trong khung sửa có nút **"Xoá vendor"** (kiểu nguy hiểm, tách khỏi "Lưu ghi đè").
2. Bấm "Xoá vendor" CHƯA làm gì ở back: hiện khung xác nhận có ô **"Lý do xoá"**, nút **"Xác nhận xoá"** (khoá khi lý do trống hoặc toàn khoảng trắng) và nút **"Thôi"**; chữ trong khung nói rõ vendor sẽ bị gỡ khỏi cặp đôi và danh sách này nhưng **khôi phục được**.
3. "Thôi" đóng khung, không gọi API; mở lại thì ô lý do trống.
4. "Xác nhận xoá": đúng một lần gọi xoá. Thành công: thông báo "Đã xoá vendor… khôi phục ở nhãn Đã xoá", danh sách tải lại, vendor biến khỏi danh sách đang xem.
5. Vendor mồ côi (có ghi đè nhưng không còn trong pool, chưa bị xoá) không xoá được (đã vô hình với cặp đôi; dùng "Bỏ ghi đè"). Với vendor mồ côi nút "Xoá vendor" không hiện.

### Tình huống 2: cặp đôi sau khi vendor bị xoá
Giống hệt vendor đang Ẩn, ở mọi bề mặt (mục tiêu: một chỗ "vendor đang bị gỡ", không hai nhánh khác nhau):
- Không có trong ghép vendor (`/api/vendors/match`, kể cả `ids=`), đếm hạng mục (`/api/vendors/categories`), ứng viên chat.
- `POST /api/vendors/status` trả mục cho vendor với `hidden:true` (KHÔNG `null`, vì `null` nghĩa là "không còn trong pool" và hiển thị khác); vẫn có giá hiện hành.
- `GET /api/vendors/:id` trả 200 với `vendor.hidden:true`, `match:null`, còn tên (không 404).
- Hệ quả: hồ sơ/kế hoạch cặp đôi đã lưu vendor này vẫn hiển thị, thẻ ghi "Không còn nhận đặt". **Không sửa, không xoá, không migrate bất kỳ dữ liệu cặp đôi nào**; không đổi code phía cặp đôi (front cặp đôi đã xử lý `hidden:true`). Hiệu lực tối đa 5 phút ở isolate khác (cache overlay như Ẩn).
- **Luồng yêu cầu kết nối của cặp đôi** cho vendor đã xoá chạy như với vendor đang Ẩn: tạo được, cùng mã trạng thái, cặp đôi không thấy thêm cờ nào.
- **Hộp yêu cầu kết nối của admin** (`GET /api/admin/connect-requests`, `/:id`; màn `ConnectInbox`) là bề mặt **ngoại lệ có chủ ý** (người vận hành cần biết để không đi liên hệ vendor đã gỡ): mỗi yêu cầu có `vendor_deleted: bool` (trạng thái hiện tại; **riêng**, không gộp vào `vendor_hidden`; vendor chỉ đã xoá thì `vendor_hidden:false`) và `vendor_deleted_at_create: bool` (trạng thái lúc tạo, giống `vendor_hidden_at_create`, không đổi sau khi tạo/khôi phục). `vendor_hidden_at_create` chỉ phản ánh cờ Ẩn (vendor chỉ đã xoá thì `false`). Màn in chữ riêng "· đã xoá" (không dùng "đang ẩn") và dòng cảnh báo riêng khi mở chi tiết.

### Tình huống 3: danh sách "Đã xoá"
- Danh sách admin mặc định (Mọi nhãn) và **mọi nhãn khác** (kể cả "Đang ẩn", "Đã ghi đè", **"Mồ côi"**) không có vendor đã xoá; `total` không đếm chúng. Ô tìm / Hạng mục áp như thường. Luật này đúng **kể cả khi vendor đã xoá rồi rơi khỏi pool** (pipeline enrich gỡ vì đóng cửa): nó chỉ ở "Đã xoá", không bao giờ ở "Mồ côi".
- Ô "Nhãn" có lựa chọn mới **"Đã xoá"** (giá trị API `label=deleted`): chỉ liệt kê vendor đã xoá (kết hợp AND với Hạng mục, ô tìm). Mỗi hàng hiện nhãn "Đã xoá", **lý do**, và (API) thời điểm + người xoá; hàng đã xoá hiện nhãn trạng thái "Đã xoá" và **không** hiện nhãn "Đang ẩn" (kể cả khi vendor cũng đang ẩn, cờ ẩn vẫn giữ nhưng không hiện ở nhãn này).
- **Vendor đã xoá và không còn trong pool** (rời pool sau khi xoá): hàng ở nhãn "Đã xoá" có `in_pool:false`, `orphan:false`, `name`/`category` có thể null (tìm bằng id); màn hiện ghi chú "không còn trong pool" ở hàng và khung chi tiết. Mọi hàng thuộc pool có `in_pool:true`. Chi tiết admin (`GET /vendors/:id`) có `in_pool` và `orphan` không phải true với vendor đã xoá. "Khôi phục vendor" **thành công (200)**: gỡ cờ xoá rồi vendor hiện **ở nơi nó sẽ hiện nếu chưa từng bị xoá**: còn bản sửa (giá, liên hệ, ẩn…) thì ở nhãn "Mồ côi" như mồ côi thường, rồi dọn bằng "Bỏ ghi đè"; không còn bản sửa nào thì biến khỏi mọi nhãn (chi tiết 404). Không có trạng thái kẹt.
- **Chiều ngược** (pipeline đưa vendor đã xoá trở lại pool): cờ xoá vẫn **thắng**: cặp đôi vẫn không thấy (`/status` `hidden:true`, không ở ghép/chat), admin vẫn thấy ở "Đã xoá" (`in_pool:true`), không ở danh sách mặc định.
- Chọn một vendor đã xoá: khung bên phải hiện thông tin xoá + nút **"Khôi phục vendor"**; **không** có "Lưu ghi đè", "Bỏ ghi đè", "Xoá vendor" (không sửa vendor đang xoá; API cũng từ chối).

### Tình huống 4: khôi phục
- "Khôi phục vendor": một cú bấm, không cần lý do; đúng một lần gọi API. Vendor rời nhãn "Đã xoá" và trở lại **đúng trạng thái ngay trước khi xoá**: cùng bản sửa (giá, xác minh, liên hệ, tên/mô tả/ảnh nếu có), **cùng trạng thái Ẩn** (đang ẩn trước khi xoá thì khôi phục xong vẫn ẩn, đúng lý do cũ; không ẩn thì hiện lại cho cặp đôi), cùng nhãn ở danh sách admin. Vendor trước đó không có bản sửa nào thì sau khôi phục cũng không có (`override` null, hàng không "Đã ghi đè").
- **"Lịch sử sửa" (`history`) không bị chạm**: xoá và khôi phục **không thêm dòng nào** vào đó (chỉ ghi Nhật ký, Tình huống 5), nên dòng cũ không bị đẩy ra dù vendor đã đủ 20 dòng (trần `HISTORY_MAX`). Sau xoá và sau khôi phục, `history` giống từng byte với trước khi xoá.

### Tình huống 5: Nhật ký
- Mỗi lần xoá / khôi phục **thành công** thêm đúng một dòng: `vendor.delete` / `vendor.restore`, đối tượng `vendor` + id, người làm, thời điểm; trước/sau cho thấy cờ xoá và lý do. Lần bị từ chối (400/404/409) không ghi dòng nào.
- Bộ lọc "Lọc theo thao tác" ở màn Nhật ký có "Xoá vendor" và "Khôi phục vendor"; dòng hiện đúng các chữ đó.
- Khi cờ `ADMIN_OPEN` bật (ADR-116) người làm là danh tính cố định có sẵn, như mọi thao tác admin khác (không đổi).

### Enrich
Chi tiết enrich (`/api/admin/vendor-enrich/:id/detail`) của vendor đã xoá: `pool.visible:false`, `pool.reasons` có `{code:"overlay_deleted", text:<câu giải thích tiếng Việt>}` (cạnh `overlay_hidden` có sẵn). Review `remove` vẫn chỉ là đề xuất: không xoá gì, vendor còn ở danh sách admin và cặp đôi vẫn thấy.

## Hợp đồng API (tohong-back, mọi route dưới `/api/admin/…`, quyền admin như route vendor hiện có)
- `POST /api/admin/vendors/:id/delete` thân `{expected_version?: int>=0 (mặc định 0), reason: string}` → `200 {ok:true, version}`.
- `POST /api/admin/vendors/:id/restore` thân `{expected_version?}` → `200 {ok:true, version}`.
- Thứ tự kiểm lỗi: id sai định dạng 400 `invalid id` → id không có trong pool **hoặc** chỉ là ghi đè mồ côi: 404 `vendor_not_found` (**ngoại lệ**: `restore` trên id không còn trong pool nhưng **đang mang cờ xoá** không bị 404, đi tiếp các bước sau và thành công; `delete` trên id đã rời pool vẫn 404) → (chỉ delete) `reason` sau khi cắt khoảng trắng hai đầu: trống 400 `delete_reason_required`, quá 300 ký tự 400 `delete_reason_too_long` (không cắt âm thầm) → `expected_version` lệch 409 `version_conflict` → xoá khi đã xoá 409 `already_deleted`, khôi phục khi chưa xoá 409 `not_deleted`. Sai phương thức 405; không phải admin 401/403 như hiện có.
- Lý do lưu đã cắt khoảng trắng. Ghi hỏng giữa chừng không để trạng thái nửa vời (một lần ghi tài liệu R2 có `ifMatch`, như `saveOverride`).
- Khi vendor đang xoá: `PUT /…/override` và `DELETE /…/override` trả **409 `vendor_deleted`** (không sửa; và "Bỏ ghi đè" không được vô tình khôi phục hoặc làm mất bản sửa).
- `GET /api/admin/vendors/:id` thêm `in_pool: bool`, `deleted: bool` và `deleted_info: {reason, at, by} | null`; `override` vẫn là bản sửa trước khi xoá, không chứa khoá nào bắt đầu bằng `deleted`.
- `GET /api/admin/vendors` mỗi hàng thêm `deleted: bool` và `in_pool: bool`; hàng vendor đã xoá không bao giờ có `orphan:true`; nhãn mới `deleted` hợp lệ (`invalid_label` cho giá trị khác, như cũ); hàng thuộc nhãn `deleted` kèm `deleted_reason`, `deleted_at`, `deleted_by`.
- `GET /api/admin/connect-requests` và `/:id`: mỗi yêu cầu thêm `vendor_deleted`, `vendor_deleted_at_create` (Tình huống 2); `vendor_hidden` / `vendor_hidden_at_create` chỉ phản ánh cờ Ẩn. Phía cặp đôi (`/api/couples/:id/connect-requests`) không đổi, không lộ các cờ này.
- Nhật ký: `action` `vendor.delete` / `vendor.restore`, `target_type:"vendor"`, `target_id:<id>`; `before.deleted`/`after.deleted` và `deleted_reason` (xoá: `after.deleted===true`; khôi phục: `before.deleted===true` kèm lý do).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` + `phungrk/tohong-front` · Nhánh: `t-203-xoa-vendor` · Vùng: `planner/admin`.
- Bất biến đã đọc: `eval/invariants/_shared/` (inv-001..004), `planner/admin/inv-001..006` (cờ `ADMIN_OPEN`, danh tính cố định, không route ngoài `/api/admin/*`, deploy giữ biến), `planner/admin/vendor-enrich/inv-006,009,010,011,013,014` (enrich, sửa pool: không đổi), `planner/vendor/images/inv-022-pool-khong-vendor-da-go` và `inv-038-ung-vien-chat-dung-pool-overlay`, `planner/vendor/matching`. Spec này **không vi phạm** INV nào: route mới nằm dưới `/api/admin/*` (inv-003), không thêm cờ cấu hình (inv-004/005). `vendor-enrich/inv-008/010(a)` ("không đăng nhập → 403") áp dụng cho route mới như mọi route admin (khi `ADMIN_OPEN` khác "1"). **Lưu ý tên**: `inv-022` nói "vendor đã gỡ" ở nghĩa pool-sinh-lại (đóng cửa vĩnh viễn), không phải "Xoá" của T-203; không mâu thuẫn, nhưng Spec critic nên xác nhận.
- **Vùng và bất biến pool**: Code Gate chỉ chạy bất biến của `planner/admin` và cấp cha, không chạy `planner/vendor/**` và `planner/admin/vendor-enrich/**`, trong khi spec sửa `isHidden`/`chatMatcher`/`vendorMatcher`/`getEnrichDetail`. Chief quyết (2026-11-18): thêm eval tầng 1 (tiêu chí 11) gọi nguyên tệp inv-022, inv-037, inv-038, inv-040 (`planner/vendor/images`) và inv-009, inv-010 (`planner/admin/vendor-enrich`, chạm chi tiết enrich); không sao chép, không sửa chúng. Trên main hiện tại cả sáu PASS (chủ ý: là lưới chống hồi quy, nên tiêu chí 11 xanh từ đầu).
- Kiến trúc: dùng chung overlay R2 hiện có (`vendorOverlay.js`, cùng khoá, cùng cơ chế `version`/`ifMatch`); **một** hàm "vendor đang bị gỡ" (ẩn hoặc xoá) để mọi bề mặt cặp đôi không rẽ hai nhánh. Front theo `src/admin/*` + `admin.css`, chữ tiếng Việt như trên.
- Không chạm: payment, auth, DB schema, dữ liệu cặp đôi (hồ sơ, ngân sách, hội thoại, yêu cầu kết nối), `vendorPool.generated.js`, bảng enrich/báo cáo, front cặp đôi. Chỉ thêm khoá `deleted*` vào tài liệu overlay admin (cộng thêm, tài liệu cũ không có khoá này đọc như "chưa xoá").
- **Bậc đề xuất: B** vì: tính cộng thêm + hoàn tác được (không xoá byte nào), không chạm payment/auth/dữ liệu người dùng/schema DB. Rủi ro cần Chief cân nhắc nâng C: (1) T-152 (ghi overlay mà cặp đôi thấy) từng là bậc C; (2) khi `ADMIN_OPEN=1`, bất kỳ ai có link `?admin=` xoá được vendor (hoàn tác được, có Nhật ký, danh tính cố định). Spec **không** thấy điểm nào bắt buộc C theo luật cứng.

## Tiêu chí chấp nhận và eval
Mọi lệnh chạy từ gốc `tohong-hq`; repo qua `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO` (mặc định `../tohong-back`, `../tohong-front`); tự dò gốc HQ (ADR-070). UI chạy trình duyệt thật + worker thật của back (R2 giả), mạng chặn.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Giao diện: "Xoá vendor" mở khung xác nhận; "Xác nhận xoá" khoá khi lý do trống/khoảng trắng; "Thôi" không gọi API; xác nhận gọi đúng một lần và back nhận đúng lý do | `bash eval/T-203/check_1_xoa_can_ly_do_xac_nhan.sh` |
| 2 | Sau xoá, vendor biến khỏi ghép (cả `ids=`), đếm hạng mục, ứng viên chat; `/status` trả `hidden:true` (không null), `/:id` 200 `hidden:true` `match:null`; khôi phục đưa lại tất cả | `node eval/T-203/check_2_cap_doi_khong_thay.mjs` |
| 3 | Danh sách admin: vendor đã xoá không có ở mặc định và mọi nhãn; `label=deleted` liệt kê kèm lý do/thời điểm/người, AND với hạng mục + ô tìm; `total` khớp | `node eval/T-203/check_3_admin_danh_sach.mjs` |
| 4 | Khôi phục về đúng trạng thái trước (có bản sửa / đang ẩn / không có bản sửa); đang xoá thì sửa/bỏ ghi đè bị 409; mã lỗi đúng, lần bị từ chối không ghi gì; id lạ/mồ côi 404; quyền | `node eval/T-203/check_4_khoi_phuc_dung_trang_thai.mjs` |
| 5 | Nhật ký: đúng một dòng `vendor.delete`/`vendor.restore` mỗi lần thành công, đủ trường; lần bị từ chối không ghi; xác thực lý do (trống/trắng/>300) | `node eval/T-203/check_5_nhat_ky.mjs` |
| 6 | Không xoá vĩnh viễn: R2 chỉ đổi tài liệu bản sửa + thêm dòng nhật ký, không mất khoá; dữ liệu cặp đôi y nguyên từng byte; vendor còn trong pool; vendor có đủ 20 dòng Lịch sử sửa thì sau xoá/khôi phục vẫn y nguyên 20 dòng (không thêm, không mất) | `node eval/T-203/check_6_khong_xoa_vinh_vien.mjs` |
| 7 | Xoá khác Ẩn và khác enrich `remove` (không bật cờ Ẩn; Ẩn vẫn còn ở danh sách mặc định; review `remove` không xoá; chi tiết enrich báo `overlay_deleted`) | `node eval/T-203/check_7_khac_an_va_enrich_remove.mjs` |
| 8 | Giao diện: nhãn "Đã xoá" (hàng hiện lý do, không "Đang ẩn"), nút "Khôi phục vendor", vendor đã xoá không sửa được, Nhật ký có hai thao tác và lọc được | `bash eval/T-203/check_8_giao_dien_da_xoa_khoi_phuc_nhat_ky.sh` |
| 9 | Hộp kết nối admin: `vendor_deleted` (hiện tại) và `vendor_deleted_at_create` (lúc tạo) riêng khỏi cờ Ẩn, ở danh sách và chi tiết; cặp đôi gửi yêu cầu cho vendor đã xoá như với vendor Ẩn; cặp đôi không thấy cờ; khôi phục đưa `vendor_deleted` về false, giữ cờ lúc tạo | `node eval/T-203/check_9_hop_ket_noi_admin.mjs` |
| 10 | Vendor đã xoá rồi rời pool: chỉ ở "Đã xoá" (`in_pool:false`, không "Mồ côi", không nhãn nào khác); sửa/bỏ ghi đè 409; Khôi phục 200 rồi hiện ở "Mồ côi" (có bản sửa) hoặc biến mất (không có), dọn được bằng "Bỏ ghi đè"; chiều ngược (quay lại pool): cờ xoá thắng | `node eval/T-203/check_10_vendor_da_xoa_roi_khoi_pool.mjs` |
| 10b | (phần giao diện của 10) hàng "Đã xoá" của vendor đã rời pool có ghi chú "không còn trong pool", không "Mồ côi", Khôi phục bấm được | `bash eval/T-203/check_10b_giao_dien_da_xoa_roi_pool.sh` |
| 11 | Không phá bất biến pool vendor (Code Gate không tự chạy chúng): gọi nguyên tệp inv-022, 037, 038, 040 (`planner/vendor/images`), inv-009, 010 (`planner/admin/vendor-enrich`) | `bash eval/T-203/check_11_bat_bien_pool_vendor.sh` |

Chạy trên main hiện tại: tiêu chí 1-10b **ĐỎ** (FAIL, không ERROR), vì back chưa có route xoá/khôi phục và front chưa có nút; tiêu chí 11 **XANH** (chủ ý, lưới chống hồi quy). Một số dòng "tiền điều kiện" xanh là có chủ ý (đo cơ sở trước khi xoá).
Ghi chú eval: `check_10` mô phỏng pipeline bằng cách rút/đưa lại phần tử trong `VENDOR_POOL` (cùng mô-đun với worker), không gieo khoá R2 tay, nên không bắt buộc tên khoá nội bộ. `check_9` tạo yêu cầu kết nối thật qua `POST /api/couples/couple_1/connect-requests` (có gieo `members.json`). `check_2` chạy chat bằng `chatMatch` + `buildMatchProfile` thật (đúng đường `contextBuilder`, không gọi mạng).

## Bất biến đề xuất (tầng 2)
Để Spec critic rút khi spec qua cổng:
1. `planner/vendor/inv-NNN-vendor-bi-go-khong-ra-phia-cap-doi`: vendor có cờ Ẩn **hoặc** Xoá không bao giờ có trong ghép vendor, đếm hạng mục, ứng viên chat; `/status` luôn trả `hidden:true`, `/:id` luôn 200 (lấy dựng từ `check_2` vế "sau xoá" + hành vi Ẩn hiện có).
2. `planner/admin/inv-NNN-thao-tac-vendor-khong-cham-du-lieu-nguoi-dung`: mọi route admin ghi vendor (override, delete, restore) chỉ làm đổi tài liệu overlay + thêm dòng nhật ký; không xoá khoá R2 nào; khoá ngoài hai chỗ đó y nguyên (dựng từ `check_6`).
4. `planner/admin/inv-NNN-vendor-da-xoa-khong-ket-va-co-xoa-thang`: vendor mang cờ xoá luôn có đúng một nhãn ở admin ("Đã xoá"), khôi phục được dù còn hay không còn trong pool; quay lại pool thì cờ xoá vẫn thắng (dựng từ `check_10`).
3. `planner/admin/inv-NNN-xoa-khoi-phuc-khong-mat-trang-thai`: với mọi trạng thái bản sửa, `delete` rồi `restore` trả lại chi tiết admin, hàng danh sách và phía cặp đôi y hệt (dựng từ `check_4`).

## Đã sửa ở v2 (spec rework vòng 1, theo phán quyết của Chief of Staff)
- **D1 (blocker)**: câu "Danh sách admin mặc định… không có vendor đã xoá" mở rộng nêu rõ cả "Mồ côi"; thêm hai đoạn mới ở Tình huống 3 (vendor đã xoá rồi rời pool: chỉ ở "Đã xoá", ghi chú, Khôi phục 200 rồi về nơi nó sẽ ở; chiều ngược: cờ xoá thắng) và ngoại lệ của `restore` ở thứ tự kiểm lỗi. Lý do: bản v1 cho ba cách cài khác nhau và có cách làm bản ghi kẹt vĩnh viễn. Eval mới: check_10, check_10b.
- **D2 (blocker)**: thêm câu về hộp kết nối admin ở Tình huống 2 và hợp đồng API (`vendor_deleted`, `vendor_deleted_at_create`, tách khỏi cờ Ẩn; luồng cặp đôi như vendor Ẩn). Lý do: v1 chỉ liệt kê năm bề mặt cặp đôi. Eval mới: check_9.
- **D3 (minor)**: câu "history không mất dòng nào" thay bằng "xoá/khôi phục không thêm dòng vào Lịch sử sửa; chỉ ghi Nhật ký; history y nguyên". Lý do: ghi dòng sẽ đẩy dòng cũ nhất ra ở trần 20. check_6 gieo 20 dòng và so từng byte.
- **Vùng**: thêm tiêu chí 11 (eval bọc bất biến pool vendor).
- **Diff hành vi**: thêm câu "với cặp đôi, Xoá và Ẩn y hệt" ở đầu "Hành vi".

## Không làm
Xoá vĩnh viễn (không có route/nút nào xoá bản ghi); xoá hàng loạt; sửa hay xoá dữ liệu hồ sơ/kế hoạch cặp đôi; thay đổi `vendorPool.generated.js`/báo cáo enrich; áp review enrich `remove` thành xoá thật; xoá vendor mồ côi; "Thùng rác" tự dọn theo thời gian; email/thông báo cho vendor hoặc cặp đôi; đổi front cặp đôi.

## Câu hỏi mở
Một (không chặn việc, spec đã chọn mặc định): cặp đôi đã lưu vendor bị xoá vẫn thấy thẻ ghi "Không còn nhận đặt" như vendor Ẩn (giữ kế hoạch nguyên vẹn, không đổi dữ liệu cặp đôi). Nếu Capu muốn vendor đã xoá biến hẳn khỏi kế hoạch đã lưu thì phải sửa dữ liệu cặp đôi (bậc C) và là việc riêng.
