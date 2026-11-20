# Spec T-217: đánh dấu verified cho venue đã enrich bằng Google AI Mode (tohong#108)

## Ý định
Capu (chọn phương án "2", nguyên văn): đánh dấu các venue đã enrich bằng Google AI Mode ở PR phungrk/tohong#108 là `verification_status: "verified"` để bước `--verified-only` của `tools/regen-pool-styles.sh` đưa mô tả, giá, sức chứa vào pool; không đổi pipeline. Việc nằm ở bước 5-6 của vòng đời dữ liệu vendor (ADR-136, `handbook/vong-doi-du-lieu-vendor.md`): sửa `vendors.json` bằng tay thì sinh lại báo cáo (INV-003), mở PR dữ liệu, Capu merge, rồi Sync.

## Bằng chứng
Mọi số đo do Product chạy lại trên bản sao tạm của tohong `d74ede9` + tohong-back `0f69f10` (không chạm repo thật), lệnh `bash tools/regen-pool-styles.sh --back <back> --photos-for all`.
- `tools/scraper/output/HCMC/venue/vendors.json` có 89 bản ghi: 88 `auto_scraped`, 1 `verified` (Bình Quới 2 `marry_b92e8a86175d`, không có dòng google_ai_mode). 88 bản ghi có dòng `google_ai_mode` (đều 2026-11-20).
- **Đọc `tools/generate-vendor-pool.js --verified-only` (dòng khối `if (VERIFIED_ONLY)`) cho thấy nó mang đúng ba thứ cho bản ghi verified, và KHÔNG mang giá google_ai_mode:**
  1. `description`: nếu nguồn là chuỗi, pool.description = nguồn.description cắt 220 đơn vị UTF-16.
  2. `capacity` (chỉ hạng mục venue): chỉ khi nguồn có `capacity_min` hoặc `capacity_max` khác null, pool.capacity = `{min: capacity_min nếu có, không thì 100; max: capacity_max nếu có, không thì 300}`. Hàm `venueCapacity(strict)` ném lỗi (Sync đỏ) khi `capacity_unit` có và khác `guests`, hoặc không nguyên dương, hoặc >5000, hoặc min>max. Dữ liệu hiện tại không có ca nào như vậy (regen mô phỏng chạy xanh).
  3. Giá: CHỈ khi `price_range.price_source == "verified"` (như Bình Quới 2); bản ghi `google_ai_mode` bị bỏ qua. Capu chọn đổi nguồn giá thành `verified` (ADR-138), nên giá đi vào pool theo nhánh này: hàm `ownPrice` (nhánh verified) trả `priceMin = min_vnd/1e6`, `priceMax = max_vnd/1e6` (KHÔNG làm tròn), `priceSource: "verified"`, và `withPrice` bỏ `priceAsOf` (vắng với verified). Nhánh này NÉM LỖI (Sync đỏ) khi `unit` khác `per_table` (venue), min/max không phải số dương, max < min, hoặc ngoài khung 2-20 triệu mỗi bàn (`PRICE_BANDS.venue = [2, 20]`, đóng hai đầu). Dữ liệu: 65/84 vendor của S có `price_range` `google_ai_mode`, đều `per_table`; 64 nằm trong khung; **1 vendor ngoài khung: `marry_604e8973f53e` (15.000.000-30.000.000 mỗi bàn, max > 20 triệu): đổi sang verified sẽ làm Sync đỏ, nên KHÔNG đổi** (giữ `google_ai_mode`, pool giữ giá cũ). Mô phỏng khi chưa đổi nguồn giá: Bạch Kim `marry_5ec257b82f96` vẫn `3.9 legacy_marry (2026-06)`; sau khi đổi sẽ là `3.4 verified`.
- `isVerified` ở pool do generator đặt `true` cho MỌI vendor (không đọc nguồn): đổi `verification_status` không đổi gì ở cờ này.
- Mô phỏng: đánh dấu 84 vendor (S) rồi regen: 84/84 mô tả đổi; 67/84 sức chứa đổi; khi CHƯA đổi nguồn giá, giá vẫn y nguyên; ảnh, tag, rating và mọi mục pool của 783 vendor còn lại y nguyên. Với đổi nguồn giá (ADR-138): 64 vendor nhận giá `verified` (Bạch Kim 3.4 triệu mỗi bàn), 1 vendor (`marry_604e8973f53e`) giữ giá cũ.
- Mức tự tin về hành vi của generator: cao (~95%, đã dựng lại bằng regen). Mức tự tin về chọn tập S: trung bình (~75%), là điểm chọn của Product.

