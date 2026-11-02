# Spec T-043: danh sách thành viên trong admin kèm tên cô dâu, chú rể

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-02, ADR-018 `decisions/2026-11-02-admin-danh-sach-thanh-vien.md`): "ở màn hình admin, trong danh sách thành viên tôi muốn có tên của cô dâu & chú rể đi theo tài khoản thành viên đó". ADR-018 thay giới hạn "không danh sách" của spec 004 (T-018, `phungrk/tohong` `specs/004-admin-member-count/`) cho riêng tab Thành viên.

## Bằng chứng
- `phungrk/tohong-back` main `21231fb`: `api/admin.js` route `members-summary` (dòng 51-60) chỉ trả con số; `lib/adminStore.js` có `listCoupleIds` (523), `getOwnerUserId` (514), `getCoupleName` (504, ghép "cô dâu & chú rể" thành một chuỗi nên không dùng lại được cho tiêu chí này); `lib/clerkUsers.js` `getUserEmail` (tra từng người, cache 1 giờ, timeout 3 giây, lỗi trả null); `lib/memberStats.js` cache 5 phút trong bộ nhớ isolate, `resetMemberStatsCache()` cho test; `lib/coupleStore.js:14-37` mỗi cặp đôi có `data/couples/<id>/members.json` (mảng `{user_id, email, role, wedding_role, joined_at}`) và `profile.yaml` (`couple.bride_name`, `couple.groom_name`).
- `phungrk/tohong-front` main `ec59e0f`: `src/admin/Members.jsx` (tab Thành viên, hiện hai thẻ số và nút Làm mới), `src/admin/useLoad.js`, `src/admin/common.jsx` (`Loading`, `ErrorNote` có sẵn nút "Thử lại"), `src/api.js` `adminMembersSummary`. Trang admin mở bằng `/?admin`, không chạy analytics (`src/Root.jsx:9`).
- `members.json` có sẵn trường `email` do app ghi lúc tạo cặp đôi nhưng đó là bản sao có thể cũ; Capu yêu cầu email từ Clerk (tiêu chí 1), nên bản sao này không được dùng để hiển thị hay tìm.
- Wrangler của Worker (`wrangler.toml`) không bật observability; chưa kiểm được cấu hình trên Cloudflare (xem checklist dòng 6).
- Quy mô: spec 004 giả định dưới vài nghìn cặp đôi, mục tiêu ≤ 1.000 cặp đôi trong 5 giây. GIẢ ĐỊNH, tự tin ~75%: số hiện nay còn nhỏ hơn nhiều (chưa đếm lại ở phiên này, không đọc dữ liệu thật).
- Chưa kiểm được: tham số `user_id` (lọc nhiều người một lần) của `GET /v1/users` ở Clerk Backend API, tự tin ~80% là có (tối đa 100 giá trị mỗi lần là giả định). Nếu không có, Engineering phải nói lại, vì tiêu chí hiệu năng bên dưới (≤ 20 lần gọi Clerk mỗi request) phụ thuộc vào việc tra theo lô.

## Giả thuyết
Nếu admin thấy tên cô dâu, chú rể cạnh từng tài khoản thì Capu nhận ra người dùng thật (và gỡ lỗi hỗ trợ) mà không phải mở từng cặp đôi hay hỏi ai. Chỉ số bảo vệ: không có số điện thoại, tên hay email nào rò ra ngoài màn hình admin (log, analytics, URL, bộ nhớ đệm trung gian); các con số của spec 004 không đổi.

## Hành vi (người dùng thấy gì)

### Định nghĩa dùng chung
- **Dòng** (row): một đơn vị trong danh sách. Có ba loại (`kind`):
  - `account`: một tài khoản Clerk, tức một `user_id` không bắt đầu bằng `guest_` xuất hiện trong `members.json` của ít nhất một cặp đôi (với bất kỳ vai trò nào).
  - `guest`: một `user_id` bắt đầu bằng `guest_` xuất hiện trong `members.json` của ít nhất một cặp đôi.
  - `unknown`: một cặp đôi mà `members.json` không có, không đọc được, không phải mảng, hoặc không có phần tử nào có `user_id` là chuỗi không rỗng. Mỗi cặp đôi như vậy là một dòng riêng.
