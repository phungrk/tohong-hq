# Spec T-217: đánh dấu verified cho venue đã enrich bằng Google AI Mode (tohong#108)

## Ý định
Capu (chọn phương án "2", nguyên văn): đánh dấu các venue đã enrich bằng Google AI Mode ở PR phungrk/tohong#108 là `verification_status: "verified"` để bước `--verified-only` của `tools/regen-pool-styles.sh` đưa mô tả, giá, sức chứa vào pool; không đổi pipeline. Việc nằm ở bước 5-6 của vòng đời dữ liệu vendor (ADR-136, `handbook/vong-doi-du-lieu-vendor.md`): sửa `vendors.json` bằng tay thì sinh lại báo cáo (INV-003), mở PR dữ liệu, Capu merge, rồi Sync.

## Bằng chứng
Mọi số đo do Product chạy lại trên bản sao tạm của tohong `d74ede9` + tohong-back `0f69f10` (không chạm repo thật), lệnh `bash tools/regen-pool-styles.sh --back <back> --photos-for all`.
- `tools/scraper/output/HCMC/venue/vendors.json` có 89 bản ghi: 88 `auto_scraped`, 1 `verified` (Bình Quới 2 `marry_b92e8a86175d`, không có dòng google_ai_mode). 88 bản ghi có dòng `google_ai_mode` (đều 2026-11-20).
- **Đọc `tools/generate-vendor-pool.js --verified-only` (dòng khối `if (VERIFIED_ONLY)`) cho thấy nó mang đúng ba thứ cho bản ghi verified, và KHÔNG mang giá google_ai_mode:**
  1. `description`: nếu nguồn là chuỗi, pool.description = nguồn.description cắt 220 đơn vị UTF-16.
  2. `capacity` (chỉ hạng mục venue): chỉ khi nguồn có `capacity_min` hoặc `capacity_max` khác null, pool.capacity = `{min: capacity_min nếu có, không thì 100; max: capacity_max nếu có, không thì 300}`. Hàm `venueCapacity(strict)` ném lỗi (Sync đỏ) khi `capacity_unit` có và khác `guests`, hoặc không nguyên dương, hoặc >5000, hoặc min>max. Dữ liệu hiện tại không có ca nào như vậy (regen mô phỏng chạy xanh).
  3. Giá: CHỈ khi `price_range.price_source == "verified"` (như Bình Quới 2). Bản ghi có `price_source: "google_ai_mode"` (65/84 vendor thuộc tập S dưới đây) bị bỏ qua: pool giữ nguyên giá cũ. Đường `estimate_google_ai_mode` (spec 007 của tohong) chỉ có trong chế độ sinh đầy đủ và `--prices-only`, mà `regen-pool-styles.sh` không chạy chế độ nào trong hai. Pool hiện có 0 vendor `estimate_google_ai_mode`. Ví dụ Bạch Kim `marry_5ec257b82f96`: sau mô phỏng giá vẫn `3.9 legacy_marry (2026-06)`, không phải 3.4 từ google_ai_mode.
- `isVerified` ở pool do generator đặt `true` cho MỌI vendor (không đọc nguồn): đổi `verification_status` không đổi gì ở cờ này.
- Mô phỏng: đánh dấu 84 vendor (S) rồi regen: 84/84 mô tả đổi; 67/84 sức chứa đổi; giá, ảnh, tag, rating và mọi mục pool của 783 vendor còn lại y nguyên.
- Mức tự tin về hành vi của generator: cao (~95%, đã dựng lại bằng regen). Mức tự tin về chọn tập S: trung bình (~75%), là điểm chọn của Product.

## Giả thuyết
Nếu đánh dấu tập S verified thì pool (và cặp đôi thấy) mô tả và sức chứa lấy từ Google AI Mode thay cho mô tả marry cũ và khung mặc định 100-300. Chỉ số bảo vệ: giá, ảnh, tag, rating và mọi mục pool ngoài S giữ nguyên; báo cáo enrich vẫn tươi.

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
Mỗi bản ghi của S có `verification_status == "verified"`. Mọi bản ghi khác của `venue/vendors.json` giữ trạng thái cũ (Bình Quới 2 `verified`, ngoài S còn lại `auto_scraped`). Không trường nào khác của bất kỳ bản ghi hay của phần gốc file (`schema_version`, `generated_at`, `stats`, `enriched_at`...) đổi; KHÔNG thêm dòng vào `enrichment_log`; KHÔNG ghi thêm `verification_notes` (đã có sẵn nguồn gốc "Google AI Mode: ..." ở 83/84 bản ghi của S; ghi thêm là đổi trường thứ hai ngoài ý Capu). Định dạng file giữ nguyên (`json.dumps(indent=2, ensure_ascii=False)`, không xuống dòng cuối): diff của `vendors.json` đúng |S| dòng thêm và |S| dòng xoá, mỗi bản ghi một dòng `verification_status`. Trong `tools/scraper/output/` chỉ `HCMC/venue/vendors.json` và (nếu byte đổi) `HCMC/enrich-report.json` được phép đổi.

