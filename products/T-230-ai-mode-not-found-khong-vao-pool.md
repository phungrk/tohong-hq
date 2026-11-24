# Spec T-230: vendor Google AI Mode "not_found" không vào pool, đang trong pool thì bị gỡ

## Ý định
Capu (2026-11-24): "khi enrich data dùng google ai mode, nếu vendor nào không tồn tại thì sẽ có cờ ai_mode_result: not_found, khi đó data đó sẽ bị không vào pool, còn nếu đã có trong pool thì sẽ bị remove ra khỏi pool." Bối cảnh: `board/T-230.md`, `handbook/vong-doi-du-lieu-vendor.md`.

## Bằng chứng
- Chưa có trường `ai_mode_result` trong code hay dữ liệu (tohong `origin/main` 37af618, tohong-back `origin/main` b51d7cc; grep 2026-11-24).
- PR dữ liệu AI Mode hiện chỉ ghi kết luận bằng chữ: phungrk/tohong#112 (flower, 94 vendor) có 11 vendor "đã đóng cửa/chuyển ngành/không còn hoạt động" chỉ nằm trong `verification_notes` với câu "cần người duyệt cân nhắc gỡ khỏi pool"; không máy nào đọc được. Mọi dòng `google_ai_mode` của PR này chỉ có `source`, `timestamp`, `changes`.
- Tiền lệ loại khỏi pool ở bước 6 mà không xoá nguồn: `tools/scraper/build_pool.py` bỏ vendor tạm đóng cửa (T-110, ADR-049); `tools/generate-vendor-pool.js --styles-only --prune` gỡ khỏi pool vendor vắng trong nguồn, và thêm lại khi nguồn có lại (đường production `tools/regen-pool-styles.sh`, gọi từ `sync-vendor-pool.yml`).
- Báo cáo enrich đã có nhóm `not_found` nghĩa là "Google Maps Text Search không khớp" (`build_enrich_report.py` `GROUPS`); drawer admin đã có danh sách lý do vắng pool (`lib/vendorEnrich.js` `REASON_TEXT`: `temp_closed`, `removed`, `not_generated`).
- Không có số liệu người dùng cho việc này; đây là việc vệ sinh dữ liệu theo ý định của Capu.

## Giả thuyết
Nếu vendor AI Mode không tìm thấy bị loại khỏi pool ở bước 6 thì số vendor "ma" cặp đôi thấy giảm về 0 cho tập đã enrich AI Mode. Chỉ số bảo vệ: mọi vendor khác trong pool không đổi một byte; dữ liệu nguồn không đổi; đảo ngược được bằng một PR dữ liệu.

