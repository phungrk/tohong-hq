# Spec T-167: Dòng Ngân sách ghi phép so bằng đúng số server dùng + xem được số server dùng

> v2 (sau `handoffs/T-167-D1.md`: B1 ngân sách = 0, B2 eval front tự động, B3 H4 khi ước theo tổng, B4 thứ tự no_budget > no_guests, M1-M4) · v1 · Spec Writer (product) · 2026-11-14 · bậc B · vùng `planner/vendor/matching` · chạm `tohong-back` (chính) và `tohong-front` (hiển thị) · nối tiếp T-159, T-164 (H5, H7), ADR-094 (INV-005).
> Phạm vi do Capu chốt 2026-11-14: "làm mục 2 và 3". Truy nguyên nhân điểm 0% KHÔNG thuộc spec này (xem "Ghi chú nghi vấn", không có eval sửa).

## Ý định
Capu thấy nhà hàng Bạch Kim (3,9tr/bàn, 200 khách, hạng mục Tiệc cưới 90tr; 3,9 × 20 = 78 ≤ 90) bị điểm Ngân sách 0% mà không biết server đã so số nào với số nào. Thẻ vendor phải nói thẳng phép so, để cặp đôi và Capu tự thấy số lệch, thay vì tin hoặc ngờ một con số tròn.

## Bằng chứng
- Board T-167 (lời Capu 2026-11-14): thẻ chat hiện Ngân sách 0%, tổng 58%, phong cách 50%, lịch 100%. Tính ngược bằng trọng số `tohong-back/lib/vendorMatcher.js:298-302` (0,35 phong cách + 0,25 lịch + 0,20 ngân sách + 0,10 sức chứa + 0,10 chất lượng): 0,175 + 0,25 + 0 + 0,10 × 1 + 0,10 × 0,5 = 0,575, làm tròn 58. Khớp, nên sức chứa = 1 và điểm Ngân sách đúng bằng 0, không phải trung tính 0,5 (tự tin cao).
- Điểm 0 chỉ ra khi giá tổng vượt hạng mục hơn 20%: `lib/vendorMatcher.js:51-58` (`budgetScore`), venue có nguồn giá nhân số bàn: `:73-77` (`vendorBudgetScore`), số bàn = ceil(khách/10): `lib/budgetAllocation.js` (`tablesFor`).
- Cặp đôi thử "Alice & Capu", cưới 29.12.2027, 200 khách, tiệc cưới 90tr (dữ liệu Capu cung cấp 2026-11-14). Chief chạy lại với ngày cưới 2027-12-29: vẫn 100%, ngày cưới không phải nguyên nhân. Eval 1 case đầu dùng đúng hồ sơ này.
- Thẻ Bạch Kim hiện chip "Còn lịch 31.12"; chip này in ngày cưới của hồ sơ server dùng (`lib/vendorMatcher.js:94-96`), trong khi Capu thấy 29.12.2027: server chấm trên hồ sơ khác cái Capu thấy (Chief, 2026-11-14). Nghi: `buildMatchProfile` ưu tiên `couple.wedding_date` rồi mới `wedding_date` top-level (`api/vendors.js:89`), hai trường có thể lệch; hoặc thẻ chat gửi coupleId khác. Vì thế H4 hiện cả ngày cưới và nguồn từng số.
- Chief dựng lại (scratchpad `bk.mjs`): với 200 khách và 90tr luôn 100%; ra 0% khi số khách server dùng ≥ 271 hoặc ngân sách venue ≤ 65tr. Eval 1 của spec này tái hiện cả hai dạng lệch (case 2 và 4) trên pool đóng dấu.
- Hôm nay người dùng chỉ thấy chip `≈ 3.9tr/bàn × N bàn` khi điểm = 1 (`lib/vendorMatcher.js:100-108`) và thanh phần trăm ở `tohong-front/src/screens/chat/VendorChatCards.jsx:615-617` (đọc `bk.budget ?? 0.5`, dòng 24-48 `adaptVendor`). Khi điểm thấp không có chữ nào giải thích; `profileSnapshot` (`api/vendors.js:160-168`) có `guestCount`, `budgetTotal` nhưng không có ngân sách hạng mục và không nói số khách lấy từ đâu.

