# Spec T-110: duyet-tay-venue

## Ý định
Capu tự tra Google Maps cho 4 venue mà enrich không nhận (ADR-048) và muốn quyết định của mình **thắng luật tự động**, ghi vào một file mà mọi lần enrich sau đều tôn trọng: nhận khớp theo link Google Maps, loại vendor (khôi phục được), đánh dấu tạm đóng cửa để lần sau thử lại. Nguồn: `board/T-110.md`, `decisions/2026-11-08-adr-048-capu-duyet-tay-4-venue.md`, `products/T-106-enrich-venue.md` (v4.1, sáu cổng), `decisions/2026-11-08-adr-044-nha-hang-dong-cua-tren-google.md`.

## Bằng chứng
- Hiện trạng 4 venue (đo 2026-11-08 trên `tohong` main sau #72, `tools/scraper/output/HCMC/venue/`):
  - Én `marry_d4380c0b3cf3`: audit `no_match` (Google không trả gì), địa chỉ gốc "Lầu 7 tòa nhà Robot Tower, 308C Điện Biên Phủ…", pool có 1 ảnh nguồn `marry`.
  - Tự Do `marry_e38f1e755f9c`: audit `no_match`; còn trong `vendors.json` và pool (3 ảnh `marry`).
  - Pergola `marry_2ee808943c08`: audit `low_confidence`, `reject_reason=low_score`, `confidence=0.226`, `address_match=true` ("Pergola Garden Restaurant", cùng 28A Trần Cao Vân), `candidate_place_id` rỗng.
  - Thiskyhall `marry_f8b40ba4ddef`: audit `low_confidence`, `low_score`, `confidence=0.455`, `address_match=false` ("Trung tâm hội nghị Thiskyhall Sala").
  - Cả 4 chưa có `place_id`/`google_photos`; 99 dòng audit (62 enriched, 26 low_confidence, 6 no_match, 5 closed_permanently) và 94 vendor trong `venue/vendors.json`.
- Code hiện tại (đọc 2026-11-08, `tohong` @386392c): `enrichment/settle.py` `ATTEMPTED_STATUSES` gồm `low_confidence`, `no_match`: vendor có dòng audit **không bao giờ** được tìm lại, nên Pergola không thể "thử lại ở lần enrich sau" nếu không có ngoại lệ. `closed_addresses()` chọn hàng đã gỡ bằng chuỗi con `CLOSED_PERMANENTLY` trong `reason`. `pipeline._apply_enrichment` hiện nhận khớp ứng viên `CLOSED_TEMPORARILY` bình thường kèm cờ `temporarily_closed` (ADR-044 mục 2); hiện **0 vendor** có cờ này (đếm trên mọi `vendors.json` HCMC).
- Phiên cloud không mở được `share.google` (proxy chặn, brief T-110, ADR-048). Không có cách đổi link ra place_id offline, nên bước đổi phải chạy trong workflow GitHub (có `GOOGLE_MAPS_API_KEY`, có mạng ra ngoài).
- Phụ thuộc đã kiểm: INV-012..019 đều nằm trong `eval/invariants/planner/vendor/images/` và xanh (`gate.py T-110`, 2026-11-08); INV-016..019 đã được chuyển vào bể sau #72.
- Tự tin: ~75% rằng đặc tả đủ để Engineering làm một lần; phần mong manh nhất là đọc tên địa điểm từ URL Maps sau khi mở `share.google` (chưa mở thử được, xem Hành vi 5 và "Rủi ro").

## Giả thuyết
Nếu có file duyệt tay mà code tôn trọng thì 4 quyết định ADR-048 áp được bằng đúng một lượt workflow (≤ 9 request Google), và mọi lần Capu tra tay sau này không cần sửa code hay nới luật. Chỉ số: số venue có ảnh Google 62/94 → 64/93 (Én và Thiskyhall vào, Tự Do ra). Chỉ số bảo vệ: INV-012..019 xanh; không vendor nào ngoài 4 vendor trên đổi trạng thái; tháng 11 không vượt 1.000 request SKU Photos.

## Hành vi (người dùng thấy gì)
"Người dùng" ở đây là Capu (người duyệt) và cặp đôi (người xem card Tiệc & nhà hàng). Cặp đôi chỉ thấy hệ quả: Én và Thiskyhall hiện ảnh thật có ghi công, Tự Do không còn trong danh sách, Pergola vẫn hiện ảnh minh hoạ.

### 1. File duyệt tay (manual overrides)
1. **Vị trí:** `tools/scraper/output/HCMC/manual_overrides.json` (repo `tohong`; cấp thành phố vì một vendor có thể nằm ở nhiều category file và các cổng G4/G6 xét cả thành phố). Không thuộc category nào nên các lệnh `--all`/`--category` không coi nó là `vendors.json`.
2. **Schema** (JSON; mọi chuỗi UTF-8):
   ```json
   {"schema_version": 1,
    "overrides": [
      {"vendor_id": "marry_d4380c0b3cf3",
       "action": "accept_place",
       "maps_link": "https://share.google/tYZdblcikIDPqVJX6",
       "place_id": null,
       "resolved": null,
       "reason": "Capu: có trên Google Maps",
       "approved_by": "capu",
       "approved_on": "2026-11-08",
       "decision": "decisions/2026-11-08-adr-048-capu-duyet-tay-4-venue.md"}]}
   ```
   - `vendor_id` (bắt buộc, duy nhất trong file), `action` ∈ {`accept_place`, `remove`, `temporarily_closed`, `reject_match`}, `reason` (bắt buộc, không rỗng), `approved_by` (bắt buộc, **chỉ** `"capu"`), `approved_on` (bắt buộc, `YYYY-MM-DD`), `decision` (bắt buộc: đường dẫn tương đối trong repo `tohong-hq` tới một file `decisions/…` có dòng `decided_by: capu` và nhắc `vendor_id`; bằng chứng rằng Capu quyết, đúng giá trị "Sổ cái là sự thật").
   - Mục tiêu theo hành động: `accept_place` cần `maps_link` **hoặc** `place_id` (ít nhất một); `reject_match` cần `place_id` (place_id bị loại); `remove` và `temporarily_closed` **không** mang `maps_link`/`place_id`.
   - `maps_link` chỉ nhận host `share.google`, `goo.gl`, `maps.app.goo.gl`, hoặc `google.com/maps…` (https).
   - `resolved` (chỉ `accept_place`, **do bước resolve ghi**, Hành vi 5): `{place_id, name, formatted_address, business_status, resolved_at, resolved_from}`; `resolved_from` ∈ {`link`, `place_id`}. Nếu `place_id` và `resolved.place_id` cùng có thì phải bằng nhau.
3. **Ai được ghi:** (a) **Capu**, qua commit/PR vào `tohong` (bậc C: Capu tự merge); mỗi mục phải có `decision` của Capu. Agent chỉ được soạn mục khi đã có quyết định của Capu trong `decisions/`, không tự thêm. (b) **Bước resolve** (Hành vi 5), chỉ được điền `place_id` và `resolved` của mục `accept_place`; mọi trường khác và mọi mục khác giữ nguyên byte. (c) **Không ai khác**: `enrich.py`, `enrichment/settle.py`, `refresh_photos.py` chỉ đọc; chạy xong file giữ nguyên byte.
4. **Kiểm khi nạp (mọi lần chạy `enrich.py`, trước khi làm bất cứ gì):** file sai thì dừng, **không gọi Google, không đổi file nào trong `output/`**, in `OVERRIDE_FILE_INVALID <mã> [<vendor_id>]: <giải thích>`, mã thoát 2. Mã: `bad_json`, `bad_schema_version`, `unknown_action`, `missing_field`, `bad_approver`, `bad_date`, `duplicate_vendor`, `missing_target`, `unexpected_field`, `bad_link`. Không có file thì `enrich.py` chạy như trước (không lỗi).
5. **Lỗi từng mục** (file hợp lệ nhưng một mục không áp được): in `OVERRIDE_ERROR <vendor_id> <mã>: <giải thích>`, mục đó **không áp** (vendor giữ trạng thái tự động), các mục khác vẫn áp, mã thoát cuối là 2. Mã: `unknown_vendor` (id không có ở vendors.json hay removed_vendors.json nào của thành phố), `unresolved` (accept_place chưa có `resolved`), `out_of_province` (địa chỉ Google ngoài tỉnh/thành, INV-016), `place_conflict` (hai mục accept_place cùng place_id mà địa chỉ gốc hai vendor khác nhau theo G6: **cả hai** mục lỗi, INV-017), `place_closed_permanently` (dùng `remove`), `place_temporarily_closed` (dùng `temporarily_closed`). Cuối lần chạy in `OVERRIDE_SUMMARY applied=<n> errors=<m>`.

### 2. Bốn hành động (áp cho **mọi** category file HCMC có id đó)
- **`accept_place`** — Capu xác nhận vendor là địa điểm Google này.
  - Điều kiện: `resolved` có; `business_status` = `OPERATIONAL` (hoặc vắng); địa chỉ Google thuộc tỉnh/thành của vendor (`in_province`); không `place_conflict`.
  - Hiệu lực: vendor ghi `enrichment_log[source=google_maps]` mới với `place_id`, `matched_name`=`resolved.name`, `formatted_address`, `address_match` **tính bằng hàm chuẩn** từ `contact.address_source`, `confidence` = **1,0** (quy ước: người xác nhận = chắc chắn; `name_similarity` ghi số đo tên thật để Capu so), `manual_override: true`, `changes.address`. `contact.address` = `formatted_address` (như nhận khớp tự động), `contact.address_source` giữ nguyên (ghi từ `contact.address` nếu chưa có). Vendor đang có place_id **khác**: về trạng thái "như chưa từng khớp" (như `demote_record` của settle) rồi mới ghi cái mới, ảnh cũ bị xoá. Cùng place_id đã ghi `manual_override`: không làm gì.
  - Dòng audit (mọi category file có vendor): `status=enriched`, `place_id`, `matched_name`, `confidence=1.0`, `formatted_address`, `address_match`, `manual_override="accept_place"`, **không** `reject_reason`. Dòng `review-needed.csv` của vendor (nếu có) bỏ cờ `low_confidence_place` + mã lý do và xoá hai cột Google (không xoá dòng), như vendor được nhận.
  - Ảnh: **không** do bước enrich lấy; vendor có `place_id` mà chưa có `google_photos` thì `refresh_photos.py` (bước có sẵn của workflow venue) lấy: Place Details + media, ≤ `--max-photos` ảnh, mỗi ảnh có ghi công (INV-013). Không ghi phone/website/rating/reviews/toạ độ từ Google (không có dữ liệu để ghi).
- **`remove`** — loại vendor khỏi danh sách, khôi phục được.
  - Vendor biến mất khỏi `vendors.json` của **mọi** category file HCMC có id đó. Mỗi category file được gỡ có một bản ghi trong `removed_vendors.json` cùng thư mục: `{removed_at, reason, vendor, manual: true}`, `reason` = `"manual_override: remove — " + <reason của Capu>`, `vendor` = bản ghi **nguyên vẹn** (bằng nhau từng trường) trước khi gỡ. Dòng audit giữ nguyên.
  - **Không** vào tập G4: `closed_addresses()` chỉ lấy bản ghi có `reason` chứa `CLOSED_PERMANENTLY` **và không có `manual: true`** (kể cả khi lý do của Capu có chữ đó).
  - Vendor bị `remove` không bao giờ bị Text Search, bị nhận khớp hay đưa lại bởi lần enrich nào.
  - Không vào pool (Hành vi 8).
- **`temporarily_closed`** — Capu đánh dấu: không nhận, không gỡ, lần enrich sau thử lại. Chi tiết ở Hành vi 6. Nếu vendor **đã có** place_id thì không đổi gì (in `OVERRIDE_NOTE <vendor_id> already_matched`); muốn bỏ ảnh của vendor đã khớp thì dùng `reject_match` hoặc `remove`.
- **`reject_match`** — dự phòng, Capu nói "place_id này sai cho vendor này".
  - Vendor đang khớp đúng `place_id` đó: về trạng thái "như chưa từng khớp"; dòng audit `status=low_confidence`, `reject_reason="manual_reject"`, `candidate_place_id` = place_id bị loại, `manual_override="reject_match"`; đúng một dòng `review-needed.csv` có cờ `low_confidence_place` và `manual_reject`.
  - Vendor chưa khớp mà Text Search sau này trả đúng `place_id` đó: từ chối với mã `manual_reject` như trên. Ứng viên **khác** đi qua sáu cổng bình thường. Vendor được xét tiếp theo luật `ATTEMPTED` thông thường (không retry).

### 3. Thứ tự ưu tiên: duyệt tay thắng luật tự động, bất biến thắng duyệt tay
1. Mỗi lần chạy `enrich.py` (kể cả **lệnh áp lại offline**, không khoá API, mọi HTTP bị chặn), thứ tự là: nạp + kiểm file duyệt tay → áp `remove` → áp `accept_place`/`reject_match`/`temporarily_closed` → Text Search cho vendor đủ điều kiện (trừ vendor có mục duyệt tay) → `settle` (G4, G6, áp lại cổng) với **duyệt tay được ghim** → ghi audit/review.
2. Vendor có mục `accept_place` **đã áp** là *ghim*: `settle` không bao giờ hạ nó, bất kể cổng nào, và lần chạy lại offline không đổi nó.
3. Cổng nào bị duyệt tay thắng:

| Cổng | Với vendor có `accept_place` | Với vendor khác |
| --- | --- | --- |
| G1 điểm số | thắng (không xét `confidence` tự đo) | như cũ |
| G2 tỉnh/thành | **không thắng**: INV-016 là bất biến; ngoài tỉnh → `OVERRIDE_ERROR out_of_province` | như cũ |
| G3 tên đường | thắng | như cũ |
| G4 trùng địa chỉ nhà hàng đã đóng | thắng (chủ thể duyệt tay không bị G4) | **tập G4 không nhận** địa chỉ của vendor bị `remove` hay `temporarily_closed` (chỉ nhà hàng Google báo `CLOSED_PERMANENTLY`) |
| G5 địa chỉ xác nhận được | thắng | như cũ |
| G6 một place_id một địa chỉ gốc | vendor ghim **vẫn là thành viên nhóm** nhưng **không bao giờ bị hạ**; vendor tự động chung place_id mà địa chỉ gốc khác thì **bị hạ** `shared_place_id` (INV-017 vẫn đúng). Hai vendor ghim chung place_id khác địa chỉ gốc: `place_conflict` cho cả hai mục, không mục nào áp | như cũ |

4. Đảo thứ tự vendor trong file, chạy `--category` nào trước, chạy lại bao nhiêu lần: kết quả mỗi vendor như nhau (xem Hành vi 4).
5. Không đổi định nghĩa các hàm chuẩn `address_match`, `reject_reason`, `shared_place_id_groups` (INV-018 khoá code bám hàm chuẩn); lớp duyệt tay nằm **ngoài** chúng.

### 4. Chạy lại và thứ tự
- Chuỗi lệnh của workflow (Hành vi 9): `resolve_overrides.py` → `enrich.py --category venue` → `refresh_photos.py` → (áp lại) `enrich.py --category venue`. Chạy lại **cả chuỗi** lần hai: mọi file trong `output/` (kể cả `manual_overrides.json`, audit, `removed_vendors.json`, `review-needed.csv`, `vendors.json`) **giữ nguyên byte**, kể cả dấu thời gian (không ghi lại file khi không có thay đổi); `resolve` và `refresh` gọi 0 request; `enrich` chỉ gọi Text Search cho vendor đang "thử lại" (Hành vi 6).
- `GOOGLE_USAGE text_search=<n> photo_details=<n> photo_media=<n>` (dòng cuối stdout của mỗi CLI chạy thật, như T-106 hành vi 7) phải bằng số request thật. `resolve_overrides.py` in `text_search`=số Text Search, `photo_details`=số Place Details, `photo_media=0`.

### 5. Đổi link `share.google` thành place_id
- **Chạy ở đâu:** chỉ trong workflow GitHub mới `.github/workflows/resolve-overrides.yml` (`workflow_dispatch`, secret `GOOGLE_MAPS_API_KEY`), bước `python resolve_overrides.py --state HCMC`. Phiên cloud/`enrich.py`/`refresh_photos.py` **không bao giờ** mở `share.google`/`goo.gl`/`maps.app.goo.gl`; `accept_place` chưa có `resolved` ở `enrich` là `OVERRIDE_ERROR <id> unresolved`, không đoán.
- **Cách đổi, với mỗi mục `accept_place` chưa có `resolved`:**
  - Có `maps_link`: mở link bằng HTTP thường (chuyển hướng; **không** tính là request Places) tới URL Maps đích; lấy tên địa điểm ở đoạn `/maps/place/<tên>/` (giải mã %, `+`=cách) và toạ độ `@lat,lng` nếu có. Nếu URL có sẵn place_id dạng `ChIJ…` (tham số `query_place_id`/`placeid`) → đúng **1 lượt Place Details**. Nếu không → đúng **1 lượt Text Search** với tên đó.
  - Ứng viên được nhận chỉ khi tên của nó, sau chuẩn hoá (bỏ dấu, `đ`→`d`, chữ thường, bỏ mọi ký tự không phải chữ/số), **bằng** tên trong URL, và (nếu URL có toạ độ và ứng viên có vị trí) cách nhau ≤ 300 m. Khác thì lỗi, **không** lấy "gần đúng".
  - Chỉ có `place_id`: đúng 1 lượt Place Details để điền `resolved`.
- **Ghi:** thành công → điền `place_id` và `resolved` (`resolved_from`=`link`|`place_id`), in `RESOLVED <vendor_id> <place_id>`. Lỗi → **mục không đổi một byte**, in `RESOLVE_ERROR <vendor_id> <mã>: <giải thích>`, mã ∈ {`link_unreachable` (HTTP lỗi/hết giờ/không chuyển tới Google Maps), `link_no_place_name` (URL đích không có tên địa điểm và không có place_id), `search_no_result`, `name_mismatch`, `location_mismatch`, `place_not_found` (Place Details 404)}; mã thoát cuối 1; các mục khác vẫn xử lý. Mục đã có `resolved` bị bỏ qua (0 request, kể cả mở link).
- **Số request:** ≤ 1 lượt Places mỗi mục. Hai link ADR-048 = **≤ 2 lượt Places** (Text Search/Place Details), trong hạn mức miễn phí; không tải ảnh ở bước này.

### 6. Trạng thái tạm đóng cửa
- **Hai nguồn:** (i) Capu đánh dấu (`temporarily_closed`), (ii) Google trả `businessStatus=CLOSED_TEMPORARILY` cho ứng viên của vendor chưa có place_id. **Thay** ADR-044 mục 2 và dòng "CLOSED_TEMPORARILY vẫn được nhận khớp" ở Hành vi 1 của T-106 cho các lần nhận khớp **mới** (hiện 0 vendor bị ảnh hưởng); vendor đã có place_id không bị xét lại.
- **Hiệu lực chung:** vendor **còn** trong `vendors.json` (không bao giờ vào `removed_vendors.json`), **không** `place_id`, **không** `google_photos`, hiện ảnh minh hoạ như cũ; dòng audit của vendor có `retry: true`.
- **Dòng audit:**
  - (i) Capu đánh dấu: dòng audit hiện có giữ `status`/`reject_reason`/ứng viên (Pergola: `low_confidence` + `low_score`, vì INV-015 đòi ứng viên bị luật từ chối phải là `low_confidence`), thêm `manual_override="temporarily_closed"`, `retry=true`. Chưa có dòng: tạo `{vendor_id, status:"temporarily_closed", manual_override:"temporarily_closed", retry:true}`.
  - (ii) Google báo tạm đóng: ứng viên qua mọi cổng → `status="temporarily_closed"`, `matched_name`, `confidence`, `formatted_address`, `address_match`, `candidate_place_id`, `retry=true`, **không** `place_id`; ứng viên bị cổng nào từ chối → `status="low_confidence"` + `reject_reason` như thường, thêm `retry=true`. Vendor không vào `review-needed.csv` chỉ vì tạm đóng cửa (dòng review do `low_confidence` quyết định).
- **Ngoại lệ của luật "không tìm lại vendor đã có audit":** vendor có dòng audit `retry=true` **luôn** được Text Search ở mỗi lần `enrich.py` (kể cả có dòng audit `low_confidence`, `no_match`, `temporarily_closed`). Mọi vendor khác có audit vẫn không bị tìm lại. Kết quả lần thử mới **thay** dòng audit; `retry` chỉ còn khi lý do còn: mục `temporarily_closed` của Capu còn trong file, hoặc Google vẫn báo `CLOSED_TEMPORARILY`.
- Hết lý do (Google báo mở lại và qua cổng → nhận khớp bình thường, `enriched`, hết `retry`; hoặc Capu xoá mục và Google không còn báo đóng): thử lại đúng một lần nữa rồi dừng; vendor có place_id không bị tìm lại. `CLOSED_PERMANENTLY` đúng ứng viên vẫn gỡ như ADR-044, không `retry`.
- **Giới hạn đã biết (Pergola):** thử lại chạy lại **luật tự động**. Ứng viên Pergola có `confidence=0.226` < 0,4 nên G1 vẫn từ chối dù Google mở lại; T-110 chỉ đảm bảo vendor được thử lại, **không** đảm bảo nhận. Cách nhận: T-109 nới G1 khi địa chỉ trùng khít, hoặc Capu đổi mục thành `accept_place` khi Google mở lại.

### 7. Remove và khôi phục
- Khôi phục: `python enrich.py --state HCMC --restore <vendor_id>` (offline, 0 request Google). Chuyển bản ghi `vendor` từ `removed_vendors.json` về `vendors.json` của **từng** category file đã gỡ (bằng bản ghi gốc), xoá bản ghi đó khỏi `removed_vendors.json`, in `RESTORED <vendor_id> files=<n>`, mã thoát 0.
- Từ chối (mã thoát khác 0, không đổi file): `RESTORE_ERROR <id> still_overridden` nếu `manual_overrides.json` còn mục `remove` của id đó (Capu xoá mục trước, để lần enrich sau không gỡ lại ngay); `RESTORE_ERROR <id> not_removed` nếu không có bản ghi trong `removed_vendors.json` nào.
- Sau khôi phục, dòng audit cũ giữ nguyên nên enrich không tìm lại vendor; vendor trở lại pool ở lần tạo pool kế tiếp.

### 8. Áp ADR-048 cho 4 venue và kết quả mong đợi
Bốn mục trong `manual_overrides.json`, `approved_by="capu"`, `approved_on="2026-11-08"`, `decision="decisions/2026-11-08-adr-048-capu-duyet-tay-4-venue.md"`:

| vendor_id | Tên | action | maps_link | Lý do (rút gọn) |
| --- | --- | --- | --- | --- |
| `marry_d4380c0b3cf3` | Én Banquet & Event Space | `accept_place` | `https://share.google/tYZdblcikIDPqVJX6` | Có trên Google Maps |
| `marry_f8b40ba4ddef` | Thiskyhall | `accept_place` | `https://share.google/noYBKfSkxUtMoFmJD` | Có trên Google Maps ("Trung tâm hội nghị Thiskyhall Sala", 0,455) |
| `marry_e38f1e755f9c` | Nhà hàng Tự Do – Khách sạn Viễn Đông | `remove` | — | Không có trên Google Maps |
| `marry_2ee808943c08` | Pergola | `temporarily_closed` | — | Google Maps ghi tạm thời đóng cửa |

Kết quả sau khi workflow chạy và hai PR (tohong, tohong-back) merge:
- **Én và Thiskyhall:** `venue/vendors.json` có `enrichment_log[google_maps].place_id` (bằng `place_id` trong mục duyệt tay), `manual_override=true`, `google_photos` ≥ 1 (uri `lh*.googleusercontent.com`, có `attributions`); audit `enriched` + `manual_override="accept_place"`; **pool tohong-back**: ≥ 1 ảnh, mọi ảnh `source="google"` + host `lh*.googleusercontent.com` + `attribution` (INV-013). Pool chỉ đổi `photos`/`styles`/`tags` của hai vendor này.
- **Tự Do:** không còn trong `vendors.json` của category nào; `venue/removed_vendors.json` có đúng 1 bản ghi (`manual=true`, `reason` bắt đầu `manual_override: remove`); **biến mất khỏi pool** (cách gỡ: như ADR-044 cho 5 nhà hàng đóng cửa, PR tohong-back xoá bản ghi; nếu T-109 đã làm công cụ pool gỡ được vendor đã xoá thì dùng công cụ; kết quả đo, không đo cách làm).
- **Pergola:** còn trong `venue/vendors.json` và pool, **giữ ảnh minh hoạ hiện có** (≥ 1 ảnh, không ảnh Google), không `place_id`, không bị gỡ; dòng audit `retry=true` + `manual_override="temporarily_closed"`; vẫn có dòng `review-needed.csv` của nó (vẫn `low_confidence`).
- Mọi vendor khác (kể cả các venue chưa có ảnh còn lại) không đổi trạng thái; INV-012..019 xanh.

### 9. Chi phí, hạn mức và cách chạy
- **Workflow mới** `.github/workflows/resolve-overrides.yml` (`workflow_dispatch`, `dry_run` mặc định `true`), các bước: test không gọi Google → chặn nếu vượt hạn mức (như `enrich-venue.yml`: 606 + mọi `GOOGLE_USAGE` đã có trong `run-logs/` + trần của lần này ≤ 1.000 SKU Photos) → `python resolve_overrides.py --state HCMC` → `python enrich.py --state HCMC --category venue --budget 1.0` → `python refresh_photos.py --input output/HCMC/venue/vendors.json --max-photos 2 --min-age-days 25 --max-requests 6` → mở PR chứa `manual_overrides.json` + `output/HCMC/venue/*` + `output/HCMC/*/vendors.json`/`removed_vendors.json` bị đổi + log. Log mỗi bước lưu `tools/scraper/run-logs/T-110/YYYYMMDD-<bước>.log` (không chứa khoá). `dry_run=true`: không gọi Google, in danh sách mục sẽ resolve và ước tính request.
- **Số request tối đa của lần chạy ADR-048:** resolve ≤ 2 (Text Search/Place Details, 1 mỗi link) + enrich 1 Text Search (thử lại Pergola, vendor duy nhất đang `retry`) + refresh ≤ 2 Place Details + ≤ 4 media (`--max-photos 2`; 3 vendor khác có ảnh tươi bị bỏ qua) = **≤ 9**, ≤ 6 trong SKU Photos (details của refresh + media). Trong hạn mức miễn phí; tháng 11 giữ ≤ 1.000 SKU Photos. Dịch vụ trả phí → mức "Hỏi trước": Capu bấm chạy, Capu tự merge hai PR.
- Không chạy `main.py`, không chạy `enrich.py --all`, không động `scrape-vendors.yml` (T-106).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (`tools/scraper`: `enrich.py`, `enrichment/settle.py`, `enrichment/google_maps.py`, `enrichment/pipeline.py`, `enrichment/review.py`, `refresh_photos.py`, mới `resolve_overrides.py`, workflow mới, dữ liệu `output/HCMC/…`) · `phungrk/tohong-back` (pool: gỡ Tự Do, ảnh Én/Thiskyhall) · Nhánh: `t-110-duyet-tay-venue` (mỗi repo) · Vùng (`area`): `planner/vendor/images`.
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret, INV-002, INV-003), `planner/` (001–004), `planner/vendor/images/` INV-001..019. Spec phải giữ INV-012 (pool không URL Places), 013 (ảnh Google có ghi công), 014 (ảnh Google truy về `enrichment_log[google_maps].place_id`: vì thế bản ghi duyệt tay **phải** dùng `source=google_maps`), 015 (nhận khớp có cổng: INV-015 tính `accept_match(confidence, address_match)` cho mọi bản ghi `google_maps` có place_id ở venue, nên bản ghi duyệt tay mang `confidence=1.0` theo quy ước ở Hành vi 2; `address_match` ghi là giá trị tính thật), 016 (ngoài tỉnh → lỗi `out_of_province`, không thắng), 017 (chung place_id → `place_conflict` / hạ vendor tự động), 018 (không đổi hàm chuẩn), 019 (G6 xét mọi category: vendor ghim vẫn tham gia nhóm). Không có điểm nào cần đổi bất biến. Nếu Spec critic cho rằng `confidence=1.0` lách INV-015, cách sạch là điều khoản miễn cho bản ghi `manual_override` có mục `accept_place` tương ứng trong file; việc đó chỉ Chief of Staff làm được (ghi `decisions/`), spec này không phụ thuộc vào nó.
- Kiến trúc: ảnh chỉ qua `photoUri` (spec 005 FR-001/003), không URL `places.googleapis.com` trong pool; pool không thêm `place_id` (schema pool không đổi); giá vendor, UI, manifest ảnh không đổi. Luật `status` của T-106 giữ nguyên, thêm mã `manual_reject` vào tập `reject_reason` và `REASON_FLAGS` của `review.py`.
- Không chạm: payment, auth, schema DB, dữ liệu cá nhân của người dùng; không liên hệ vendor; không gửi gì ra ngoài.
- Bậc lưới lọc: **C** (đã giao) — dịch vụ trả phí (Google Places), loại vendor khỏi danh sách (nhìn thấy bởi cặp đôi), và là mức "Hỏi trước" của T-106. Capu đọc diff hành vi và tự merge.
- Phụ thuộc/quan hệ: **T-109** (công cụ pool gỡ vendor đã xoá; nới G1 khi địa chỉ trùng khít) không chặn T-110; Pergola chỉ nhận được sau T-109 hoặc `accept_place` của Capu.