- Mỗi `user_id` là đúng một dòng, dù có bao nhiêu cặp đôi. Phần tử trùng `user_id` trong cùng một `members.json` chỉ tính phần tử đầu. Một cặp đôi có nhiều thành viên xuất hiện ở dòng của từng thành viên (với vai trò riêng của họ).
- **Mục cặp đôi** (`couples[]` của một dòng): `{bride_name, groom_name, role, created_at}`:
  - `bride_name`, `groom_name`: `couple.bride_name` / `couple.groom_name` trong `profile.yaml`, cắt khoảng trắng hai đầu. Không phải chuỗi, chuỗi rỗng, chỉ khoảng trắng, `profile.yaml` thiếu hoặc không đọc được -> `null`. Hai tên độc lập nhau.
  - `role`: `role` của chính `user_id` đó trong `members.json` nếu là `"owner"`, `"member"` hoặc `"viewer"`; giá trị khác hoặc dòng `unknown` -> `null`. (Vai trò cô dâu/chú rể/phụ huynh `wedding_role` không thuộc phạm vi.)
  - `created_at`: chuỗi `YYYY-MM-DD` lấy từ phần ngày trong mã cặp đôi `couple_<YYYYMMDD>_<chuỗi>` (như spec 004, ngày UTC); mã không theo mẫu hoặc ngày không hợp lệ -> `null`. Chỉ ngày, không giờ.
- **Chuẩn hoá để tìm**: chuyển sang NFD, bỏ mọi dấu kết hợp (U+0300 đến U+036F), đổi `đ` và `Đ` thành `d`, chuyển chữ thường, gộp mọi dãy khoảng trắng thành một dấu cách, cắt hai đầu.
- **Thứ tự**: dòng nào có cặp đôi mới nhất đứng trước. "Mới" so sánh mã cặp đôi như chuỗi, lớn hơn là mới hơn (mã không theo mẫu ngày coi là cũ hơn mọi mã theo mẫu, so với nhau cũng theo chuỗi). Hai dòng có cùng cặp đôi mới nhất: dòng có `role` `"owner"` trước, còn lại giữ thứ tự theo email chuẩn hoá tăng dần (email `null` cuối), rồi theo `kind`. Trong một dòng, `couples[]` cũng xếp mới nhất trước theo cùng quy tắc.

### API (back, `phungrk/tohong-back`, `api/admin.js`)
Route mới: **`POST /api/admin/members-list`** (không phải GET: từ khoá tìm kiếm chứa tên và email, đặt trên URL sẽ vào nhật ký truy cập và lịch sử của mọi lớp trung gian; thân POST thì không. Đây vẫn là thao tác chỉ đọc). Route `members-summary` giữ nguyên.

Thân yêu cầu (JSON, mọi trường tuỳ chọn): `{ "page": 1, "size": 20, "q": "", "refresh": false }`.
- `page`: số nguyên ≥ 1, mặc định 1. `size`: số nguyên 1 đến 50, mặc định 20. `q`: chuỗi tối đa 100 ký tự (tính theo `.length`), mặc định `""`; sau khi cắt hai đầu rồi chuẩn hoá, rỗng nghĩa là không lọc. `refresh`: `true` bỏ qua bộ nhớ đệm, mặc định `false`.
- Thân rỗng hoặc `{}` là hợp lệ (mặc định hết). Sai kiểu (`"2"` cho số, số thực, `null`, mảng cho `q`), ngoài khoảng, quá dài, thân không phải JSON hay không phải đối tượng -> **400** `{"error":"bad_request"}`.
- Phương thức khác POST (kể cả `GET ...?q=lan`) -> **405**; query string không được đọc.