## Giả thuyết
Nếu đánh dấu tập S verified thì pool (và cặp đôi thấy) mô tả, sức chứa và giá theo bàn lấy từ Google AI Mode thay cho mô tả marry cũ, khung mặc định 100-300 và giá marry/ước tính cũ. Chỉ số bảo vệ: ảnh, tag, rating và mọi mục pool ngoài S giữ nguyên; báo cáo enrich vẫn tươi.

## Hành vi (người dùng thấy gì)
Người thật chạm tới: Capu (quản trị, duyệt PR dữ liệu), cặp đôi (thẻ vendor).

### Định nghĩa: tập S
S là tập id (đo trên `tools/scraper/output/HCMC/venue/vendors.json`, tính từ chính dữ liệu, không đọc `verification_status`) thoả CẢ BỐN:
1. Bản ghi có dòng `enrichment_log` CUỐI CÙNG với `source == "google_ai_mode"` (theo thứ tự trong danh sách, không theo timestamp) mà `changes.description` là chuỗi không rỗng sau khi cắt khoảng trắng, HOẶC `changes` có khoá `capacity_min` hoặc `capacity_max`. (Loại vendor mà lần enrich chỉ ghi `verification_notes`: không có gì được xác minh.)
2. Id KHÔNG thuộc vendor đang tạm đóng cửa: dòng audit mới nhất của id trong `venue/enrichment-audit.json` không có `closed_state == "temporarily_closed"` và không có (`status == "temporarily_closed"` cùng `retry == true`). Vendor đóng cửa vĩnh viễn đã bị gỡ khỏi `vendors.json` ở #108 (`removed_vendors.json`) nên không có mặt để xét.
3. Id khác `marry_b92e8a86175d` (Bình Quới 2, giữ nguyên `verified`).
4. Pool xếp id vào hạng mục `venue` khi dựng từ chính dữ liệu cùng cây (`build_pool.py`, gộp theo id). Lý do: vendor có ở nhiều thư mục hạng mục thì pool lấy mô tả và hạng mục của bản ghi thắng khi gộp; đánh dấu bản ghi venue khi đó không có tác dụng ở pool (xem Diff hành vi, mục "ngoài S").

Với dữ liệu `d74ede9`: **|S| = 84**. Ngoài S (5 bản ghi): Bình Quới 2 (đã verified); `marry_2ee808943c08` Pergola Garden Restaurant (tạm đóng cửa, đã không có trong pool); `marry_f8b40ba4ddef` Thiskyhall Sala (dòng AI Mode cuối chỉ có `verification_notes`); `marry_40917c8745e0` Minh Thùy và `marry_79fc271d70e8` Villa Sông Sài Gòn (pool xếp là `photography` vì bản ghi ở thư mục photography thắng khi gộp; đây là bất thường dữ liệu riêng, Product báo Chief, không thuộc việc này). 10 vendor của S không có tag có bằng chứng và 19 không có giá trong dòng AI Mode: vẫn thuộc S, vì `verified` ở đây điều khiển mô tả và sức chứa, không điều khiển tag (tag đã giữ theo ADR-137, không đọc `verification_status`).

### Hành vi 1: nguồn
Mỗi bản ghi của S có `verification_status == "verified"`. Mọi bản ghi khác của `venue/vendors.json` giữ trạng thái cũ (Bình Quới 2 `verified`, ngoài S còn lại `auto_scraped`). Không trường nào khác của bất kỳ bản ghi hay của phần gốc file (`schema_version`, `generated_at`, `stats`, `enriched_at`...) đổi; KHÔNG thêm dòng vào `enrichment_log`; KHÔNG ghi thêm `verification_notes` (đã có sẵn nguồn gốc "Google AI Mode: ..." ở 83/84 bản ghi của S). Ngoại lệ DUY NHẤT ngoài `verification_status` là `price_range` theo Hành vi 1b. Định dạng file giữ nguyên (`json.dumps(indent=2, ensure_ascii=False)`, không xuống dòng cuối): diff của `vendors.json` đúng 212 dòng thêm và 212 dòng xoá (84 dòng `verification_status` + 2 dòng `price_source`/`note` cho mỗi bản ghi giá đổi: 84 + 2×64). Trong `tools/scraper/output/` chỉ `HCMC/venue/vendors.json` và (nếu byte đổi) `HCMC/enrich-report.json` được phép đổi.