## Tiêu chí chấp nhận và eval
Mọi eval chạy offline (Google giả nạp qua `PYTHONPATH=eval/T-110/_fake`, chạy đúng lệnh CLI trong thư mục `tools/scraper` tạm); cần `TOHONG_REPO` (mặc định `../tohong`), check_7 cần thêm `TOHONG_BACK_REPO`. Eval chạy bằng `python3 -I eval/T-110/<file>`; thiếu cài đặt thì in `FAIL`, không `ERROR`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | `manual_overrides.json` thật có schema đúng, đủ 4 mục ADR-048, mỗi mục có `decision` của Capu; 11 kiểu file sai bị `enrich.py` từ chối trước khi làm gì (mã thoát 2, 0 request, `output/` giữ nguyên byte); `unknown_vendor` không chặn mục khác; enrich/refresh không ghi file | `python3 -I eval/T-110/check_1_schema_file_duyet_tay.py` |
| 2 | Duyệt tay thắng G1/G3/G4/G5, vendor ghim không bị G6 hạ nhưng vendor tự động chung place_id thì bị hạ; `remove` không vào tập G4; `reject_match` hạ được; lệnh áp lại offline và đảo thứ tự vendor không đổi kết quả; INV-016/017 và nơi đóng cửa thắng duyệt tay bằng `OVERRIDE_ERROR` | `python3 -I eval/T-110/check_2_duyet_tay_thang_sau_cong.py` |
| 3 | Chạy lại cả chuỗi resolve → enrich → refresh → enrich lần hai: mọi file giữ nguyên byte; resolve/refresh 0 request; enrich chỉ Text Search vendor tạm đóng cửa | `python3 -I eval/T-110/check_3_chay_lai_hai_lan.py` |
| 4 | Tạm đóng cửa (Capu hoặc Google): không ảnh, không gỡ, được thử lại dù có dòng audit (vendor khác có audit thì không), hết thử lại khi hết lý do; `CLOSED_PERMANENTLY` vẫn gỡ | `python3 -I eval/T-110/check_4_tam_dong_cua_duoc_thu_lai.py` |
| 5 | `remove` gỡ ở mọi category, lưu nguyên bản ghi + lý do + `manual`, không bị tìm lại; `--restore` khôi phục nguyên vẹn, bị chặn khi mục còn, báo lỗi khi không có bản ghi | `python3 -I eval/T-110/check_5_remove_khoi_phuc_duoc.py` |
| 6 | `resolve_overrides.py` đổi link/place_id thành place_id với ≤ 1 lượt Places mỗi mục (2 link ADR-048 ≤ 2), chỉ ghi `place_id`+`resolved`, 6 kiểu lỗi ghi rõ và mục lỗi không đổi, chạy lại 0 request; enrich/refresh không mở link | `python3 -I eval/T-110/check_6_doi_link_share_google.py` |
| 7 | ADR-048 áp vào dữ liệu thật + pool: Én và Thiskyhall có place_id + ảnh Google; Tự Do gỡ khỏi vendors.json/pool và lưu `removed_vendors.json`; Pergola giữ ảnh minh hoạ, không place_id, `retry`; log chạy thật trong hạn mức | `python3 -I eval/T-110/check_7_adr048_du_lieu_that.py` |
| 8 | Chuỗi workflow cho 4 quyết định tốn ≤ 9 request (resolve ≤ 2, enrich 1, refresh ≤ 2 details + ≤ 4 media), `GOOGLE_USAGE` mỗi CLI khớp số lượt thật | `python3 -I eval/T-110/check_8_han_muc_request.py` |
| 9 | INV-012..019 xanh trên dữ liệu thật và INV-015..019 xanh trên trạng thái fixture sau duyệt tay | `python3 -I eval/T-110/check_9_bat_bien_xanh.py` |

