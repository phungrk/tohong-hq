# Spec T-164: Giá vendor N4 — dọn giá rác, khung giá hạng mục có nhãn "ước tính", nhãn giá thống nhất

> v1 · Spec Writer (product) · 2026-11-14 · bậc B · vùng `planner/vendor/images` · chạm `tohong`, `tohong-back`, `tohong-front` · nối tiếp T-160 (P0), ADR-089, T-159, T-152.
> Hạng mục trong spec này là **hạng mục của pool** (`category` trong `vendorPool.generated.js`), không phải hạng mục nguồn của scraper; số trong `insights/2026-11-14-p0-gia-vendor.md` tính theo hạng mục nguồn nên lệch vài chỗ (vd makeup 29 so với 17 hợp lệ ở đây).

## Ý định
Capu (tohong#99, 2026-11-14): mọi vendor trong pool có nhãn giá trung thực, giá riêng có nguồn hoặc khung giá hạng mục ghi rõ "ước tính"; giá không phải đối tượng Capu duyệt định kỳ (ADR-089: bậc B). P0 (`insights/2026-11-14-p0-gia-vendor.md`): N1+N2 dưới ngưỡng, chuyển N3+N4. Việc này làm N4 và dọn giá rác. N3 (hỏi cặp đôi báo giá) là dữ liệu người dùng, bậc C, việc riêng.

## Bằng chứng
Đo ngày 2026-11-14 trên `tohong-back/lib/vendorPool.generated.js` (867 vendor) ghép `tools/scraper/output/HCMC/*/vendors.json` theo id (867/867 khớp); tự tin cao (~90%). Dựng lại bằng `eval/T-164/fixtures/tao-fixture.py`.
- 221/867 vendor có `price_range` nguồn (mọi bản ghi `last_scraped` = 2026-06, nguồn marry.vn đã chết); 646 mang giá mặc định theo hạng mục (`PRICE_DEFAULTS` của generator), pool không phân biệt hai loại.
- Đơn vị nguồn: mọi hạng mục là `package`, trừ venue có 51 `per_table` và 2 `package` (giá cả sự kiện, không so được với giá bàn).
- Giá rác trong 221: trung điểm từ 0,002tr (giá một thiệp 2.000-15.000đ ghi "gói") tới 2.450.006tr (≈ 2,45 nghìn tỉ đồng, photography); decor có 800.000tr và 1.750.000tr. Với bảng ngưỡng ở H1: **57 vendor bị loại** (55 ngoài ngưỡng, 2 sai đơn vị), **164 giữ** làm giá riêng. Bị loại theo hạng mục: stationery 16, venue 11, ceremony 6, decor 6, transport 4, attire 3, honeymoon 3, jewelry 3, makeup 3, photography 2. Danh sách id: `eval/T-164/fixtures/expected-prices.json` mục `rejected`.
- Khung P25-P75 từ 164 giá riêng (n theo hạng mục): attire 16 → 2,0-10,2tr; ceremony 13 → 2,0-10,0; decor 22 → 2,4-69,9; jewelry 14 → 4,2-12,5; makeup 14 → 9,8-19,5; photography 29 → 4,0-15,3; venue 42 → 3,0-7,3 mỗi bàn. Dưới 10 mẫu nên dùng giá mặc định cũ: honeymoon (6), stationery (6), transport (2).
- Kết quả pool sau khi áp spec: 164 `legacy_marry`, 459 `estimate_category`, 244 `estimate_default` (honeymoon 47, stationery 160, transport 37).
- Bundle: `worker.js` nén gzip 773.823 byte hôm nay; pool có thêm `priceSource`/`priceAsOf` cho 867 vendor đo được 775.713 byte (+1,9KB), trần inv-007 là 1.000.000.
- Ngưỡng theo hạng mục là **GIẢ ĐỊNH, tự tin ~60%**: đặt tay từ phân phối quan sát và mặt bằng giá cưới (không tính từ pool: insight P0 chỉ ra tính khung từ chính giá rác là vòng lặp tự tham chiếu). Sai thì đổi bảng (đổi spec), không đổi code.
- Chưa đo: tỉ lệ cặp đôi bấm vào vendor có giá mặc định rồi bỏ đi (insight P0 mục "Nên đo thêm").

## Giả thuyết
Nếu mọi giá hiện ra đều có nhãn đúng nguồn và giá rác không còn lọt vào pool thì cặp đôi không còn thấy số vô lý (thiệp 2.500đ, trang trí 800 tỉ) và không bị nói "trong ngân sách" bằng một con số chỉ là ước tính. Chỉ số bảo vệ: chất lượng top-5 chat và tab Vendor (ghép giữ nguyên công thức, H5), bundle ≤ 1MB, không vendor nào mất khỏi pool.

## Hành vi (người dùng thấy gì)

Đơn vị giá trong pool và API là **triệu đồng** (`priceMin`, `priceMax`), làm tròn 0,1 như hiện nay. Venue tính theo bàn, hạng mục khác theo gói.

**H1. Dọn giá rác (ở lúc sinh pool, không ở nguồn).** Bản ghi `price_range` trong `vendors.json` giữ nguyên (nó là bằng chứng và `rescrape` ghi đè được); generator `tools/generate-vendor-pool.js` quyết giá nào đủ tư cách làm "giá riêng". Giá riêng **hợp lệ** khi đủ cả bốn:
(a) `unit` đúng đơn vị của hạng mục: venue = `per_table`, mọi hạng mục khác = `package` (thiếu `unit` là sai);
(b) `min_vnd > 0` và `max_vnd >= min_vnd` (thiếu một đầu là không hợp lệ);
(c) **cả hai đầu** nằm trong khoảng [thấp, cao] của hạng mục, đóng hai đầu (triệu VND): attire 0,3-60 · ceremony 0,5-100 · decor 0,5-300 · honeymoon 1-200 · jewelry 0,5-150 · makeup 1-100 · photography 0,5-150 · stationery 0,3-50 · transport 0,5-60 · venue 1-20 (mỗi bàn);
(d) có `last_scraped` đọc được (ngày `YYYY-MM-DD...`).
Vendor có `price_range` mà không hợp lệ: **không** giữ số đó trong pool, rơi về N4 (H2). Không dùng cờ "đáng ngờ" để giữ số rác. Số lượng và danh sách vendor bị ảnh hưởng ở "Bằng chứng". Quy tắc này thay cho `PRICE_DEFAULTS` chỉ ở chỗ: số mặc định giờ chỉ dùng khi không đủ mẫu (H2).

**H2. Khung N4 = P25-P75 theo hạng mục, tính ở lúc sinh pool.**
- Mẫu của một hạng mục = các vendor cùng hạng mục có giá riêng hợp lệ (H1) **và** không quá 365 ngày. Mỗi vendor một giá: `(priceMin + priceMax) / 2` tính trên giá đã làm tròn 0,1 của pool. Tuổi = số ngày từ **cuối tháng** của `last_scraped` tới `--as-of` (mặc định hôm nay UTC); `> 365` thì không còn là giá riêng, rơi về N4 và không là mẫu.
- n ≥ 10: khung = [P25, P75] của các giá mẫu, P_p nội suy tuyến tính ở vị trí `(n-1)·p` trên mảng đã sắp, làm tròn `Math.round(x*10)/10`. Mọi vendor **không có giá riêng** của hạng mục nhận `priceMin = P25`, `priceMax = P75`, `priceSource = "estimate_category"`, `priceAsOf` = tháng (`YYYY-MM`) lớn nhất của mẫu.
- n < 10: không đủ mẫu để khung có nghĩa (P25/P75 chỉ còn là nội suy giữa 2-3 điểm): vendor không có giá riêng nhận giá mặc định cũ của hạng mục (`PRICE_DEFAULTS` giữ nguyên số), `priceSource = "estimate_default"`, `priceAsOf` vắng/null. Nhãn hiện ra giống hệt `estimate_category` (H3); khác nhau chỉ để đếm được bao nhiêu vendor còn chờ dữ liệu.
- **Chống lệch**: mẫu chỉ là giá riêng hợp lệ, không bao giờ là vendor ước tính (không tự tham chiếu); giá rác không vào mẫu; kết quả chỉ phụ thuộc đầu vào và `--as-of`, không phụ thuộc thứ tự bản ghi hay giá đang nằm trong pool nền.
- **Tính lại khi nào**: mỗi lần chạy generator ở chế độ sinh đầy đủ hoặc chế độ mới `--prices-only --in <pool-vendors.json> --base <pool> --out <pool> [--as-of YYYY-MM-DD]` (chỉ ghi bốn trường giá `priceMin, priceMax, priceSource, priceAsOf`; mọi trường khác y nguyên). Cần chạy khi giá nguồn đổi, khi tập vendor của pool đổi (T-110 gỡ/thêm vendor) hoặc khi có giá vượt mốc 365 ngày. Không có lịch tự động (P2 sẽ có); bất biến INV-A đỏ nếu pool lệch công thức, nên lệch không âm thầm.
- Giá riêng hợp lệ nhận `priceSource = "legacy_marry"`, `priceAsOf` = `YYYY-MM` của `last_scraped`, `priceMin/priceMax` = giá nguồn làm tròn 0,1 (như cũ).

**H3. Thứ tự ưu tiên nguồn giá và nhãn.** Giá hiệu lực của một vendor lấy từ nguồn cao nhất có:
| Bậc | Nguồn | `price_basis` | Nhãn (`price_label`, chuỗi nguyên văn) |
| --- | --- | --- | --- |
| 1 | Overlay admin (R2, T-152) có `price_verified: true` | `admin_verified` | `Giá đã xác minh` |
| 1 | Overlay admin có `priceMin` hoặc `priceMax` mà chưa xác minh | `admin` | `Giá do Tơ Hồng cập nhật` |
| 2 | Giá riêng có nguồn (N1/N2) | chưa có dữ liệu, chưa hỗ trợ: `priceSource` lạ bị coi như thiếu (xem cuối bảng); việc P1 thêm giá trị và nhãn của nó thì đổi spec này | |
| 3 | Pool `priceSource = "legacy_marry"` | `legacy_marry` | `Giá marry.vn · MM/YYYY` (từ `priceAsOf`); quá 180 ngày kể từ cuối tháng `priceAsOf` thì `Giá cũ marry.vn · MM/YYYY` |
| 4 | Pool `estimate_category` hoặc `estimate_default` | cùng tên | `Ước tính theo hạng mục` |
- Overlay chỉ có `price_verified: true` (xác nhận giá pool) cũng là `admin_verified`; overlay không có giá và chưa xác minh (vd chỉ liên hệ, ẩn) không đổi nguồn giá. `price_as_of` của hai bậc admin là null.
- Tuổi "giá cũ" tính lúc xử lý request theo ngày UTC hiện tại (> 180 ngày: 2026-06 thành "cũ" từ 2026-12-28, 180 ngày chưa cũ); quá 365 ngày rơi về N4 xảy ra lúc sinh pool (H2), không lúc đọc.
- Pool **không có** `priceSource` hợp lệ (pool cũ, fixture đông cứng của T-140/T-159): API **không thêm** `price_basis`/`price_as_of`/`price_label` cho vendor đó, kể cả khi có overlay; `price_source` cũ (`verified`/`estimated`) giữ nguyên nghĩa; app dùng nhãn dự phòng `giá ước tính` (hoặc `giá đã xác minh` nếu `price_source = verified`) như hôm nay. Lý do: phản hồi trên pool cũ phải y nguyên từng byte (T-140 check 7 và T-143 adv-01 băm toàn bộ phản hồi).
- Pool thêm hai trường `priceSource`, `priceAsOf`; `price_source` cũ (overlay) **không đổi tên, không đổi nghĩa**: `verified` chỉ khi admin xác minh.

**H4. Nhãn hiện thống nhất ở mọi bề mặt; không vendor nào hiện giá mà thiếu nhãn.** Back là nơi duy nhất tạo nhãn; app chỉ vẽ nguyên văn `price_label`.
- API cặp đôi: `GET /api/vendors/match` (từng vendor), `GET /api/vendors/:id` (`vendor`), `POST /api/vendors/status` (từng mục), thêm `price_basis`, `price_as_of`, `price_label` cạnh `priceMin/priceMax/price_source` (chỉ khi pool có nguồn giá hợp lệ, xem H3).
- Chat: `chatMatch().matches[i]` thêm `price_basis`, `price_as_of`, `price_label`; khối `[VENDOR CANDIDATES]` ghi `   Giá: <min>-<max>tr (<nhãn viết thường chữ đầu>)`, vd `Giá: 3-7tr (ước tính theo hạng mục)`, `Giá: 7-9tr (giá đã xác minh)`; vendor không có nguồn giá hợp lệ vẫn `(giá ước tính)` như hôm nay. Phần "Hướng dẫn trả lời" thêm đúng một dòng: `- Khi nhắc đến giá của một vendor, luôn kèm nhãn giá trong ngoặc đúng như trong danh sách trên.` Nhãn trong **câu trả lời tự do của LLM** là mong muốn chứ không bảo đảm máy kiểm được (eval kiểm khối, metadata và hướng dẫn; thẻ vendor trong chat vẽ từ API nên chắc chắn có nhãn).
- Câu AI "vì sao hợp" ở màn chi tiết: dòng giá trong prompt thành `giá <min>–<max>tr (<price_label>)` khi có nhãn. Không đổi khoá cache; câu đã cache trước đó giữ tới khi hash hồ sơ đổi.
- App cặp đôi (tab Vendor: danh sách, chi tiết; thẻ chat; danh sách đã lưu; màn Ngân sách): mỗi chỗ hiện số giá vendor hiện kèm nhãn `price_label`; chữ nhãn kiểu cũ `giá ước tính` **không** hiện khi API có `price_label`. API cũ không có `price_label` (hoặc vendor chưa có nguồn giá): hiện nhãn dự phòng `giá ước tính`/`giá đã xác minh` theo `price_source`, và **luôn có một nhãn khi có giá** (kể cả khi `price_source` thiếu). Danh sách đã lưu (`ScreenVendorShortlist`) hôm nay không có nhãn: thêm, lấy nhãn trực tiếp từ trạng thái vendor (`/api/vendors/status`), thiếu thì nhãn dự phòng. Vendor đã lưu mà giá hiện tại khác giá lúc lưu: dòng "giá đã cập nhật" kèm nhãn của giá hiện tại.
- Admin: `GET /api/admin/vendors` (mỗi hàng, kể cả hàng mồ côi có giá overlay) và `GET /api/admin/vendors/:id` (`effective`) thêm ba trường trên; tham số `label` có thêm `estimate_category` (khớp `price_basis` là `estimate_category` hoặc `estimate_default`) và `legacy_marry`; `estimated`/`verified` giữ nghĩa cũ. Bảng "Dữ liệu vendor" cột Nhãn hiện `price_label` (thay chữ cố định); ô chọn Nhãn có thêm "Ước tính theo hạng mục" (`estimate_category`) và "Giá marry.vn" (`legacy_marry`), mục cũ "Giá ước tính" đổi chữ thành "Chưa xác minh" (vẫn `estimated`). Drawer vendor (bảng enrich): mục "Kết quả trong pool" có dòng `Nhãn giá: <price_label>` lấy từ `effective` (đã tính overlay) khi tải được lớp sửa, nếu không thì từ `pool.vendor` của API chi tiết; không hiện hai nhãn mâu thuẫn. API chi tiết enrich `…/vendor-enrich/<id>/detail` thêm ba trường vào `pool.vendor` (tính từ pool, không overlay); `field_notes` (`price_default`…) **không đổi** (T-147 check 3, T-151 adv-03).

**H5. Ảnh hưởng lên ghép vendor (mặc định A, xem Câu hỏi mở).**
- **Giá ước tính được dùng như giá cũ**: `priceMin/priceMax` của khung (hoặc giá mặc định) đi vào đúng các công thức hiện có: lọc cứng chat `priceMin > ngân sách hạng mục` (nới ×1,2 như T-140), `budgetScore` (≤ ngân sách = 1; vượt ≤ 20% giảm tuyến tính; vượt hơn = 0), thứ tự, MMR, R8. Không đổi công thức, trọng số, ngưỡng nào. Phép thử tương đương: chỉ đổi `priceSource` của một pool từ `estimate_*` sang `legacy_marry` (giữ số) thì danh sách chat (id, thứ tự, việc nới) và điểm/thứ tự tab **giống hệt**.
- **Giá ước tính không là bằng chứng cho lời khẳng định về ngân sách** (đây là chỗ đổi hành vi duy nhất so với hôm nay; chỉ vendor `price_basis` là `estimate_*`): (a) không có chip `Trong ngân sách`/`Rẻ hơn Ntr` dù điểm ngân sách = 1; (b) câu danh sách `whyThoseVendors`: vendor ước tính **không** được đếm vào "nằm trong tầm giá" (mẫu số vẫn là mọi vendor trong danh sách, nên `Phần lớn`/`Một vài` chỉ ra khi đủ vendor giá riêng); (c) vế "giá dao động A–Btr" chỉ tính vendor không phải ước tính, không có vendor nào thì bỏ vế đó. Vendor không có `price_basis` (pool cũ) và `legacy_marry`/`admin*` giữ y như cũ.
- Hệ quả nói thẳng: số giá của ~80% pool (703/867) đổi từ giá mặc định sang khung (vd venue mặc định 5-15 mỗi bàn → 3,0-7,3; decor 10-50 → 2,4-69,9; photography 15-30 → 4,0-15,3; makeup 3-8 → 9,8-19,5), nên xếp hạng chat/tab đổi theo số mới dù công thức giữ. T-159 (phân bổ dự toán), inv-037..041 không đổi định nghĩa: chúng chạy trên pool đông cứng **không** có `priceSource` nên vẫn xanh nguyên (đo ở eval 8); `inv-038 (v)` (ứng viên có giá thì `price_range` = giá pool ×1e6 và `min_vnd` ≤ ngân sách, nới thì ≤ ×1,2) vẫn đúng với vendor ước tính vì lọc cứng giữ nguyên.
- Phương án B (trung tính 0,5, không lọc theo khung) **không làm** ở việc này: đổi xếp hạng của ~80% pool và đổi `inv-038 (v)`; nếu muốn thì việc riêng, đo lại bằng bộ T-074.

**H6. Pool và bundle.** Pool có `priceSource` và `priceAsOf` ở **mọi** vendor sau khi sinh lại; bundle `worker.js` nén ≤ 1.000.000 byte (inv-007); không vendor nào mất khỏi pool; không trường nào khác của vendor đổi.

## Ràng buộc (vòi)
- Repo và nhánh: `phungrk/tohong` · `t-164-gia-n4-generator`; `phungrk/tohong-back` · `t-164-gia-n4-nhan` (code) và `t-164-gia-n4-pool` (pool sinh lại); `phungrk/tohong-front` · `t-164-gia-n4-nhan`. Vùng: `planner/vendor/images`.
- Bất biến đã đọc: `_shared/`; `planner/` inv-001..007 (inv-007 bundle: đo ở eval 7); `planner/vendor/pool` inv-001..004 và `planner/vendor/images` inv-012/013/014/021/022 (pool, trường mới không phá, eval 8); inv-037..041 (eval 8). Không vi phạm; **không** đề nghị đổi bất biến có sẵn.
- **Eval có sẵn sẽ đỏ nếu cài sai chỗ** (không sửa chúng): T-140 check 7 và T-143 adv-01 băm toàn bộ phản hồi trên pool đông cứng → vì vậy H3 "pool cũ không thêm trường". T-147 check 3 / T-151 adv-03 đo `field_notes` → không đổi `field_notes`. Lưu ý (không đổi): sau khi sinh lại pool, 57 vendor bị dọn sẽ có `field_notes` kiểu `kept_from_base` ở giá vì giá nguồn khác pool; chữ "giữ từ pool nền" ở đó lúc này hơi lệch nghĩa, không sửa ở việc này.
- Kiến trúc: nhãn và nguồn giá tính ở một hàm thuần trong back (dùng chung overlay, chat, tab, admin); front không tự dựng nhãn; không thêm khoá/secret; không `nodejs_compat`.
- Không chạm: payment, auth, schema DB, R2 schema (`vendor_overrides.json`, `budget.json`), dữ liệu cặp đôi, `vendors.json`, workflow, N3, liên hệ vendor, cam kết giá với vendor.
- Bậc đề xuất: **B** (logic nghiệp vụ và dữ liệu giá, không chạm ranh giới cứng, đảo ngược bằng revert; ADR-089).

### Chia PR và thứ tự merge
1. **tohong** (PR 1, merge trước): `tools/generate-vendor-pool.js` (H1, H2, `--as-of`, `--prices-only`; bảng ngưỡng nằm trong một file cấu hình dưới `tools/` hoặc trong generator), kiểm `build_pool.py` giữ `price_range` và `last_scraped` trong `pool-vendors.json` (thiếu thì sửa), ghi cách chạy vào README. Không chạm `vendors.json`. Eval 1, 2.
2. **tohong-back** (PR 2, code): hàm nguồn giá + nhãn, `lib/vendorOverlay.js`, `lib/chatMatcher.js`, `lib/matchFormatter.js`, `lib/vendorMatcher.js` (H5), `api/vendors.js`, `api/admin.js`, `lib/vendorEnrich.js` (chỉ `pool.vendor`). Chạy được với pool cũ (không trường mới). Rebase sau T-159 nếu T-159 vào trước (không phụ thuộc nghĩa). Eval 3, 4, 6, 8.
3. **tohong-back** (PR 3, dữ liệu): pool sinh lại bằng generator của PR 1 (`--prices-only` trên pool hiện hành, `--as-of` = ngày sinh); chỉ đổi bốn trường giá. Merge **sau** PR 2. Eval 7 (+ inv-007).
4. **tohong-front** (PR 4): `PriceTag`, `VendorChatCards`, `Vendors.jsx`, `Budget.jsx`, `admin/VendorData.jsx`, `admin/EnrichDrawer.jsx`. Merge **sau** PR 2 (đứng trước PR 3 cũng được: thiếu `price_label` thì nhãn dự phòng). Eval 5.
Rollback: revert ngược thứ tự 4 → 3 → 2 → 1; revert PR 3 đưa pool về giá cũ, API thôi có trường mới, app tự dùng nhãn dự phòng.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; repo qua `TOHONG_REPO` / `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO`, mặc định cạnh `tohong-hq`. Eval dùng fixture `eval/T-164/fixtures/` (ảnh chụp 2026-11-14: 867 bản ghi đầu vào generator và đầu ra đúng theo spec), không mạng, không Google, không ghi vào repo thật. Mỗi tiêu chí đúng một eval.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Giá rác bị loại theo H1 (đơn vị, hai đầu trong ngưỡng, thứ tự, last_scraped): đúng 57 vendor bị loại và 164 giữ; ca biên (sát đáy/trần, đơn vị, 0, thiếu ngày); nguồn không bị ghi | `bash eval/T-164/check_1_don_gia_rac.sh` |
| 2 | Khung N4 đúng H2 cho cả 867 vendor; `--prices-only` chỉ đổi bốn trường, tự sửa ước tính bị sửa tay, idempotent; không phụ thuộc thứ tự; tính lại khi đổi một giá, không đổi khi thêm giá rác; ranh giới 9/10 mẫu; ranh giới 365/366 ngày | `bash eval/T-164/check_2_khung_n4.sh` |
| 3 | Thứ tự nguồn giá và nhãn của một vendor (admin_verified > admin > legacy_marry > estimate), tuổi 180 ngày, pool cũ không thêm trường, `price_source` cũ giữ nghĩa | `bash eval/T-164/check_3_thu_tu_nguon_va_nhan.sh` |
| 4 | Mọi bề mặt back cùng một nhãn và không có giá thiếu nhãn: status (867), match (mọi hạng mục), chi tiết, chat (khối, metadata, hướng dẫn), admin (hàng, bộ lọc, chi tiết) | `bash eval/T-164/check_4_nhan_moi_be_mat_back.sh` |
| 5 | Front: nhãn nguyên văn ở danh sách và chi tiết chat, danh sách đã lưu, màn Ngân sách (kể cả "giá đã cập nhật"), nhãn dự phòng với API cũ; admin: cột Nhãn, bộ lọc, drawer (có/không lớp sửa, overlay đè nhãn pool) | `bash eval/T-164/check_5_nhan_front.sh` |
| 6 | Ghép vendor mặc định A: ước tính dùng như giá cũ (tương đương 5 hạng mục × 3 ngân sách, chat và tab); không chip/câu khẳng định ngân sách từ ước tính; prompt câu AI có nhãn; pool cũ giữ chip | `bash eval/T-164/check_6_ghep_vendor.sh` |
| 7 | Pool sinh ra có nguồn giá ở mọi vendor, giá riêng trong ngưỡng, khung tính lại được từ chính pool, bundle ≤ 1MB (inv-007) | `bash eval/T-164/check_7_pool_va_bundle.sh` |
| 8 | Hồi quy: T-159 check 2 và 8 (và 1..10 khi T-159 đã vào), T-140 check 7, T-143 adv-01, inv-037..041, bất biến pool inv-001..004 và images inv-012/013/014/021/022 vẫn xanh | `bash eval/T-164/check_8_hoi_quy.sh` |
Biến phụ: `T164_ALL=1` in toàn bộ lỗi (eval 3, 4, 5a, 6). Eval 5 cần Playwright (`PLAYWRIGHT_PATH` nếu không tự thấy), tự `vite build` (phần admin) và vite dev (phần app cặp đôi).

**Đã chạy thử (nói thẳng).** Trên `main` hiện tại: #1-#7 **đỏ** (FAIL, không ERROR), #8 **xanh sẵn** (hàng rào chống hồi quy). **Đã thử xanh trên bản cài tối thiểu viết ở thư mục tạm của phiên, không nằm trong repo nào:** #1, #2 (generator ~60 dòng), #3, #4, #6, #8 (back: hàm nguồn giá + nhãn + sửa chip/câu/prompt/admin, ~50 dòng), #5 (front: `PriceTag`, 6 chỗ truyền nhãn, danh sách đã lưu, admin), #7 (pool đóng dấu theo fixture: bundle 775.713 byte), cùng ba bất biến đề xuất. Chưa thử: sinh lại pool thật bằng generator thật trên `pool-vendors.json` thật (file trung gian không nằm trong git; fixture thay thế nó, **giả định** `build_pool.py` giữ `price_range` và `last_scraped`, Engineering kiểm ở PR 1).

## Bất biến đề xuất (tầng 2)
Ba bất biến chạy được, `PASS "chưa áp dụng"` trên `main` (ADR-028), nằm ở `eval/T-164/bat-bien-cho-merge/`:
- **INV-A · Pool có nguồn giá trung thực và khung tính lại được từ chính pool** (`inv-xxx-pool-gia-co-nguon-va-khung-nhat-quan.py`): H1(b,c) cho mọi `legacy_marry` (giá rác không bao giờ quay lại), H2 cho mọi vendor ước tính (P25-P75 hoặc mặc định theo n ≥ 10, `priceAsOf`), nhất quán `priceSource` ↔ `priceAsOf`. Áp dụng dở dang (có vendor có `priceSource`, có vendor không) là đỏ. Sinh ra vì pool là dữ liệu sinh ra và mọi lần sinh lại (T-110, P2) có thể lặng lẽ làm lệch.
- **INV-B · Không bề mặt API nào trả giá mà thiếu nhãn** (`inv-xxx-gia-hien-ra-luon-co-nhan.py`): pool thật, worker thật, bốn trạng thái overlay (không, giá chưa xác minh, giá đã xác minh, chỉ xác minh); status (mọi id), chi tiết, match đều có `price_label` + `price_basis` hợp lệ khi có giá. Giữ cho các bề mặt mới (route mới, P1/P2) không quên nhãn.
- **INV-C · Ước tính dùng như giá nhưng không là bằng chứng khẳng định ngân sách** (`inv-xxx-uoc-tinh-khong-lam-bang-chung-khang-dinh-ngan-sach.py`, chạy nội dung eval 6): phép thử tương đương + không chip/câu khẳng định. Giữ cho engine ghép sau này (đổi `budgetScore`, T-161) không biến một khung ước tính thành "trong ngân sách" mà không ai quyết.
Vùng gợi ý: `planner/vendor/images` (hoặc `planner/vendor/matching` cho INV-C nếu Spec critic thấy hợp hơn).

## Không làm
- N3 (hỏi cặp đôi báo giá, bậc C), N1/N2 (crawler, tìm kiếm bài bên thứ ba), nguồn giá riêng có nguồn (bậc 2 ở H3 chưa có dữ liệu), `refresh-vendor-prices.yml` hay lịch tự sinh lại pool (P2).
- Sửa `vendors.json`, `manual_overrides.json`, workflow, `build_enrich_report.py` (chỉ kiểm nó không bị vỡ khi pool có trường mới), `field_notes` của drawer; sửa hạng mục sai của vendor (TRUNG VO, Nệm Liên Á…); sửa đơn vị "gói" của thiệp (chỉ loại giá rác, không đoán lại đơn vị).
- Đổi công thức `budgetScore`, trọng số, MMR, R8, nới ×1,2, T-159 H1-H8; đổi `price_source` cũ; đổi schema R2; đổi TTL overlay.
- Bảo đảm nhãn trong câu trả lời tự do của LLM; sinh lại câu AI đã cache.
- Liên hệ vendor, cam kết giá, gọi Google, ghi dữ liệu người dùng.

## Câu hỏi mở
**Giá ước tính có được dùng để lọc và chấm điểm vendor như giá thật không?** Mặc định (đã cài vào spec và eval 6): **có, như hôm nay**, vì đổi sẽ đổi xếp hạng của ~80% pool (703/867) và đổi `inv-038 (v)`; bù lại ước tính không được dùng để nói "trong ngân sách" (H5). Phương án thay: coi ước tính là trung tính 0,5 và không lọc cứng theo khung. Capu không trả lời thì giữ mặc định; nếu muốn phương án thay thì là việc riêng, đo lại bằng bộ T-074.