## Định nghĩa (chốt cho cả máy và người ghi dữ liệu)
1. **Vị trí trường:** khoá cấp vendor `ai_mode_result` trên bản ghi trong `tools/scraper/output/<thành phố>/<hạng mục>/vendors.json`. Đây là nguồn sự thật duy nhất mà máy đọc. Dòng `enrichment_log` `source: google_ai_mode` ghi lại thay đổi đó (`changes.ai_mode_result`) để lần ngược, nhưng **máy không đọc cờ từ log**: chỉ có dòng log mà thiếu khoá cấp vendor thì vendor vẫn vào pool.
2. **Giá trị hợp lệ:** `"not_found"` (Google AI Mode không tìm thấy bằng chứng doanh nghiệp này tồn tại: không có điểm, trang hay nguồn nào khớp tên cùng địa chỉ/nguồn của bản ghi) và `"found"` (đã kiểm và tìm thấy). Vắng khoá = chưa kiểm. Chỉ **đúng chuỗi** `"not_found"` loại vendor; mọi giá trị khác (vắng, `null`, `"found"`, viết hoa, có khoảng trắng, kiểu khác) đều không loại.
3. **"Đã đóng cửa vĩnh viễn", "sai danh mục", "nghi trùng" không phải `not_found`** trong spec này (ngoài phạm vi theo brief). Xem Câu hỏi mở.
4. **Ai ghi:** quy trình enrich Google AI Mode, qua PR dữ liệu vào repo tohong (như #112): đặt khoá cấp vendor và thêm dòng log `{"source": "google_ai_mode", "timestamp": ..., "changes": {"ai_mode_result": "not_found", "verification_notes": "..."}}`, rồi sinh lại `enrich-report.json` trong cùng PR (INV-003 của `planner/admin/vendor-enrich`). Admin **không** ghi trường này (không thêm nút hay route); admin cần gỡ ngay thì dùng lối tắt overlay sẵn có (ẩn/xoá).
5. **Vendor nhiều bản ghi** (cùng id ở nhiều hạng mục): bị loại khi **ít nhất một** bản ghi mang `"not_found"`. Muốn đưa lại thì mọi bản ghi của id đó phải hết `"not_found"`.

## Hành vi (người dùng thấy gì)
Bước nằm ở đâu trong vòng đời: ghi cờ ở bước 2 (enrich, PR dữ liệu); loại ở **bước 6** (Sync, sinh `lib/vendorPool.generated.js`).

1. **Không vào pool.** Vendor mang cờ mà chưa có trong pool thì bước 6 không thêm nó vào, kể cả qua đường "thêm lại" của `--prune`.
2. **Đang trong pool thì bị gỡ ở lần Sync kế tiếp.** Sau khi PR dữ liệu đặt cờ merge và Sync chạy, vendor vắng khỏi pool. Mọi vendor khác giữ nguyên từng byte so với cùng lần Sync không có cờ. Trước khi Sync merge, cặp đôi vẫn thấy vendor (như mọi thay đổi dữ liệu khác); cần gỡ ngay thì admin ẩn bằng overlay.
3. **Không xoá nguồn.** Bước 6 không sửa, không xoá bản ghi trong `vendors.json`; cây tohong sạch sau regen; cờ còn nguyên.
4. **Cặp đôi đã lưu/so sánh vendor bị gỡ: không đổi so với hôm nay** cho vendor vắng pool (giống vendor bị gỡ vì tạm đóng cửa hay `REMOVED_VENDOR`): kế hoạch đã lưu giữ bản chụp lúc lưu; `/api/vendors/status` trả `null` cho id đó; chi tiết vendor trả 404; vendor không còn ở ghép, chat, đếm hạng mục. Spec này không thêm thông báo cho cặp đôi.
5. **Báo cáo enrich.** Mỗi dòng `enrich-report.json` có khoá `ai_mode_result`: `"not_found"` nếu ít nhất một bản ghi của id mang cờ, nếu không thì `"found"` nếu có bản ghi `"found"`, còn lại `null`. Vendor bị loại **vẫn có dòng** trong báo cáo. Không thêm nhóm mới và không đổi `group`/`summary` (nhóm `not_found` sẵn có vẫn chỉ nghĩa là Google Maps không khớp). Danh mục `tools/scraper/pool-input-fields.json` thêm mục `{"file": "vendors.json", "key": "ai_mode_result", "stages": ["build"], "pool": []}` để drawer hiện giá trị ở phần nguồn (`pool_input.record`). Báo cáo tất định như cũ.
6. **Admin thấy lý do.** Drawer vendor (chi tiết enrich ở tohong-back) của vendor vắng pool mà dòng báo cáo có `ai_mode_result: "not_found"` hiện đúng một lý do, mã `ai_mode_not_found`, chữ "Google AI Mode không tìm thấy vendor (ai_mode_result: not_found): không vào pool". Mã này đứng **thay** `temp_closed`/`removed`/`not_generated` (một vendor vắng pool chỉ có một lý do, AI Mode ưu tiên). Vendor còn trong pool không bao giờ có mã này.
7. **Đảo ngược.** PR dữ liệu đổi `ai_mode_result` thành `"found"` (hoặc xoá khoá) trên mọi bản ghi của id, kèm một dòng log `google_ai_mode` ghi lý do, sinh lại báo cáo; Sync kế tiếp đưa vendor quay lại với cùng id, tên, hạng mục. Lưu ý (như vendor hết tạm đóng cửa, T-110): bản quay lại được sinh từ nguồn, không lấy lại các trường "giữ từ pool nền" (ADR-025) đã mất khi bị gỡ.
8. **Quan hệ với cơ chế gỡ sẵn có (không xung đột, không thay thế):**
   - Overlay R2 (ẩn, xoá mềm T-206, sửa giá/liên hệ): độc lập, theo id. Vendor `not_found` vắng pool nên mục overlay của nó không có tác dụng; khi đảo ngược, trạng thái overlay (vd đang Ẩn) áp lại như cũ.
   - `REMOVED_VENDOR`/`removed_vendors.json`/`enrich.py --restore` (Google Maps đóng cửa vĩnh viễn hoặc không khớp, gỡ khỏi file nguồn): độc lập. Bản ghi đã bị chuyển ra `removed_vendors.json` thì cờ không có tác dụng; `--restore` trả lại bản ghi kèm cờ của nó, và nếu cờ là `"not_found"` thì vendor vẫn không vào pool.
   - Tạm đóng cửa (audit) và override `remove`: độc lập; vendor dính nhiều lý do vẫn chỉ vắng pool một lần.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (`tools/scraper/build_pool.py`, `tools/scraper/build_enrich_report.py`, `tools/scraper/pool-input-fields.json`, `enrich-report.json` sinh lại, tài liệu hợp đồng trường trong `tools/scraper/enrichment/README.md`) và `phungrk/tohong-back` (`lib/vendorEnrich.js`, `lib/vendorEnrichReport.generated.js` sinh lại bằng `tools/generate-vendor-enrich-report.js`). Nhánh: `t-230-ai-mode-not-found`. Vùng: `planner/vendor`.
- Bất biến đã đọc: `_shared/`, `planner/`, `planner/vendor/` (gồm `pool/`, `images/`, `matching/`), và `planner/admin/vendor-enrich/` (không thuộc vùng nhưng bị chạm). Không mâu thuẫn: `vendor/inv-007` (vendor bị gỡ không ra phía cặp đôi) cùng chiều; `pool/inv-006` (regen không làm bẩn nguồn) được check_6 kiểm lại; `admin/vendor-enrich/inv-003` buộc PR code commit báo cáo sinh lại (tohong và back) vì dòng báo cáo có khoá mới; `inv-006` (danh mục khớp trường bước sinh pool đọc) buộc thêm mục danh mục (tiêu chí 7).
- Không chạm: gọi Google (không tự động gọi AI Mode); dữ liệu PR #112; front cặp đôi; schema R2/overlay; secret.
- Bậc: B (Capu đặt): thay đổi pipeline và admin, đảo ngược được bằng PR dữ liệu; không chạm tiền, auth, dữ liệu người dùng.
- Thứ tự merge: PR tohong (code + báo cáo sinh lại) và PR back (`vendorEnrich.js` + báo cáo generated) cùng đợt; PR back phải có báo cáo mang khoá `ai_mode_result`, nếu không drawer không bao giờ hiện lý do.
- Chạy eval: `TOHONG_REPO=<checkout nhánh tohong> TOHONG_BACK_REPO=<checkout nhánh back, đã cài dependencies> python3 -I eval/T-230/check_N_*.py`. Offline (python bị chặn socket), dựng bản sao tạm qua `eval/lib/regen_fixture.py`, không ghi vào repo.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Vendor chưa có trong pool, mang `"not_found"`, không được bước 6 thêm vào; đối chứng không cờ được thêm | `python3 -I eval/T-230/check_1_vendor_moi_not_found_khong_vao_pool.py` |
| 2 | Vendor đang trong pool bị gỡ ở lần bước 6 kế tiếp; mọi vendor khác giữ nguyên từng byte | `python3 -I eval/T-230/check_2_dang_trong_pool_bi_go_o_lan_sync_ke.py` |
| 3 | Vendor nhiều hạng mục bị gỡ khi chỉ một bản ghi `"not_found"` (bản ghi khác `"found"`) | `python3 -I eval/T-230/check_3_nhieu_hang_muc_mot_ban_ghi_du_go.py` |
| 4 | Đổi thành `"found"` hoặc xoá khoá rồi chạy lại bước 6: vendor quay lại, cùng id/tên/hạng mục | `python3 -I eval/T-230/check_4_dao_nguoc.py` |
| 5 | Chỉ đúng chuỗi `"not_found"` ở khoá cấp vendor mới loại; `"found"`, `null`, `"NOT_FOUND"`, `"not found"`, `" not_found"`, `true`, cờ chỉ trong log đều không loại | `python3 -I eval/T-230/check_5_chi_gia_tri_dung_not_found.py` |
| 6 | Bước 6 không xoá/sửa nguồn: cây tohong sạch, bản ghi và cờ còn nguyên | `python3 -I eval/T-230/check_6_khong_xoa_du_lieu_nguon.py` |
| 7 | Báo cáo enrich: khoá `ai_mode_result` mỗi dòng đúng luật mục 5, vendor bị loại vẫn có dòng, nhóm/summary không đổi, danh mục có mục `ai_mode_result`, `pool_input.record` mang cờ, tất định | `python3 -I eval/T-230/check_7_bao_cao_enrich_co_ly_do.py` |
| 8 | Drawer admin của vendor bị loại: `in_pool=false`, lý do đúng một mã `ai_mode_not_found` có chữ "AI Mode"; vendor trong pool không có mã đó | `python3 -I eval/T-230/check_8_admin_drawer_ly_do.py` |

Không dùng checklist: mọi tiêu chí chạy offline trên bản sao tạm.

## Bất biến đề xuất (tầng 2)
1. `planner/vendor/pool`: "Vendor có bản ghi nguồn mang `ai_mode_result == "not_found"` không có trong `lib/vendorPool.generated.js` sau bước 6, và nguồn không bị sửa" (gộp check_1, check_2, check_6; tham số hoá theo dữ liệu thật: mọi id mang cờ trong nguồn hiện hành phải vắng pool hiện hành).
2. `planner/admin/vendor-enrich`: "Mọi vendor vắng pool có lý do không phải `not_generated` khi nguồn biết lý do" (mở rộng check_8; chờ Spec critic cân nhắc).

## Không làm
Tự động gọi Google AI Mode; trạng thái khác (đóng cửa vĩnh viễn, sai danh mục, nghi trùng); sửa dữ liệu PR #112; nút admin ghi `ai_mode_result`; thông báo cho cặp đôi có vendor đã lưu bị gỡ; khôi phục các trường "giữ từ pool nền" khi đảo ngược; nhóm mới trong báo cáo enrich.

## Câu hỏi mở
"Vendor không tồn tại" có gồm vendor **đã đóng cửa vĩnh viễn** không? Spec này hiểu hẹp: `not_found` chỉ là AI Mode không tìm thấy doanh nghiệp; nên 11 vendor "đã đóng cửa/ngừng hoạt động" của PR #112 vẫn ở pool cho tới khi có PR dữ liệu ghi cờ cho chúng. Nếu Capu muốn gộp đóng cửa vĩnh viễn vào cùng cờ (người ghi dữ liệu đặt `"not_found"` cho cả hai) thì máy không cần đổi, chỉ đổi định nghĩa mục 2-3; nếu muốn phân biệt thì cần giá trị thứ ba (vd `"closed"`) và một spec nhỏ.