Lưu ý: check_7 cần dữ liệu thật đã chạy (workflow do Capu bấm) nên đỏ cho tới khi có PR của lần chạy; phần còn lại chạy được ngay trên code.

## Bất biến đề xuất (tầng 2)
Hai bản nháp (Spec critic rút vào bể khi spec qua cổng; đang "chưa áp dụng" cho tới khi có `manual_overrides.json`):
- **A. Mọi mục duyệt tay có quyết định của Capu** (`eval/T-110/inv-proposed-duyet-tay-co-quyet-dinh-cua-capu.py`): `manual_overrides.json` hợp schema, `approved_by="capu"`, `decision` trỏ file `decisions/` có `decided_by: capu` và nhắc `vendor_id`, mỗi `vendor_id` một mục.
- **B. Dữ liệu khớp file duyệt tay** (`eval/T-110/inv-proposed-du-lieu-khop-file-duyet-tay.py`): `accept_place` đã có `resolved` → vendor ở venue có `place_id` đó; `remove` → không ở `vendors.json` nào và có bản ghi `manual` trong `removed_vendors.json`; `temporarily_closed` → vendor chưa có place_id thì dòng audit có `retry=true`; `reject_match` → vendor không giữ place_id bị loại.

## Không làm
- Không gọi Google thật trong việc này, không đổi dữ liệu thật (bước đó là lần chạy workflow do Capu bấm, sau accept); không commit.
- Không sửa INV-012..019, `address_pairs.json`, hàm chuẩn T-106.
- Không giao diện nhập duyệt tay (Capu sửa file qua PR); không duyệt tay cho category khác venue (cơ chế chung, nhưng chỉ áp ADR-048); không tự động đoán place_id từ tên khi link không ra.
- Không đổi nhận khớp tự động (G1 nới là T-109); không nhận ảnh cho Pergola.
- Không thêm `place_id` vào pool, không đổi UI, không đổi giá.

## Câu hỏi mở
Pergola: thử lại ở lần enrich sau vẫn sẽ bị G1 từ chối (độ tin 0,226 < 0,4, tên Google "Pergola Garden Restaurant" khác tên marry.vn) kể cả khi Google báo mở lại, trừ khi T-109 nới G1 cho địa chỉ trùng khít. Capu muốn (a) chấp nhận Pergola giữ ảnh minh hoạ cho tới khi T-109 xong hoặc Capu tự đổi mục thành `accept_place` (mặc định nếu Capu không trả lời), hay (b) T-110 chờ T-109?