## Ghi chú nghi vấn (KHÔNG thuộc phạm vi, không có eval; để dành cho việc sau, mức tự tin ghi kèm)
Đường dữ liệu có thể cho 0% với dữ liệu Capu nhìn thấy, đã đọc ở main back `112eb60`:
1. `budget.json` có `guests` > 0 cũ hơn số hồ sơ: `api/vendors.js:110` + `lib/budgetAllocation.js` (`effectiveGuests`) cho `guests` của bảng thắng hồ sơ. Bảng được ghi bởi PUT `api/budget.js:101-110` (front gửi `guests` từ `VendorCtx.jsx:88`). Màn Khách mời "Sức chứa" lấy từ nơi khác (`Guests.jsx:164`, dữ liệu `api/guests.js`), nên hai màn có thể khác bảng. Khả năng cao nhất (~40%): ≥ 271 khách trong bảng khớp cách Chief đã tái hiện.
2. Phân bổ co giãn theo tổng hồ sơ: `allocationsByVendorCategory` nhân `profileTotal/docTotal` rồi `Math.round`; nếu `profile.budget` lệch xa tổng bảng (vd đơn vị) thì 90tr co về ≤ 65tr, trong khi màn Ngân sách của front có thể hiện số chưa co. GET /budget (`api/budget.js:62-79`) co cùng luật nên thường khớp, nhưng chỉ khi `oldTotal` > 0 và chỉ ở lần đọc, không ghi lại (~20%).
3. Hạng mục trùng `id` (`Map` giữ phần tử cuối ở cả `budgetAllocation.js` lẫn `api/budget.js:80`) hoặc hạng mục `venue` có `allocated_tr` 0 ở bản sau: mất phân bổ, rơi về `budget_by_category` cũ hoặc tổng × 48% (~10%).
4. `coupleId` của front khác cặp đôi Capu đang nhìn (ngữ cảnh `VendorCtx.jsx:37-58`): không giải thích 0% (hồ sơ rỗng cho điểm 0,5), loại (~3%).
Eval 1 và `profileSnapshot` mới sẽ cho đáp án thật khi Capu mở lại thẻ Bạch Kim sau khi ship.

## Giả thuyết
Nếu thẻ vendor ghi phép so bằng số server đã dùng thì khi điểm Ngân sách làm Capu ngạc nhiên, nguyên nhân (số khách lệch, hạng mục co giãn, thiếu số) đọc được ngay trên thẻ mà không cần dựng lại bằng script. Chỉ số bảo vệ: điểm Ngân sách, tổng điểm, thứ tự danh sách và chip lý do KHÔNG đổi so với main (spec chỉ thêm hiển thị).

## Hành vi (người dùng thấy gì)

### H1 · Mỗi vendor trong kết quả `match` có `match.budgetBasis`
Cả `GET /api/vendors/match` (mỗi phần tử của `vendors`) lẫn `GET /api/vendors/:id?coupleId=…` (trường `match`) mang một đối tượng `budgetBasis`. Hai nơi cho đối tượng giống hệt nhau (so bằng JSON) với cùng cặp đôi và cùng dữ liệu. Vendor ẩn (`match: null`) không có.