### Hành vi 2: báo cáo enrich
`HCMC/enrich-report.json` đã commit bằng đúng byte báo cáo `build_enrich_report.py --state HCMC` sinh lại từ dữ liệu cùng cây (INV-003). Ghi chú: báo cáo hiện không đọc `verification_status` nên thường không đổi byte; việc vẫn phải sinh lại và chứng minh bằng phép so này (handbook, mục Luật).

### Hành vi 3: pool sau Sync
Mô phỏng Sync (`regen-pool-styles.sh --photos-for all`) trên cây sau thay đổi, so với cùng cây mà S đặt lại `auto_scraped`:
- Mỗi vendor thuộc S: `description` bằng nguồn.description cắt 220 đơn vị UTF-16 (cả 84 mô tả dài hơn 220 ký tự nên bị cắt giữa câu, đây là hành vi sẵn có của generator, chấp nhận ở việc này).
- Mỗi vendor thuộc S: `capacity` theo luật ở mục Bằng chứng (2): có `capacity_min` hoặc `capacity_max` thì `{min: capacity_min hoặc 100, max: capacity_max hoặc 300}`; không có cả hai thì y nguyên như trước. Với dữ liệu hiện tại: 58 vendor có cả hai, 8 chỉ có max (min hiện ra là 100 do mặc định, không phải số của nguồn), 2 chỉ có min (max hiện ra là 300 do mặc định), 16 không có (giữ khung cũ 100-300; 1 trong số đó vẫn không có `capacity`).
- Mỗi vendor thuộc S: `priceMin, priceMax, priceSource, priceAsOf` và MỌI trường khác ngoài `description`, `capacity` y nguyên.
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
| 1 | Đúng 84 bản ghi thuộc S là `verified`; Bình Quới 2 giữ `verified`; 4 bản ghi ngoài S còn lại giữ `auto_scraped`; không trường nào khác đổi, diff đúng 84/84 dòng, không file nào khác ngoài `vendors.json` và `enrich-report.json` | `python3 -I eval/T-217/check_1_dung_tap_verified_khong_doi_gi_khac.py` |
| 2 | `enrich-report.json` đã commit đúng byte báo cáo sinh lại (INV-003), sau khi S đã verified | `python3 -I eval/T-217/check_2_bao_cao_enrich_tuoi.py` |
| 3 | Mô phỏng Sync: mô tả và sức chứa của S khớp nguồn theo Hành vi 3; giá và trường khác y nguyên; vendor ngoài S y hệt | `python3 -I eval/T-217/check_3_mo_phong_sync_pool_theo_nguon.py` |
| 4 | Không bất biến pool nào xấu đi (Hành vi 4) | `python3 -I eval/T-217/check_4_bat_bien_pool_van_xanh.py` |

Ghi chú về eval 2 và 4: hai phép đo này xanh cả trước thay đổi (báo cáo không đọc `verification_status`; mô phỏng không làm gì khi chưa verified). Chúng đỏ trên main nhờ điều kiện đầu "S đã verified": một phép xanh khi chưa có gì để kiểm là vô nghĩa. Nền so sánh của eval 1 là merge-base của HEAD với `origin/main` (hoặc `main`); đặt `T217_BASE_REF` để ghi đè.

## Bất biến đề xuất (tầng 2)
`eval/T-217/inv-proposed-pool-verified-khop-nguon.py` (vùng `planner/vendor/pool`): vendor `verified` trong `venue/vendors.json` mà pool xếp là venue thì pool mang đúng mô tả (cắt 220) và sức chứa theo luật Hành vi 3. PASS trên main hiện tại (chỉ Bình Quới 2 verified). Lưu ý thứ tự: sau khi PR dữ liệu T-217 merge và trước khi PR Sync merge, bất biến này ĐỎ có chủ đích (pool chưa theo nguồn), nên chỉ thêm vào bể sau khi PR Sync merge (giống thứ tự đã chốt ở ADR-137, phần bổ sung).

## Không làm
Sửa pipeline; gọi Google; sửa `rating=0` trong pool; đổi giá trong pool (xem Câu hỏi mở); đổi `price_range.price_source` thành `verified` (sẽ gắn nhãn "đã xác minh" cho giá mà nguồn tự ghi "không rõ gồm VAT/phí phục vụ", vi phạm hợp đồng pool/inv-001 và spec 007 "Giá tham khảo"); đổi tag; đổi ảnh; thêm `verification_notes`; thêm dòng `enrichment_log`; sửa lỗi cắt 220 ký tự giữa câu; sửa 2 vendor bị gộp sang hạng mục photography.

## Câu hỏi mở
Một câu cho Capu: phương án "2" không đưa được giá google_ai_mode vào pool (generator `--verified-only` chỉ nhận giá `price_source: "verified"`); Capu chấp nhận để giá pool giữ nguyên ở việc này và mở việc riêng cho giá (vd chạy `--prices-only` trong regen, hiện thành "Giá tham khảo" `estimate_google_ai_mode`), hay muốn làm theo cách khác? Khuyến nghị: chấp nhận, mở việc riêng.