### Hành vi 1b: nguồn giá (ADR-138)
Với mỗi bản ghi thuộc S mà `price_range` thoả CẢ: `price_source == "google_ai_mode"`, `unit == "per_table"`, `min_vnd`/`max_vnd` là số, `0 < min_vnd <= max_vnd`, `min_vnd >= 2.000.000` và `max_vnd <= 20.000.000` (đúng khung venue của generator, để Sync không đỏ): đặt `price_range.price_source = "verified"` và nối vào CUỐI `price_range.note` đúng chuỗi `" (nguồn: Google AI Mode)"` (một dấu cách, ngoặc đơn, chữ thường "nguồn", đúng viết hoa "Google AI Mode"; không thêm dấu chấm sau). Ví dụ Bạch Kim: note kết thúc `... kéo dài giờ tính phí riêng. (nguồn: Google AI Mode)`. Mọi trường khác của `price_range` (`min_vnd`, `max_vnd`, `unit`, phần cũ của `note`) y nguyên. Bản ghi S không thoả (vd `marry_604e8973f53e`, max 30 triệu; hoặc không có `price_range`; hoặc `price_range` không có `price_source`) giữ `price_range` nguyên văn. Với dữ liệu `d74ede9`: 64 bản ghi đổi, 1 không đổi do ngoài khung, 13 không có `price_range`, 6 có `price_range` không `price_source`.

### Hành vi 2: báo cáo enrich
`HCMC/enrich-report.json` đã commit bằng đúng byte báo cáo `build_enrich_report.py --state HCMC` sinh lại từ dữ liệu cùng cây (INV-003). Ghi chú: báo cáo không đọc `verification_status` nhưng CÓ đọc `price_range` (đổi `price_source` làm đổi nội dung báo cáo: mô phỏng cho thấy 128 dòng đổi). Nên báo cáo phải được sinh lại và commit cùng PR dữ liệu; đây là phép đo có nghĩa (handbook, mục Luật).

### Hành vi 3: pool sau Sync
Mô phỏng Sync (`regen-pool-styles.sh --photos-for all`) trên cây sau thay đổi, so với cùng cây mà S đặt lại `auto_scraped`:
- Mỗi vendor thuộc S: `description` bằng nguồn.description cắt 220 đơn vị UTF-16 (cả 84 mô tả dài hơn 220 ký tự nên bị cắt giữa câu, đây là hành vi sẵn có của generator, chấp nhận ở việc này).
- Mỗi vendor thuộc S: `capacity` theo luật ở mục Bằng chứng (2): có `capacity_min` hoặc `capacity_max` thì `{min: capacity_min hoặc 100, max: capacity_max hoặc 300}`; không có cả hai thì y nguyên như trước. Với dữ liệu hiện tại: 58 vendor có cả hai, 8 chỉ có max (min hiện ra là 100 do mặc định, không phải số của nguồn), 2 chỉ có min (max hiện ra là 300 do mặc định), 16 không có (giữ khung cũ 100-300; 1 trong số đó vẫn không có `capacity`).
- Mỗi vendor thuộc S mà nguồn có `price_range.price_source == "verified"` (sau Hành vi 1b; đơn vị `per_table` = triệu đồng mỗi bàn): `priceMin = min_vnd / 1.000.000`, `priceMax = max_vnd / 1.000.000` (không làm tròn), `priceSource == "verified"`, và KHÔNG có `priceAsOf`. Mỗi vendor thuộc S còn lại (không thoả 1b): bốn trường giá y nguyên. Cặp đôi thấy giá này như giá đã xác minh dù `note` của nguồn ghi "không rõ gồm VAT/phí phục vụ".
- Mọi vendor thuộc S: MỌI trường khác ngoài `description`, `capacity` và bốn trường giá y nguyên.
- Mọi vendor ngoài S (kể cả Bình Quới 2, Pergola, Thiskyhall Sala, vendor ngoài venue): mục pool y nguyên từng byte; số vendor và thứ tự id pool y nguyên.

### Hành vi 4: bất biến pool
Không bất biến pool nào (`planner/vendor/pool/inv-002..007`, `planner/vendor/inv-001..004`, và `pool/inv-001` bản v2 của T-215 thay bản v1 theo ADR-137) xấu đi (đạt thành đỏ) so với cùng cây mà S đặt lại `auto_scraped`.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (PR dữ liệu, nhánh `t-217-...`), rồi Sync ở `phungrk/tohong-back` (bước 6, không thuộc việc Engineering ở việc này nhưng nằm trong Diff hành vi) · Vùng: `planner/vendor`
- Bất biến đã đọc: `_shared`, `planner/vendor/inv-001..007`, `planner/vendor/pool/inv-001..007`, `planner/admin/vendor-enrich/inv-003`. Không vi phạm. Hai điểm cần Capu biết: (a) `planner/vendor/inv-001, 002` đã ĐỎ sẵn trên main vì Bình Quới 2 mang `priceSource: "verified"` (đo trên pool hiện tại, không do việc này): Code Gate của T-217 sẽ chạy hai bất biến này và thấy đỏ; Chief cần phân xử như đã làm ở ADR-137, phần bổ sung; (b) `pool/inv-001` v1 đã đỏ sẵn (ADR-137).
- Không chạm: pipeline (`tools/*.js`, `tools/*.py`, `*.sh`), `manual_overrides.json`, tohong-back, mọi lần gọi Google, `rating`, mọi trường dữ liệu ngoài `verification_status`.
- Bậc lưới lọc: C (Capu đã đặt; dữ liệu nguồn cặp đôi nhìn thấy; Capu tự merge PR dữ liệu và PR Sync).