Trường của `budgetBasis` (số đơn vị triệu đồng). Các trường số trong JSON giữ SỐ ĐẦY ĐỦ, chưa làm tròn (vd `categoryBudgetTr` 59,04). Chỉ `text` làm tròn 1 chữ số thập phân bằng `Math.round(x*10)/10` (như `fmtTr` hiện có; 59,04 ghi `59`):
- `kind`, chọn theo thứ tự ưu tiên, điều kiện đầu tiên đúng thì dừng: (1) `"no_budget"`: ngân sách hạng mục đem so không có HOẶC bằng 0 hoặc nhỏ hơn 0 (vd hạng mục `honeymoon` có tỷ lệ 0% trong mẫu, hay `budget_by_category` cũ ghi 0); điểm 0,5 như main; (2) `"no_guests"`: venue theo bàn, không có số khách hiệu lực; điểm 0,5; (3) `"per_table"`: venue có nguồn giá theo bàn; (4) `"total"`: mọi vendor còn lại. Thiếu cả ngân sách lẫn số khách => `no_budget` (không có ngân sách thì số khách không giúp được gì).
- `pricePerTableTr` (chỉ `per_table`, `no_guests`): `priceMax` của vendor. `priceMaxTr` (chỉ `total`): `priceMax`.
- `tables`, `guests` (chỉ `per_table`): đúng `tablesFor(guests)` và số khách hiệu lực mà điểm Ngân sách đã dùng.
- `totalTr`: `per_table` = `priceMax × tables`; `total` = `priceMax`. Đây đúng là số được đem so, không làm tròn trước khi so.
- `categoryBudgetTr`: số ngân sách hạng mục đã đem so.
- `categoryBudgetSource`: `"allocation"` (phân bổ của bảng dự toán, sau co giãn), `"legacy_profile"` (`budget_by_category` của hồ sơ khi không có phân bổ), `"total_share"` (tổng ngân sách hồ sơ × tỷ lệ hạng mục). Khi là `total_share` có thêm `sharePct` (số nguyên %, vd 48 cho venue); các nguồn khác không có `sharePct`. Khi `kind = no_budget`: `categoryBudgetTr`, `categoryBudgetSource` và `sharePct` đều là `null` (kể cả khi hạng mục có tỷ lệ 0% như honeymoon hay hồ sơ cũ ghi 0); `totalTr` là `null`.
- `categoryId`: hạng mục của vendor.
- `estimated`: `true` khi `price_basis` thuộc nhóm ước tính (T-164 H5, `isEstimateBasis`), ngược lại `false`.
- `text`: câu tiếng Việt một dòng, định dạng ở H2.

Bất biến nội bộ bắt buộc: điểm `scoreBreakdown.budget` suy ra từ chính `totalTr` và `categoryBudgetTr` (số chưa làm tròn) trong `budgetBasis` theo luật cũ (`totalTr ≤ categoryBudgetTr` → 1; vượt hơn 20% → 0; giữa hai mức giảm tuyến tính; `no_guests` và `no_budget` → 0,5). Điểm, thứ tự, tổng điểm không đổi so với main ở mọi tình huống, kể cả ngân sách hạng mục = 0 (vẫn 0,5). Không được tính điểm bằng một số rồi in một số khác.