Phản hồi 200 (đúng các trường sau, không thêm):
```
{ "page": 1, "size": 20, "total": 9, "total_pages": 1,
  "email_complete": true, "computed_at": "<ISO>", "cached": false,
  "items": [ { "kind": "account|guest|unknown",
               "email": "<chuỗi>|null",
               "email_status": "ok|unavailable|guest|none",
               "couples": [ { "bride_name": "<chuỗi>|null", "groom_name": "<chuỗi>|null",
                              "role": "owner|member|viewer|null", "created_at": "YYYY-MM-DD|null" } ] } ] }
```
- `total`: số dòng khớp `q`. `total_pages` = `ceil(total / size)` (0 khi `total` là 0). `page` vượt `total_pages` -> 200 với `items: []`.
- `email`/`email_status`: dòng `account` có email Clerk -> `"ok"`; dòng `account` mà không lấy được (Clerk lỗi, quá thời gian, thiếu khoá, người đã bị xoá, không có địa chỉ email) -> `email: null`, `"unavailable"`; dòng `guest` -> `null`, `"guest"`; dòng `unknown` -> `null`, `"none"`. Email chỉ lấy từ Clerk, không bao giờ từ `members.json`.
- `email_complete`: `true` khi mọi dòng `account` mà request này phải tra email đều có email. Không có `q`: chỉ tính các dòng trên trang trả về. Có `q`: tính mọi dòng `account` (vì tìm theo email cần email của tất cả).
- Tìm kiếm: dòng khớp khi chuẩn hoá `q` là chuỗi con của email chuẩn hoá, hoặc của `bride_name` chuẩn hoá, hoặc của `groom_name` chuẩn hoá của bất kỳ mục cặp đôi nào (so từng trường riêng, không nối). Chỉ các giá trị thật; nhãn hiển thị như "khách", "chưa điền", vai trò, ngày, mã nội bộ không phải nội dung tìm. Ký tự đặc biệt (`( [ % _ . * \`) là ký tự thường. Dòng khớp được trả đủ mọi mục cặp đôi của nó, không lọc mục.
- Quyền: lời gọi đầu tiên của route là cổng admin có sẵn (`requirePlatformAdmin`). Mọi người không phải admin (không token, khách, người thường, danh sách admin rỗng, token rác) và mọi phương thức -> **403** `{"error":"forbidden"}` trước khi đọc R2 hay gọi Clerk; kiểm quyền luôn đi trước kiểm đầu vào (người không phải admin gửi thân sai vẫn nhận 403).
- Chỉ đọc: không `put`/`delete` R2, không ghi nhật ký admin (`data/admin/audit/`), không đọc `conversations/` (như spec 002/004: thao tác đọc không ghi nhật ký).
- Mọi phản hồi 200 và 400 của route có `Cache-Control: no-store` (không `public`, không `max-age`/`s-maxage` > 0).

### Dữ liệu, hiệu năng
- Danh sách đầy đủ (chưa lọc, chưa chia trang, chưa có email) dựng từ R2 bằng `listCoupleIds` rồi đọc `members.json` và `profile.yaml` của mỗi cặp đôi, tối đa 2 lần đọc R2 mỗi cặp đôi, song song theo lô; được giữ 5 phút trong bộ nhớ isolate (như `memberStats`). Mọi request trong 5 phút sau đó (đổi trang, đổi `q`) dùng lại, không đọc R2; `refresh: true` dựng lại. `cached` báo kết quả có từ bộ nhớ đệm hay không. `resetMemberStatsCache()` (đã có, test dùng) phải xoá luôn bộ nhớ đệm này.
- Với 1.000 cặp đôi, request đầu tiên xong trong dưới 5 giây (như SC-004 của spec 004).
- Email: chỉ tra những người cần cho request này (không `q`: các dòng `account` trên trang, tối đa 50; có `q`: mọi dòng `account`). Tra theo lô; **một request danh sách gọi Clerk tối đa 20 lần**. Mỗi tài khoản tra tối đa một lần trong 1 giờ (cache có sẵn của `clerkUsers`). Người cần tra vượt giới hạn 20 lần thì tính là `unavailable`. Mỗi lần gọi Clerk có timeout 3 giây, các lần gọi chạy song song. Dòng `guest` và `unknown` không bao giờ gọi Clerk.
- Từ khoá `q`, tên và email của bất kỳ ai không được đưa vào URL hay thân của lời gọi Clerk (Clerk chỉ nhận mã người dùng).

### Riêng tư (back và front)
- Phản hồi không có số điện thoại, không `user_id`, không mã cặp đôi, không email lấy từ `members.json`, không trường nào ngoài danh sách trên.
- Không có `console.*` nào trong đường chạy của route in ra tên, email, `q` hay mã người dùng (kể cả khi Clerk lỗi và trong khối `catch`). Lỗi nội bộ trả 500 `{"error":"members_list_failed"}` với một chuỗi cố định, không chứa dữ liệu.
- Từ khoá chỉ đi trong thân POST; địa chỉ trang trình duyệt vẫn là `/?admin` (không `?q=`, không hash); không lưu tên, email, từ khoá vào `localStorage`/`sessionStorage`; không đổi `document.title`.
- Không có sự kiện analytics (PostHog hay bên thứ ba) nào ở màn này; trang admin không gọi host nào ngoài máy chủ API (và Clerk đăng nhập khi có). Tên và email không đi vào bất kỳ request nào tới host khác.
- Không bộ nhớ đệm CDN: `Cache-Control: no-store` (ở trên) và dùng POST.

### Giao diện (front, `phungrk/tohong-front`)
Trong tab Thành viên (`src/admin/Members.jsx`), **dưới** hai thẻ số và dòng "Cập nhật lúc / Làm mới" hiện có (không đổi gì ở phần số), thêm một vùng `<section aria-label="Danh sách thành viên">` (role `region`), gồm theo thứ tự trên xuống:
1. Tiêu đề "Danh sách thành viên".
2. Ô tìm `input type="search"` có `aria-label` và `placeholder` đều là "Tìm theo email hoặc tên". Gõ xong 300 ms không gõ thêm thì mới gửi (gõ liên tục 14 ký tự chỉ gửi vài request). Chuỗi gửi đi là chuỗi gõ đã cắt hai đầu, giữ nguyên dấu và hoa thường (máy chủ lo chuẩn hoá). Đổi từ khoá luôn quay về trang 1. Từ khoá rỗng -> danh sách đầy đủ.
3. Có `q` và `email_complete` là `false`: một ghi chú `role="note"` "Một số email chưa lấy được nên tìm theo email có thể thiếu kết quả." Không `q`: không hiện ghi chú này.
4. Danh sách: phần tử `role="list"` (tên "Danh sách thành viên"), mỗi dòng một `role="listitem"`, theo đúng thứ tự máy chủ trả về (giao diện không tự sắp xếp). Mỗi dòng hiện:
   - Dòng đầu: `account` có email -> email; `account` không có -> "chưa lấy được email"; `guest` -> "khách"; `unknown` -> "không rõ chủ sở hữu".
   - Mỗi mục cặp đôi một khối, theo thứ tự máy chủ trả: "Cô dâu: {tên hoặc chưa điền} · Chú rể: {tên hoặc chưa điền}", rồi "{vai trò} · {dd/MM/yyyy}". Vai trò: owner -> "Chủ cặp đôi", member -> "Thành viên", viewer -> "Chỉ xem", null -> "Không rõ vai trò". Ngày `null` -> "—". Một tài khoản nhiều cặp đôi thì liệt kê đủ mọi khối trong cùng dòng.
   - Giao diện chỉ vẽ đúng các trường trong hợp đồng; trường lạ nào máy chủ có nhét (kể cả `phone`) cũng không hiện.
5. Chia trang: nút "Trang trước", nút "Trang sau", chữ "Trang {page}/{total_pages}" và "{total} thành viên". "Trang trước" bị khoá (thuộc tính `disabled`) ở trang 1, "Trang sau" bị khoá ở trang cuối. Cỡ trang cố định 20 (giao diện luôn gửi `size: 20`). Khi `total` là 0 vẫn hiện "Trang 1/1".
6. Trạng thái:
   - Đang tải (chưa có dữ liệu cho trang/từ khoá hiện tại): chữ "Đang tải danh sách…" trong vùng, vùng có `aria-busy="true"`; các tab khác và hai thẻ số vẫn dùng được. Hết tải thì `aria-busy` không còn `true`.
   - Lỗi (mạng, 4xx/5xx kể cả 403): thông báo `role="alert"` trong vùng với nút "Thử lại" (dùng `ErrorNote`); các thẻ số không bị ẩn, lỗi của danh sách và lỗi của con số độc lập nhau. "Thử lại" gửi lại đúng `page` và `q` của lần lỗi.
   - Không có dòng: có `q` -> "Không tìm thấy thành viên nào khớp"; không `q` -> "Chưa có thành viên nào".
   - Giao diện chỉ gửi POST `/api/admin/members-list` (không query string, có `Authorization`), không gọi route ghi nào.
7. Màn 390px: trang không cuộn ngang; mỗi dòng nằm trọn trong bề ngang màn hình; email dài tới 90 ký tự xuống dòng chứ không bị cắt hay tràn; ô tìm và hai nút chia trang cao ít nhất 40px, ô tìm rộng ít nhất 200px.
8. Danh sách không có nút làm mới riêng; dữ liệu có thể cũ tối đa 5 phút.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` (nhánh `t-043-members-list-back`) và `phungrk/tohong-front` (nhánh `t-043-members-list-front`); mỗi repo một PR. Vùng (`area`): `admin/members`.
- Bất biến đã đọc: `eval/invariants/` chưa có vùng `admin/` (chỉ `_shared`, `hq`, `planner`); `_shared` (không secret trong repo, sổ cái đọc được) không bị chạm. Spec này không vi phạm bất biến nào hiện có. Bất biến mới đề xuất bên dưới.
- Spec 002 (admin đợt 1) và 004: cổng `requirePlatformAdmin`, "thao tác đọc không ghi nhật ký admin", "không đọc `conversations/`". T-043 theo đúng và chỉ thay giới hạn "không danh sách" của 004 theo ADR-018. Route `members-summary` và giao diện hai thẻ số không đổi.
- Test hiện có: `test/test_admin.js` có danh sách `ADMIN_ROUTES` cho T010 (mọi route admin 403 với người không phải admin). Engineering thêm `["POST","/api/admin/members-list",{}]` vào danh sách đó; ví dụ "admin hợp lệ: mọi route 2xx" đã dùng POST nên route mới phải trả 2xx với thân `{}`.
- Kiến trúc/design system: inline style và lớp `adm-*` sẵn có trong `src/admin/admin.css`; tái dùng `Loading`, `ErrorNote`, `useLoad`. Nên tách `MemberList.jsx` riêng, `Members.jsx` chỉ gắn vào.
- Không chạm: ghi R2, schema `members.json`/`profile.yaml`, migration, biến môi trường hay secret mới, số điện thoại, analytics, route `members-summary`.
- Bậc lưới lọc: **C**, vì hiển thị dữ liệu người dùng (tên, email) ở màn mới. Capu đọc diff hành vi và tự merge.
- Dữ liệu thử cho PR và ảnh: dữ liệu giả, không bao giờ dữ liệu thật.

## Tiêu chí chấp nhận và eval
Mỗi tiêu chí một lệnh chạy được (shell, `cd` rõ ràng); lệnh gồm phần back (`members_list.test.js`, lọc theo tiền tố tên `TCn `) và phần front (`check_members_ui.cjs --only n`). Không có lệnh tách rời thì không phải eval của tiêu chí. Các file nằm ở `/home/user/tohong-hq/eval/T-043/`; khi Engineering đưa test back vào repo, đổi đường dẫn thành `test/test_member_list.js` và thêm vào script `test`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Tab Thành viên có danh sách dưới các con số; mỗi dòng đủ: email Clerk hoặc "khách" hoặc "không rõ chủ sở hữu"; tên cô dâu, chú rể có dấu hoặc "chưa điền" (từng tên riêng); vai trò; ngày dd/MM/yyyy; một tài khoản nhiều cặp đôi liệt kê đủ trong một dòng; thứ tự mới nhất trước, hoà thì chủ trước | `cd /home/user/tohong-back && node --test --test-name-pattern='TC1 ' /home/user/tohong-hq/eval/T-043/members_list.test.js && cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-043/check_members_ui.cjs --repo . --only 1` |
| 2 | Ô tìm theo email hoặc tên không phân biệt dấu (cả đ/Đ) và hoa thường, từ khoá chỉ ở thân POST, debounce; chia trang 20 dòng/trang (máy chủ 1 đến 50, 400 khi sai); 1.000 cặp đôi dưới 5 giây, cache 5 phút, ≤ 20 lần gọi Clerk mỗi request | `cd /home/user/tohong-back && node --test --test-name-pattern='TC2 ' /home/user/tohong-hq/eval/T-043/members_list.test.js && cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-043/check_members_ui.cjs --repo . --only 2` |
| 3 | Chỉ admin: người khác nhận 403 trước khi đọc dữ liệu, mọi phương thức; admin xem được; chỉ đọc (R2 không đổi, không nhật ký admin, không đọc hội thoại); giao diện chỉ gửi POST members-list; 403 hiện lỗi | `cd /home/user/tohong-back && node --test --test-name-pattern='TC3 ' /home/user/tohong-hq/eval/T-043/members_list.test.js && cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-043/check_members_ui.cjs --repo . --only 3` |
| 4 | Không điện thoại; phản hồi chỉ có trường cho phép (không mã người dùng/cặp đôi/email cũ); tên, email, từ khoá không vào console, URL, Clerk, analytics, storage; `Cache-Control: no-store` | `cd /home/user/tohong-back && node --test --test-name-pattern='TC4 ' /home/user/tohong-hq/eval/T-043/members_list.test.js && cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-043/check_members_ui.cjs --repo . --only 4` |
| 5 | Đang tải, lỗi + "Thử lại" (giữ page và q), Clerk lỗi/thiếu khoá/người bị xoá: vẫn hiện tên và "chưa lấy được email", ghi chú khi tìm; 390px không cuộn ngang, nút đủ lớn | `cd /home/user/tohong-back && node --test --test-name-pattern='TC5 ' /home/user/tohong-hq/eval/T-043/members_list.test.js && cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-043/check_members_ui.cjs --repo . --only 5` |
| 6 | Cổng: `npm test` của back xanh và script `test` chạy file test có route members-list; front build xanh, lint không tăng; ảnh 390 và 1024 (dữ liệu giả) đã commit ở `docs/screenshots/T-043/` | `python3 /home/user/tohong-hq/eval/T-043/check_6_gates.py --back /home/user/tohong-back --front /home/user/tohong-front && python3 /home/user/tohong-hq/eval/T-043/check_6_shots.py --repo /home/user/tohong-front` |
| 6b | Mỗi repo đúng một PR, PR có ảnh dữ liệu giả và Diff hành vi, không console/analytics mới, không thay đổi dữ liệu/biến môi trường (phần người kiểm) | `eval/T-043/checklist.md` (máy không đọc được PR; ghi lý do ở đầu file) |

Ghi chú về lệnh: back cần `cwd` là repo `tohong-back` (test nạp `worker.js` của repo đó); front cần `cwd` là repo `tohong-front`. `check_members_ui.cjs` tự build với `VITE_ADMIN_DEV_TOKEN=dev:admin`, `VITE_API_BASE=http://api.test` vào thư mục tạm, cần Playwright ở `/opt/node-tools` (mỗi `--only` mất khoảng 15 đến 70 giây). `gate.py` chạy file `.py` bằng `python3 -I` không đối số, nên tất cả đi dạng lệnh shell như trên.

## Bất biến đề xuất (tầng 2)
Vùng `admin/members`. Mỗi bất biến phải đúng mãi cho mọi việc sau này chạm vùng này; Spec critic rút vào bể khi spec qua cổng, viết thành `.sh` chạy hai repo như các lệnh trên:
1. **Admin không trả điện thoại hay mã:** mọi route `/api/admin/members-*` trả JSON không có chuỗi khớp `phone|dien_thoai|sdt|mobile`, không số điện thoại trong dữ liệu seed, không `user_…`/`guest_…`/`couple_<ngày>` (nguồn: `TC4 phản hồi chỉ có đúng các trường cho phép`).
2. **Không phải admin thì 403, trước dữ liệu:** mọi route `/api/admin/members-*`, mọi phương thức, người không phải admin nhận 403 `{"error":"forbidden"}` và không đọc R2, không gọi Clerk (nguồn: `TC3 mọi lý do không phải admin`).
3. **Không ghi:** gọi mọi route `/api/admin/members-*` không để lại `put`/`delete` R2 nào và R2 y nguyên (nguồn: `TC3 chỉ đọc`).
4. **Không bộ nhớ đệm trung gian:** phản hồi các route `/api/admin/members-*` có `Cache-Control: no-store` (nguồn: `TC4 mọi phản hồi của route cấm bộ nhớ đệm`). Route `members-summary` hiện chưa có; nếu bất biến đặt ở mức cả vùng thì T-043 cần thêm header cho nó (con số tổng quan, rủi ro thấp). Spec này chỉ yêu cầu cho `members-list`; Spec critic quyết bất biến áp cho một route hay cả vùng.
5. **Dữ liệu cá nhân không ra khỏi màn admin:** màn Thành viên không tạo request tới host ngoài máy chủ API, không đưa tên/email/từ khoá vào URL, console, storage (nguồn: `check_members_ui.cjs --only 4`).

## Không làm
Sửa, xoá, khoá tài khoản; xuất CSV; số điện thoại; liên hệ thành viên (gửi tin, email); analytics theo người; xem chi tiết một cặp đôi hay mở hội thoại; sắp xếp theo cột hay lọc theo vai trò/loại; nút làm mới riêng cho danh sách; hiển thị tài khoản Clerk chưa có cặp đôi nào (xem câu hỏi mở); đổi `wedding_role`; đổi route `members-summary`; thêm chỉ mục dữ liệu mới (ADMIN-001 vẫn mở); cách ghi tên "cô dâu & chú rể" của `getCoupleName` (giữ nguyên cho nơi khác dùng).

## Câu hỏi mở
Danh sách lấy từ dữ liệu cặp đôi nên chỉ có tài khoản đã tạo hoặc tham gia ít nhất một cặp đôi; tài khoản Clerk đã đăng ký nhưng chưa vào cặp đôi nào sẽ KHÔNG có trong danh sách (và vì vậy số dòng "account" có thể nhỏ hơn "Tài khoản đã đăng nhập" ở thẻ số). Capu có chấp nhận điều đó không, hay cần thêm cả nhóm này (cần đọc toàn bộ danh sách người dùng Clerk, tốn thêm gọi Clerk và là một việc riêng)? Mặc định của spec: không hiện.