## Tiêu chí chấp nhận và eval
Tất cả chạy ngoại tuyến trên cây `TOHONG_REPO` (mặc định `../tohong`) và pool nền `TOHONG_BACK_REPO` (mặc định `../tohong-back`); chạy bằng `python3 -I`. Trên main `d74ede9` cả bốn ĐỎ.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Đúng 84 bản ghi thuộc S là `verified`; Bình Quới 2 giữ `verified`; 4 bản ghi ngoài S còn lại giữ `auto_scraped`; 64 bản ghi S đổi `price_range.price_source` sang `verified` kèm hậu tố note, không trường nào khác đổi, diff đúng 212/212 dòng, không file nào khác ngoài `vendors.json` và `enrich-report.json` | `python3 -I eval/T-217/check_1_dung_tap_verified_khong_doi_gi_khac.py` |
| 2 | `enrich-report.json` đã commit đúng byte báo cáo sinh lại (INV-003), sau khi S đã verified | `python3 -I eval/T-217/check_2_bao_cao_enrich_tuoi.py` |
| 3 | Mô phỏng Sync: mô tả, sức chứa và giá (verified, không priceAsOf) của S khớp nguồn theo Hành vi 3; trường khác y nguyên; vendor ngoài S y hệt | `python3 -I eval/T-217/check_3_mo_phong_sync_pool_theo_nguon.py` |
| 4 | Không bất biến pool nào xấu đi (Hành vi 4) | `python3 -I eval/T-217/check_4_bat_bien_pool_van_xanh.py` |

Ghi chú về eval 2 và 4: eval 2 và 4 có điều kiện đầu "S đã verified" (nếu bỏ thì eval 4 xanh trước thay đổi vì mô phỏng không làm gì khi chưa verified). Eval 2 giờ có nghĩa thật: báo cáo đổi 128 dòng khi giá đổi nguồn, nên báo cáo cũ sẽ đỏ. Nền so sánh của eval 1 là merge-base của HEAD với `origin/main` (hoặc `main`); đặt `T217_BASE_REF` để ghi đè.

## Bất biến đề xuất (tầng 2)
`eval/T-217/inv-proposed-pool-verified-khop-nguon.py` (vùng `planner/vendor/pool`): vendor `verified` trong `venue/vendors.json` mà pool xếp là venue thì pool mang đúng mô tả (cắt 220), sức chứa và giá (verified: min_vnd/1e6, max_vnd/1e6, không priceAsOf) theo luật Hành vi 3. PASS trên main hiện tại (chỉ Bình Quới 2 verified). Lưu ý thứ tự: sau khi PR dữ liệu T-217 merge và trước khi PR Sync merge, bất biến này ĐỎ có chủ đích (pool chưa theo nguồn), nên chỉ thêm vào bể sau khi PR Sync merge (giống thứ tự đã chốt ở ADR-137, phần bổ sung).

## Không làm
Sửa pipeline; gọi Google; sửa `rating=0` trong pool; đổi `price_range` ngoài Hành vi 1b (không đổi `min_vnd`, `max_vnd`, `unit`, không đổi giá của bản ghi ngoài khung, không đổi bản ghi ngoài S); đổi tag; đổi ảnh; thêm `verification_notes`; thêm dòng `enrichment_log`; sửa lỗi cắt 220 ký tự giữa câu; sửa 2 vendor bị gộp sang hạng mục photography.

## Câu hỏi mở
Không. Capu đã quyết ở ADR-138 (đổi nguồn giá thành verified). Một điều Product báo Chief, không cần Capu quyết: `marry_604e8973f53e` (giá 15-30 triệu mỗi bàn) nằm ngoài khung 2-20 triệu của generator nên không được đổi; muốn đổi phải sửa khung hoặc sửa giá nguồn (việc riêng, ADR-138 không nói tới).

## Đã sửa so với v1 (spec rework không có; chỉnh trước Spec Gate)
Câu "Không làm: đổi `price_range.price_source` thành `verified`" bị gỡ theo ADR-138; thêm Hành vi 1b, 3 (giá), tiêu chí 1 và 3 đo giá; phát hiện khung giá làm Sync đỏ cho 1 vendor.