### H2 · Câu `text` (mỗi dòng một khuôn, dùng dấu phẩy thập phân, "tr" liền số)
- `per_table`: `≈ {giá}tr/bàn × {bàn} bàn = {tổng}tr so với {ngân sách}tr {nhãn}`. Ví dụ Capu: `≈ 3,9tr/bàn × 20 bàn = 78tr so với 90tr tiệc cưới`.
- `categoryBudgetSource = "total_share"`: nối thêm ` (ước theo tổng × {sharePct}%)` sau `{nhãn}`, vd `… so với 96tr tiệc cưới (ước theo tổng × 48%)`.
- `total`: `giá đến {priceMax}tr so với {ngân sách}tr {nhãn}` (cùng quy tắc nối `total_share`). Ví dụ: `giá đến 15tr so với 40tr chụp ảnh + quay phim`.
- Định dạng số: dấu phẩy thập phân, bỏ phần thập phân nếu là `.0`, KHÔNG có dấu phân cách hàng nghìn và không đổi sang tỷ (1440tr ghi `1440tr`).
- `no_guests`: đúng khuôn `Chưa có số khách nên chưa tính được tổng tiệc (giá ≈ {giá}tr/bàn)`, KHÔNG có dấu `=`, không đoán tổng. Ví dụ: `Chưa có số khách nên chưa tính được tổng tiệc (giá ≈ 3,9tr/bàn)`. `kind = no_guests` giữ `categoryBudgetTr` và `categoryBudgetSource` thật, `tables`/`guests`/`totalTr` là `null`.
- `no_budget`: đúng khuôn `Chưa có ngân sách cho {nhãn} nên chưa so được`, không có phép so, không nhắc số khách. Ví dụ: `Chưa có ngân sách cho tiệc cưới nên chưa so được`, `Chưa có ngân sách cho tuần trăng mật nên chưa so được`.
- Vendor `estimated = true`: câu bắt đầu bằng `Giá ước tính: ` rồi khuôn ở trên; câu không bao giờ chứa "trong ngân sách", "vừa ngân sách", "đủ ngân sách", "rẻ hơn" (T-164 H5). Phép so vẫn ghi đúng số.
- `{nhãn}` theo `categoryId` (chữ thường, đúng chuỗi sau): venue `tiệc cưới`; ceremony `lễ ăn hỏi`; photography `chụp ảnh + quay phim`; jewelry `nhẫn cưới + trang sức`; attire `trang phục cô dâu chú rể`; decor `trang trí tiệc + hoa`; makeup `makeup + làm tóc`; transport `xe rước dâu + đưa đón`; stationery `thiệp + quà tặng khách`; honeymoon `tuần trăng mật`.

Chip cũ giữ nguyên (spec không đổi chip): `≈ 3.9tr/bàn × 20 bàn` (dấu chấm, `lib/vendorMatcher.js:105`) nằm cùng thẻ với dòng mới `≈ 3,9tr/bàn` (dấu phẩy). Chấp nhận lệch dấu này trong T-167; không phải lỗi code. Thống nhất dấu là việc riêng.

### H3 · Front hiển thị
Ở thẻ chi tiết vendor trong chat (khối "Phân tích AI", ngay dưới thanh "Ngân sách", `VendorChatCards.jsx`) hiện đúng `match.budgetBasis.text`, một dòng chữ nhỏ, xuống dòng khi hẹp (không tràn ngang ở 360px), nguyên văn từ back (front không tự tính lại số, kể cả khi câu mâu thuẫn với thanh %). Thiếu `budgetBasis` (back cũ) thì không hiện gì: không chữ `undefined`, không phần tử dòng rỗng. Đây là nơi duy nhất hiện thanh "Ngân sách" trong front hôm nay; tab Vendor chỉ có chip lý do, giữ nguyên.

