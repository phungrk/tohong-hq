# Spec T-152: drawer-phu-pool-dau-anh-admin-sua-pool

> v1 · Spec Writer (product) · 2026-11-13 · **bậc C** (ghi dữ liệu vendor cặp đôi thấy bằng quyền admin) · vùng `planner/admin/vendor-enrich` · chạm tohong-back và tohong-front (không chạm tohong) · **nối tiếp** `products/T-147-drawer-vendor-enrich.md` (v2) và `products/T-150-drawer-moi-admin-nhan-reviews.md`; **xếp sau T-151** (đang cài T-150: back #55, front #71, chưa merge). Hai bản mâu thuẫn thì **T-152 thắng** ở đúng các điểm ghi dưới "Thay đổi so với T-147/T-150".
> Quyết định của Capu (qua Chief of Staff, 2026-11-13): (1) drawer luôn PHỦ; (2) pool lên đầu; (3) ảnh kèm link; (4) **phương án A**: admin sửa dữ liệu pool qua overlay R2 `data/admin/vendor_overrides.json`, có hiệu lực ngay, không ghi ngược nguồn tohong, không qua PR; mọi admin được sửa. Phương án B (ghi vào nguồn qua PR) đã bị Capu bỏ. ADR do Chief of Staff ghi (thay ADR-084).

## Ý định
Capu (`board/T-152.md`, 2026-11-13): drawer "nổi lên trên nội dung" để kéo giãn không làm vỡ bảng; phần pool lên trên; hình hiển thị kèm link của hình; admin chỉnh được nội dung dữ liệu phần pool ngay trong drawer.

## Bằng chứng
Đo ngày 2026-11-13 trên mã hiện tại; tự tin cao (~90%) trừ chỗ ghi khác.
- **Overlay hiện có** (`tohong-back/lib/vendorOverlay.js`): mỗi vendor một ghi đè `{hidden, hidden_reason, priceMin, priceMax, price_verified, contact, version, updated_at, updated_by}`; ghi bằng `PUT /api/admin/vendors/<id>/override` (mọi admin: `requirePlatformAdmin`), `DELETE` cùng đường; đã có `expected_version` (409 `version_conflict`) và ghi R2 có `If-Match` thử lại tối đa 4 lần khi 412 (`mutate`); mỗi lần ghi có một dòng `appendAudit` (before/after cả ghi đè). `applyToVendor` chỉ áp `priceMin/priceMax`; `computeMatches` (tab Vendor, `api/vendors.js`) và `chatMatch` (chat, ADR-077) đều đọc overlay qua `applyToVendor`/`isHidden`. Cache overlay theo isolate **TTL 5 phút**; isolate vừa ghi cập nhật cache ngay (FR-033).
- **Ảnh trong pool** (đếm trên `lib/vendorPool.generated.js`, 867 vendor): 1974 ảnh `source:"marry"` host `www.marry.vn`; 410 ảnh `source:"google"` host `lh3.googleusercontent.com`, mỗi ảnh có `attribution` (inv-013) và truy về `place_id` (inv-014). Không ảnh nào ở host khác; **chưa có manifest mirror Pages** trong checkout (`scripts/vendor-images/` chỉ có README và script). App cặp đôi hiện dùng đúng các URL này trực tiếp (`vendor.photos[].url`, `src/vendorImages.js`, `VendorChatCards.jsx`); tôi **không tìm thấy** component ghi công ảnh Google trong `tohong-front/src` (inv-013 đo file pool, không đo giao diện) — khẳng định này ~70%, Engineering xác nhận lại. Drawer vì vậy dùng **đúng URL pool**, không dựng URL mới, không Places API (inv-012), không gọi Google từ mã của chúng ta.
- **Trường pool**: `styles` luôn bằng `tags` ở cả 867 vendor; mọi nhãn `styles` trong pool nằm trong `STYLE_LABELS_VI` của `lib/styleContract.js` (10 nhãn: korean, luxury, rustic, natural, modern, traditional, minimalist, soft, simple, editorial). Độ dài lớn nhất: tên 67, mô tả 220 (cắt của generator), ảnh tối đa 4/vendor; `capacity` có ở 85 vendor, dạng `{min,max}` (venue).
- **T-147 B4** viết "đẩy khi còn ≥ 640px, phủ khi hẹp hơn"; mã `EnrichDrawer.jsx` hiện: `push = !narrow && vw - cur >= 640` rồi `onPad(cur)` chừa lề phải cho trang. Đo trên `main` bằng eval mới: ở 1280px mở drawer làm bảng co từ rộng 1152 xuống 592 và dịch xuống (y 339 → 377).
- **Chặn giữa đường:** `eval/T-147/check_6_ui_drawer.cjs` (và T-150 chạy lại nó) ép chế độ ĐẨY ở 4 chỗ; T-151 đang chạy đúng file này qua Code Gate. Xem "Eval cũ bị đổi".

## Giả thuyết
Nếu drawer luôn phủ, pool đứng đầu, ảnh bấm được ra bản gốc và admin sửa được sai sót ngay trong drawer thì thời gian "thấy sai → sửa → cặp đôi thấy đúng" giảm từ "mở file nguồn, tạo PR, chờ sync-vendor-pool" xuống một lần lưu. Chỉ số bảo vệ: người ngoài vẫn 403; không có bản sửa nào làm mất ghi công ảnh Google hay đưa nhãn gu ngoài `styleContract` vào chat; không ghi gì vào nguồn; kích thước Worker không vượt ngưỡng (INV-005/inv-007).

## Hành vi (người dùng thấy gì)

### 1. Drawer luôn PHỦ (quyết định của Capu; thay T-147 B4)
- Drawer **luôn nổi trên** bảng ở mọi khung nhìn và mọi bề rộng. **Không còn chế độ ĐẨY**, không còn ngưỡng 640px, không còn lề phải cho trang.
- Mở drawer, kéo giãn (chuột, phím ←/→/Home/End), đóng drawer **không đổi** vị trí, kích thước của bảng enrich và của trang; trang không cuộn ngang (đo bằng hình học trước/sau, sai số 1px).
- Giữ nguyên T-147: dính mép phải, cao hết khung nhìn, rộng mặc định `min(560, khung nhìn)`, min/max (`min(560,V)` … `max(min, 90%V)`), tay cầm `role=separator` tên "Kéo để đổi bề rộng ngăn kéo", nhớ độ rộng, Esc / "Đóng", tiêu điểm về dòng, ≤ 480px phủ kín, không `track`.
- Hệ quả (nói thẳng): nút Approve / Sửa thủ công của dòng nằm **dưới** drawer không bấm được bằng chuột cho tới khi đóng drawer (như T-147 đã nói cho chế độ PHỦ); nút nằm ngoài vùng drawer phủ vẫn bấm được. Không bấm nút nào được mở drawer (như cũ).

### 2. Phần pool đứng đầu
Thứ tự các mục (h4) từ trên xuống: **"Kết quả trong pool"** (kể cả ảnh, nhãn "admin sửa", nút "Sửa dữ liệu pool") → **"Lớp admin (R2)"** → **"Lịch sử sửa"** → **"Thuộc tính nguồn dùng để tạo vendor pool"** → **"Đầu vào ngoài vendors.json"**. Nội dung từng mục giữ như T-147/T-150.

### 3. Ảnh: thumbnail + link ảnh gốc
- Trong "Kết quả trong pool", mục ảnh liệt kê **mỗi ảnh của giá trị hiệu lực** (đã áp bản sửa) một ô: thumbnail `<img>` (alt "Ảnh vendor <số thứ tự>", `loading=lazy`, `referrerpolicy=no-referrer`) trỏ **đúng URL trong pool**, và liên kết tên **"Mở ảnh gốc"** cùng URL đó, `target=_blank`, `rel` có `noopener noreferrer`.
- **Ghi công giữ nguyên (inv-013/014):** ảnh Google (có `attribution`) hiện thêm dòng "Ảnh: <attribution>" cạnh thumbnail; ảnh `marry` không có dòng đó. Drawer không tạo URL mới, không đổi `photoUri`, không gọi Places/Maps; request ảnh là của trình duyệt đúng như app cặp đôi đang làm.
- **Ảnh hỏng không làm hỏng drawer:** khi `<img>` báo lỗi, thumbnail đổi thành chữ "Ảnh không tải được", liên kết "Mở ảnh gốc" **còn nguyên**, mọi mục khác và nút "Đóng" vẫn chạy. Không có ảnh: "Chưa có ảnh".
- Bản thân JSON ảnh không còn in ra như một dòng chữ dài (thay bằng các ô trên).

### 4. Admin sửa dữ liệu pool (phương án A: overlay R2)
**4.1 Ai và ở đâu.** Mọi người đăng nhập có user id trong `ADMIN_USER_IDS` (không cần là Capu), qua **route sẵn có** `PUT|DELETE /api/admin/vendors/<id>/override`. Bản sửa nằm ở `data/admin/vendor_overrides.json` cùng ghi đè giá/ẩn/liên hệ hiện có. **Không ghi nguồn** (`vendorPool.generated.js`, tohong, `vendors.json`, `manual_overrides.json`) và không mở PR.

**4.2 Tập trường được sửa và kiểm hợp lệ** (lỗi: HTTP 400 `{"error": <mã>}`, không ghi R2; `null` = bỏ sửa trường đó, trả về giá trị pool):
| Trường | Quy tắc | Mã lỗi |
| --- | --- | --- |
| `name` | chuỗi, sau trim dài 1..120 | `invalid_name` |
| `description` | chuỗi, sau trim dài 1..300 | `invalid_description` |
| `styles` | mảng 0..5 chuỗi **khác nhau**, mỗi chuỗi **đúng chính tả** thuộc khoá của `STYLE_LABELS_VI` (không tự hạ chữ hoa); hiệu lực của `styles` và `tags` đổi cùng nhau (pool đang có `tags == styles`) | `invalid_styles` |
| `photos` | mảng 1..4 phần tử `{url, source?, attribution?}`; mỗi `url` dài ≤ 500, giao thức `https`, hostname **đúng** `www.marry.vn` (không userinfo, không đuôi giả); **ảnh Google chỉ được giữ nguyên**: phần tử phải y hệt một ảnh Google đang có trong pool của **chính vendor đó** (cùng `url`, `source:"google"`, `attribution` khớp, không rỗng); không trùng `url`. Admin **không thể thêm ảnh Google mới** (sẽ vi phạm inv-014: không truy về `place_id`). Ảnh `marry` mới chỉ gửi `{url}`; server lưu `source:"marry"` | `invalid_photos` |
| `capacity` | `{min, max}` số nguyên, `1 <= min <= max <= 5000`; **chỉ vendor hạng mục venue** | `invalid_capacity` |
| `priceMin`, `priceMax`, `price_verified`, `hidden`, `hidden_reason`, `contact` | **giữ nguyên** luật hiện có | mã hiện có |
| mọi trường khác (`category`, `city`, `rating`, `reviewCount`, `reviews`, `isVerified`, `availability`, `catLabel`, `catIcon`, `id`, `tags`, khoá lạ) | không sửa được | `field_not_editable` |
Lý do loại: `category`/`city`/`isVerified` quyết định vendor có vào bộ lọc ghép hay không; `rating`/`reviewCount`/`reviews` là dữ kiện của Google/khách, không phải ý kiến admin. Host ảnh mở thêm (vd manifest Pages khi T-051 mirror xong) là việc sau, không nới trong T-152.
Thay đổi hành vi cũ (nói thẳng): khoá lạ trước đây bị **lặng lẽ bỏ qua**, nay 400 `field_not_editable`; PUT **không đổi gì** (mọi trường bằng giá trị đang có) trả 200, không ghi R2, không tăng `version`, không thêm lịch sử.

**4.3 Hiệu lực ngay.** Ngay khi PUT trả 200 (cùng isolate, không chờ cache), `GET /api/vendors/<id>`, `GET /api/vendors/match` (tab Vendor) và `chatMatch` (chat) dùng giá trị đã sửa của `name`, `description`, `styles`, `tags`, `photos`, `capacity` (và giá như cũ): `applyToVendor` áp thêm các trường này; `chatMatch.matches[i].name` và `style_tags` là giá trị sửa; `vendor_id` vẫn thuộc pool; vendor `hidden` vẫn không vào. Isolate khác thấy sau **tối đa 5 phút** (TTL hiện có, xem Câu hỏi mở). Đọc lại từ R2 trong isolate mới luôn thấy bản sửa (bền). Bỏ sửa (`null`/`DELETE`) trả đúng giá trị pool gốc.

**4.4 Lịch sử sửa.** `GET /api/admin/vendors/<id>` (route sẵn có, mọi admin) trả thêm: `history`, `edited_fields`, `source_changed`, `editable`. `history` = tối đa **20** mục **mới nhất trước**, mỗi mục `{seq, at (ISO), by (user id người sửa), action: "edit"|"clear", changes: {<trường>: {before, after}}}`; `before/after` là **giá trị hiệu lực** (cái cặp đôi thấy) trước/sau; bỏ sửa thì `after` = giá trị pool. Mục `clear` (DELETE) liệt kê các trường bị bỏ. Sửa `contact` chỉ ghi `changes.contact = {changed:true}`, **không** có số/zalo/website trong lịch sử. Lịch sử nằm **cùng tài liệu R2** với ghi đè (một lần ghi, một etag, nên không có chuyện đã sửa mà thiếu lịch sử); dòng `appendAudit` hiện có giữ nguyên. `edited_fields` = các trường trong `{name, description, styles, photos, capacity, priceMin, priceMax}` đang bị sửa. `editable` = `{fields, styles (10 nhãn từ styleContract), limits}` để giao diện không liệt kê cứng.

**4.5 Ghi R2 có kiểm etag.** Giữ cơ chế `mutate`: đọc kèm etag, ghi `If-Match`, 412 thì đọc lại và thử lại (≤ 4 lần). Hai admin ghi **đồng thời hai vendor khác nhau** → cả hai bản sửa đều còn. Người kia đổi **cùng vendor** giữa lúc đọc và ghi, hoặc `expected_version` cũ → **409 `version_conflict`**, không ghi, bản của người kia còn nguyên.

**4.6 Nguồn đổi thì sao.** Khi lưu một trường, server nhớ giá trị pool lúc đó (`base`). Pool sinh lại (`sync-vendor-pool`) đổi giá trị trường đó sang giá trị khác → **bản admin sửa vẫn thắng** (không lặng lẽ mất việc của admin) và `GET /api/admin/vendors/<id>` trả `source_changed:[{field, base, now}]` cho **đúng** các trường đã sửa mà pool đã đổi (trường không đổi hoặc không bị sửa thì không có). Bỏ sửa trường → cờ biến mất, giá trị hiệu lực = giá trị pool mới. Sửa lại trường sau khi pool đổi → `base` cập nhật, cờ biến mất.

**4.7 Quyền.** Người ngoài `ADMIN_USER_IDS` (không token, token rác, user thường, `ADMIN_USER_IDS` rỗng/thiếu, token `dev:` khi `DEV_AUTH_BYPASS` tắt, người chỉ trong `CAPU_USER_IDS`) nhận **403 `{"error":"forbidden"}`** ở mọi đường trên và không ghi gì. Mọi admin sửa được (Capu không đặc quyền ở đây). Approve / Sửa thủ công / export ký của bảng enrich **không đổi** (vẫn chỉ Capu ký, inv-004, inv-008 chờ merge).

**4.8 Drawer.**
- Khi mở, drawer gọi thêm `GET /api/admin/vendors/<id>` (ngoài API chi tiết T-147; API chi tiết **không đổi**). Gọi lỗi: drawer vẫn hiện phần pool (từ API chi tiết) và chữ "Không tải được lớp sửa", không có nút sửa.
- Cột "Kết quả trong pool" hiện **giá trị hiệu lực**; trường nằm trong `edited_fields` có nhãn **"admin sửa"** đứng sau dòng của nó; trường khác không có nhãn. Mỗi trường đã sửa có nút **"Bỏ sửa <trường>"** (PUT trường đó `null`).
- Nút **"Sửa dữ liệu pool"** (chỉ khi đã tải được lớp sửa) mở biểu mẫu: ô "Tên", "Mô tả", hộp chọn cho từng nhãn gu của `editable.styles`, ô nhiều dòng "Ảnh (mỗi dòng một URL)" (điền sẵn URL hiệu lực; ảnh Google giữ trong danh sách và được **gửi lại nguyên** `url/source/attribution`), "Sức chứa tối thiểu"/"Sức chứa tối đa" (**chỉ venue**). "Lưu" gửi PUT chỉ gồm `expected_version` và các trường **đã đổi**.
- Lỗi: 400 → "Không lưu được: <mã lỗi>" và biểu mẫu còn để sửa tiếp; 409 → "Dữ liệu đã đổi, hãy tải lại" và tải lại lớp sửa. Lưu xong biểu mẫu đóng, lớp sửa tải lại.
- Mục **"Lịch sử sửa"**: mỗi mục một dòng "<by> · <at> · <trường>: <trước> → <sau>" (mảng nối ", ", rỗng "—"); chưa có: "Chưa có sửa".
- `source_changed` hiện "Pool nguồn đã đổi sau lần sửa: <trường> — lúc sửa: <base>, hiện: <now>".
- Nhãn gu trong biểu mẫu là mã (`luxury`…), không dịch (không đổi nhãn tiếng Việt ở giao diện cặp đôi).

### 5. Chia PR và thứ tự merge (Capu merge cả hai, bậc C)
0. **Điều kiện đầu: T-151 merge xong** (back #55 rồi front #71). Rồi Chief of Staff chạy **`python3 -I eval/T-152/ap-dung-check6-t147.py`** để sửa eval T-147 #6 (xem dưới) **trước khi giao Engineering** việc cài T-152.
1. **tohong-back** · nhánh `t-152-overlay-sua-pool` · **merge trước**: `lib/vendorOverlay.js` (`mergeOverride`, `applyToVendor`, history/base trong tài liệu), `api/admin.js` (`vendorDetail` thêm `history`/`edited_fields`/`source_changed`/`editable`; `putOverride`/`deleteOverride` ghi lịch sử), test trong `npm test`. Không đổi `getEnrichDetail`, báo cáo, workflow. Eval #1–#5, #9.
2. **tohong-front** · nhánh `t-152-drawer-phu-sua` · **merge sau, sau khi back đã deploy**: `src/admin/EnrichDrawer.jsx` (+ CSS `admin.css`, `api.js` đã có `adminVendorGet/Put`). Eval #6–#8, #10. Front merge sớm hơn back: lớp sửa lỗi → drawer ghi "Không tải được lớp sửa" (an toàn).
Rollback: revert front rồi back; overlay còn trường lạ thì `mergeOverride` cũ bỏ qua (không hỏng), dữ liệu sửa nằm lại trong R2.

## Thay đổi so với T-147/T-150
- T-147 Hành vi 5 "Bố cục (đẩy hay phủ)" **thay bằng** Hành vi 1 ở trên; đoạn "Khung hẹp" giữ.
- T-147 Hành vi 5 "Nội dung": thứ tự mục đổi (Hành vi 2); mục "Lớp admin (R2)" thêm nhãn theo 4.8.
- T-147 "Không làm: Sửa/ghi bất cứ gì từ drawer" **bị thay** (T-152 cho sửa pool trong drawer qua overlay). Approve / Sửa thủ công giữ nguyên.
- T-150 (quyền xem drawer = mọi admin, `field_notes.reviews`): không đổi.

## Eval cũ bị đổi (trong phạm vi quyết định của Capu; tiền lệ ADR-074; Chief ghi ADR)
Chỉ **một** file cũ có khẳng định ép ĐẨY: **`eval/T-147/check_6_ui_drawer.cjs`** (T-150 tiêu chí #3 chạy lại đúng file này). Các khẳng định đổi, theo nhãn:
1. "1280 mặc định (còn 720 >= 640): chế độ ĐẨY, bảng không dưới drawer" → PHỦ: bảng nằm dưới drawer.
2. "chế độ ĐẨY: trang không cuộn ngang" → đổi tên (giữ điều kiện).
3. "biên: drawer 632 … vẫn ĐẨY" → vẫn PHỦ.
4. "biên: drawer 656 … chuyển sang PHỦ" → đổi tên (giữ điều kiện).
5. Ba cú bấm Approve / "Rút lại" / "Sửa thủ công" khi drawer mở (đoạn "bảng vẫn dùng được khi drawer mở") đổi `.click()` thành `dispatchEvent('click')`, vì nút có thể nằm dưới drawer (Hành vi 1); kiểm tra còn lại giữ.
Các eval khác của T-147/T-150 (#1–#5 back, T-150 #4, #5, inv-006…) **không ép** đẩy/phủ và không đổi. **Vì sao chưa sửa tại chỗ:** T-151 đang ở Code Gate (adversary) và chạy đúng `check_6_ui_drawer.cjs`; sửa ngay làm gate của T-151 đỏ oan. Bản sửa đã viết sẵn, thử trên bản sao (cú pháp đúng, áp dụng một lần, chạy lại in "đã áp dụng") ở `eval/T-152/ap-dung-check6-t147.py`. Lúc áp dụng, eval #10 (chính file đã sửa) chạy cùng #6 làm bằng chứng PHỦ ở chỗ cũ.

## Ràng buộc (vòi)
- Repo và nhánh: `phungrk/tohong-back` · `t-152-overlay-sua-pool`; `phungrk/tohong-front` · `t-152-drawer-phu-sua`. Không chạm `phungrk/tohong`. Vùng: `planner/admin/vendor-enrich`.
- Bất biến đã đọc: `_shared/` (INV-001 không secret), `planner/` (inv-005 Worker khởi động; inv-007 Worker nén < 1MB), `planner/admin/vendor-enrich/` inv-001…007 (inv-004 chữ ký và inv-008 chờ merge: không đổi), `planner/vendor/images/` inv-012 (pool không URL Places), **inv-013** (ảnh Google có ghi công) và **inv-014** (ảnh Google truy về place_id) — spec **giữ cả hai trên đường overlay** (ảnh Google chỉ được giữ nguyên, không thêm); inv-037…041 (chat). **inv-038 (ứng viên chat đúng pool + overlay) vẫn đúng**: ứng viên vẫn từ `VENDOR_POOL` + overlay, không mạng; chỉ khác là tên/gu hiệu lực là bản sửa. **Lưu ý cho spec-critic:** inv-038 (ii) so tên dòng prompt với **tên pool**; kịch bản của nó không có bản sửa tên nên vẫn xanh (eval #9), nhưng nên mở rộng để so với tên **hiệu lực** — đề nghị bên dưới. Không đề nghị đổi/xoá bất biến nào.
- Kiến trúc: dùng `mutate`/`makeStore`/`httpErr`/`appendAudit` của `vendorOverlay.js`/`adminStore.js`; admin front theo `adm-*`; **không** thêm `nodejs_compat`, **không** import `node:*`, không thêm khoá/secret.
- Không chạm: payment, auth (không đổi `isCapu`/`requirePlatformAdmin`), schema DB, dữ liệu cặp đôi, `vendorPool.generated.js`, tohong, workflow, API chi tiết `…/vendor-enrich/<id>/detail` (T-147/T-150).
- **Bậc C:** ghi dữ liệu cặp đôi thấy (tên, mô tả, ảnh) bằng quyền admin; Capu đọc diff hành vi và tự merge.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; repo qua `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO`, rồi `../tohong-back`, `../tohong-front`. Mỗi tiêu chí đúng một eval. Eval front tự `vite build` và giả API (ảnh giả do khung trả, không Google).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Tập trường sửa được và kiểm hợp lệ từng trường (tên, mô tả, gu theo `styleContract`, ảnh chỉ `https` host `www.marry.vn` hoặc ảnh Google giữ nguyên, sức chứa chỉ venue, trường cấm), lỗi 400 đúng mã, không ghi R2 khi lỗi | `cd /home/user/tohong-hq && bash eval/T-152/check_1_sua_hop_le.sh` |
| 2 | Bản sửa có hiệu lực ngay ở tab Vendor (chi tiết + ghép) và chat, bền khi isolate mới, bỏ sửa trả pool gốc, chỉ ghi dưới `data/admin/`, `vendorPool.generated.js` không đổi | `cd /home/user/tohong-hq && bash eval/T-152/check_2_hieu_luc_tab_vendor_va_chat.sh` |
| 3 | Lịch sử (ai, lúc nào, trước/sau, tối đa 20, không lộ contact, no-op không ghi) và ghi R2 kiểm etag (đồng thời hai vendor không mất, cùng vendor 409) | `cd /home/user/tohong-hq && bash eval/T-152/check_3_lich_su_va_etag.sh` |
| 4 | Nguồn đổi: bản admin thắng, `source_changed` đúng trường, bỏ sửa/sửa lại xoá cờ; không ghi ngược nguồn (repo back không đổi byte) | `cd /home/user/tohong-hq && bash eval/T-152/check_4_nguon_doi_khong_ghi_nguon.sh` |
| 5 | Người ngoài (7 kiểu × 5 đường) 403 `forbidden`, không ghi; mọi admin (không cần Capu) sửa được | `cd /home/user/tohong-hq && bash eval/T-152/check_5_quyen_403.sh` |
| 6 | Drawer luôn PHỦ: mở/kéo giãn/đóng không đổi hình học bảng và trang ở 390/520/600/1280 (632, 656, max), không cuộn ngang, drawer trên bảng; kéo/phím/nhớ độ rộng như T-147 | `cd /home/user/tohong-hq && bash eval/T-152/check_6_drawer_phu_khong_doi_layout.sh` |
| 7 | Pool đứng đầu (thứ tự mục); ảnh có thumbnail + "Mở ảnh gốc" đúng URL, ghi công ảnh Google, ảnh hỏng không phá drawer, không request ngoài URL pool | `cd /home/user/tohong-hq && bash eval/T-152/check_7_drawer_pool_dau_va_anh.sh` |
| 8 | Nhãn "admin sửa" đúng trường, "Bỏ sửa", biểu mẫu (trường, điền sẵn, chỉ gửi trường đã đổi, ảnh Google gửi lại đủ attribution, không có sức chứa ở non-venue), lỗi 400/409, "Lịch sử sửa", "Pool nguồn đã đổi…", lớp sửa lỗi thì drawer vẫn chạy | `cd /home/user/tohong-hq && bash eval/T-152/check_8_drawer_admin_sua_pool.sh` |
| 9 | inv-038 (ứng viên chat đúng pool + overlay) vẫn xanh với back mới | `cd /home/user/tohong-hq && python3 -I eval/invariants/planner/vendor/images/inv-038-ung-vien-chat-dung-pool-overlay.py` |
| 10 | Không hồi quy drawer T-147/T-150 (nội dung, Esc, Approve/Sửa thủ công không hỏng, 403/404) sau khi `ap-dung-check6-t147.py` đã chạy | `cd /home/user/tohong-hq && bash eval/T-147/check_6_ui_drawer.sh` |

Không hồi quy khác (đã có, Code Gate tầng 1 của T-151 chạy): T-147 check_3/check_4 (API chi tiết không đổi), T-150 check_4/check_5.

**Đã chạy thử (nói thẳng).** Trên `main` hiện tại: #1 đỏ, #2 đỏ, #3 đỏ, #4 đỏ (FAIL, không ERROR), **#5 xanh sẵn** (route cũ đã chặn người ngoài; eval khoá không-đổi và sẽ đỏ nếu code mở quyền), #6 đỏ đúng chỗ (1280: bảng co 1152 → 592), #7 đỏ, #8 đỏ, #9 xanh sẵn (khoá không-hồi-quy), #10 **chưa chạy** (phụ thuộc front #71 của T-151 và patch; sau patch sẽ đỏ tới khi front PHỦ). **Đã thử xanh:** #2 xanh trên bản sao tạm của back có vá tối thiểu (áp `name/description/styles/photos/capacity` vào `applyToVendor`/`mergeOverride`, không kiểm hợp lệ); bất biến đề xuất đỏ đúng 88 chỗ trên chính bản vá đó (không kiểm hợp lệ) và PASS "chưa áp dụng" trên `main`. **Chưa thử xanh:** #1, #3, #4 (cần code đầy đủ), #6, #7, #8 (cần code front). Các eval front dùng giả API theo hợp đồng ở Hành vi 4.4/4.8; nếu Engineering thấy hợp đồng chưa đủ rõ ở chỗ nào thì về spec, không tự đổi eval.

## Bất biến đề xuất (tầng 2)
- **Bản sửa pool của admin không phá hợp đồng dữ liệu cặp đôi thấy** (bản chạy được: `eval/T-152/bat-bien-cho-merge/inv-xxx-ban-sua-pool-khong-pha-hop-dong-anh-gu.py`; "chưa áp dụng" trên `main`). Sau các bản sửa hợp lệ lẫn bị từ chối, vendor hiệu lực ở tab Vendor có `styles` ⊆ `STYLE_LABELS_VI`, ảnh https host `www.marry.vn`/`lh3.googleusercontent.com`, mọi ảnh Google có attribution và nằm trong ảnh Google của chính vendor ở pool gốc, tên 1..120, mô tả 1..300, `capacity` chỉ venue hợp lệ. Lý do: inv-013/014 chỉ đo **file** pool; overlay là đường thứ hai tới cặp đôi.
- **Mở rộng inv-038 (ii)** (đề nghị spec-critic, không tự sửa): thêm một bản sửa tên vào kịch bản và đòi tên dòng prompt = tên **hiệu lực** (pool + overlay). Eval #2 đã đo ý này cho `chatMatch`.
- Không đề xuất thêm: "người ngoài 403" khoá bởi eval #5; kích thước Worker khoá bởi inv-007.

## Không làm
- Ghi ngược nguồn tohong, tạo PR, đổi `vendorPool.generated.js`, workflow, báo cáo enrich, API chi tiết T-147.
- Sửa `category`, `city`, `rating`, `reviewCount`, `reviews`, `isVerified`, `availability`, `tags` riêng; thêm ảnh Google mới; mở thêm host ảnh (mirror Pages để sau); upload file ảnh.
- Đổi quyền Approve / Sửa thủ công / export ký; đổi `isCapu`, `requirePlatformAdmin`.
- Dịch nhãn gu sang tiếng Việt trong biểu mẫu; xem trước thay đổi, hoàn tác từng mục lịch sử (chỉ có "Bỏ sửa" từng trường).
- Hiện tên hiệu lực trong danh sách admin vendor (`GET /api/admin/vendors`) hay bảng enrich (giữ tên pool).
- Đổi TTL cache overlay (xem Câu hỏi mở); sinh lại pool; gọi Google.

## Câu hỏi mở
**"Có hiệu lực ngay" có chấp nhận độ trễ tối đa 5 phút ở các isolate khác không?** Overlay hiện cache 5 phút theo isolate; isolate vừa ghi và mọi lần admin tải lại thấy ngay, còn một cặp đôi gặp isolate khác có thể thấy bản cũ tới 5 phút (như ẩn/giá hôm nay). **Mặc định nếu không trả lời: giữ nguyên 5 phút** (spec và eval #2 đo "ngay" trong isolate vừa ghi và "bền" khi nạp lại). Nếu Capu muốn ngắn hơn (vd 30 giây) chỉ đổi hằng `OVERLAY_TTL_MS`, không đổi gì khác.