### H4 · `profileSnapshot` cho thấy số server dùng (mục 3 của Capu)
`GET /api/vendors/match` có `profileSnapshot` (đã có `styles`, `budgetTotal`, `weddingDate`, `city`, `guestCount`) thêm:
- `guestCountSource`: `"budget_doc"` khi số khách lấy từ `guests` của bảng dự toán (> 0), `"profile"` khi từ hồ sơ, `null` khi không có số khách.
- `budgetByCategory`: bản đồ `categoryId → triệu` chỉ gồm các hạng mục có số RIÊNG: phân bổ của bảng đã co giãn (nguồn `allocation`) đè lên `budget_by_category` cũ của hồ sơ (nguồn `legacy_profile`); `null` khi trống. Ngân sách ước theo tổng × tỷ lệ (`total_share`) KHÔNG nằm trong bản đồ này; số đem so của nó nằm ở `budgetBasis.categoryBudgetTr` cùng `sharePct`.
- `sources`: tên trường hồ sơ server đã đọc cho từng số, để đối chiếu hồ sơ server dùng với hồ sơ người dùng thấy: `weddingDate` (`"couple.wedding_date"` | `"wedding_date"` | `null`), `guestCount` (`"budget_doc.guests"` | `"guest_count"` | `"preferences.guest_count"` | `"couple.guest_count"` | `null`), `budgetTotal` (`"budget"` | `null`), `budgetByCategory` (bản đồ `categoryId → "allocation" | "legacy_profile"`). `weddingDate`, `budgetTotal`, `city` của snapshot là đúng giá trị server dùng (đã có từ trước, nay có nguồn); `weddingDate` là ngày mà chip "Còn lịch dd.mm" in.
Khớp số trong cùng phản hồi: `guestCount` = `budgetBasis.guests` (khi có); khi `categoryBudgetSource` là `allocation` hoặc `legacy_profile` thì `budgetByCategory[categoryId]` = `budgetBasis.categoryBudgetTr`; khi là `total_share` thì `budgetByCategory[categoryId]` vắng và `budgetBasis.categoryBudgetTr` = `budgetTotal × sharePct / 100`; `sources.budgetByCategory` chỉ có các hạng mục có trong `budgetByCategory`.
Ai xem được: đúng người đã qua `requireCoupleAccess(read)` cho `coupleId` đó (thành viên cặp đôi, trong đó có Capu khi mở tài khoản cặp thử). Không thêm đường admin mới đọc hồ sơ cặp đôi khác. Cách Capu xem: Network tab/response của `GET /api/vendors/match` hoặc chính dòng ở H3. Người không thuộc cặp đôi không nhận số nào của cặp đôi đó (hồ sơ rỗng như hôm nay). `profileSnapshot` và `budgetBasis` không chứa tên, email, điện thoại, `members`, ghi chú, danh sách khách.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` (chính: `api/vendors.js`, `lib/vendorMatcher.js`, `lib/budgetAllocation.js`) · `phungrk/tohong-front` (`src/screens/chat/VendorChatCards.jsx`) · Nhánh: `t-167-phep-so-ngan-sach` ở mỗi repo · Vùng: `planner/vendor/matching`.
- Thứ tự merge: back trước (thêm trường, tương thích ngược), front sau.
- Bất biến đã đọc: `_shared/` và `planner/vendor/` (inv-001..005) + `matching/` (inv-001..004). Spec không vi phạm: không đổi điểm/thứ tự (matching inv-001, 003), không bỏ nhãn giá (inv-002), giá ước tính không là bằng chứng (inv-003, H2), venue so bàn × giá với tổng (inv-004), một số khách hiệu lực (inv-005: `guests` của bảng thắng, seed 0 = không có). Không đề nghị đổi bất biến nào.
- Không chạm: payment, auth, schema DB, ghi dữ liệu người dùng (chỉ thêm trường đọc ra), LLM (`whyThisVendor` và hash câu AI giữ nguyên), thứ tự và điểm. Không thêm đường admin.
- `api/vendors.js` vẫn đọc bảng dự toán đúng một lần mỗi request (T-159 H4).
- Bậc B: thêm trường phản hồi + một dòng chữ; dữ liệu cặp đôi chỉ đi theo đường đã có quyền đọc.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (biến `TOHONG_BACK_REPO` mặc định `../tohong-back`). Đỏ trên main là đúng (chưa có `budgetBasis`).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Venue theo bàn: `budgetBasis` ở match và ở chi tiết giống hệt nhau, có đúng `tables`, `totalTr`, `categoryBudgetTr`, `categoryBudgetSource`, `sharePct`, `text` cho 8 tình huống (Bạch Kim 200 khách/90tr; bảng 300 khách thắng hồ sơ; bảng khách 0 lấy hồ sơ; tổng hồ sơ lệch tổng bảng co 90→45; không bảng ước theo tổng 96; hồ sơ cũ 70; làm tròn 59,04 -> `59`; số lớn 1440tr); điểm Ngân sách khớp phép so | `node eval/T-167/check_1_phep_so_theo_ban.mjs` |
| 2 | Thiếu số khách, thiếu ngân sách (kể cả bằng 0: honeymoon 0%, hạng mục cũ 0; thiếu cả hai => no_budget), vendor không theo bàn, giá ước tính, giá thật: đúng `kind`, đúng khuôn câu (H2), điểm 0,5 khi thiếu, không khẳng định ngân sách với giá ước tính | `node eval/T-167/check_2_thieu_so_khong_theo_ban_uoc_tinh.mjs` |
| 3 | `profileSnapshot` có `guestCountSource` + `budgetByCategory` khớp `budgetBasis`; không lộ trường cá nhân; người ngoài cặp đôi không nhận số nào | `node eval/T-167/check_3_so_server_dung_khong_lo_cap_doi_khac.mjs` |
| 4 | Front hiện đúng nguyên văn `budgetBasis.text` dưới thanh Ngân sách (đúng một dòng, không tính lại số), back cũ không `undefined`/dòng thừa, 360px không tràn | `node eval/T-167/check_4_dong_front.cjs` (Playwright + vite dev, khung của `eval/T-164/check_5a_nhan_app_cap_doi.cjs`; biến `TOHONG_FRONT_REPO`, `PLAYWRIGHT_PATH`) |

## Bất biến đề xuất (tầng 2)
INV (vùng `planner/vendor/matching`): với mọi vendor có `match`, `match.budgetBasis` tồn tại và điểm `scoreBreakdown.budget` suy ra được từ `totalTr`/`categoryBudgetTr` của nó; số khách và ngân sách hạng mục in ra là số đã tính điểm (không có hai nguồn). Nội dung = phần "khớp điểm" của eval 1, case no_budget của eval 2 và case (a), (b) của eval 3. Spec-critic rút khi spec qua cổng.

## Không làm
- Không truy nguyên hay sửa nguyên nhân 0% (đã nêu 4 nghi vấn, không có eval sửa).
- Không đổi điểm, trọng số, thứ tự, chip lý do, câu `whyThoseVendors`/`whyThisVendor`.
- Không thêm màn hay API admin đọc hồ sơ cặp đôi khác; không ghi hay sửa `budget.json`/hồ sơ.
- Không đổi nhãn giá (T-164) hay luật số khách (INV-005).

## Câu hỏi mở
Không. (Giả định ghi rõ: "admin xem số server dùng" hiểu là Capu/cặp đôi mở thẻ hoặc phản hồi API của chính cặp đôi mình; nếu Capu cần admin xem hồ sơ ghép của cặp đôi bất kỳ thì đó là dữ liệu người dùng, bậc C, việc riêng.)

## Lịch sử sửa
- v2.1 (sau D2): khuôn `no_guests` và `no_budget` ghi là chuỗi đúng nguyên văn (chữ hoa "Chưa"), eval 2 so nguyên văn thay regex chữ thường; `no_budget` có `categoryBudgetTr`, `categoryBudgetSource`, `sharePct`, `totalTr` đều `null`.
- v2 (2026-11-14, sau D1): H1 thêm `no_budget` cho ngân sách = 0 và thứ tự ưu tiên no_budget > no_guests (câu trước đó cho ba cách hiểu); H4 tách `total_share` khỏi `budgetByCategory` (câu "bằng categoryBudgetTr" sai khi ước theo tổng); số trong JSON không làm tròn, `text` làm tròn; định dạng số lớn; ghi chấp nhận lệch dấu chip cũ; tiêu chí 4 thành eval Playwright tự động (bỏ checklist tay, lý do cũ sai); eval 3 so trường cụ thể thay vì tìm chuỗi trong body.
- v1 (2026-11-14): bản đầu, theo phạm vi Capu chốt "mục 2 và 3".
