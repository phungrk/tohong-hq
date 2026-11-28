# Spec T-234: `ai_mode_result: "closed"` là giá trị thứ năm, vắng pool như `not_found`

## Ý định
Capu (ADR-155, 2026-11-28, "cách 1"): nhận `closed` (đóng cửa vĩnh viễn/ngừng hoạt động) làm giá trị hợp lệ thứ năm; vendor mang `closed` không vào pool như `not_found`; `schema.py` trên main dùng đúng dòng của các nhánh PR dữ liệu để hết xung đột. Nguồn: `board/T-234.md`, `decisions/2026-11-28-adr-155-*.md`; spec liên quan T-230, T-232.

## Bằng chứng
- tohong main cc6ee1a (T-233): `schema.py` 4 giá trị; `build_pool.py` chỉ loại `not_found`; `build_enrich_report.py` `AI_MODE_PRIORITY` không có `closed` (ra null); `ai_mode_flags.py` coi `closed` là `invalid`. tohong-back 7b1d621: drawer chỉ có mã `ai_mode_not_found`.
- 6 nhánh PR #120, #121, #123, #125, #126, #127 khai báo đúng `    ai_mode_result: Optional[Literal["found", "not_found", "closed", "address_mismatch", "wrong_category"]] = None` (dòng comment phía trên giữ 4 giá trị). Trên main hiện `git merge-tree` báo xung đột `schema.py` với cả 6.
- 28 bản ghi `closed` trên 6 nhánh (invitation 6, wedding_gift 4, makeup 4, photography 2, wedding_attire 4, wedding_ring 8), 0 bản ghi `verified`; **cả 28 không có dòng log `google_ai_mode` mang `changes.ai_mode_result`** (đọc 2026-11-28), nên `ai_mode_flags.py check` sẽ báo `no_log` cho chúng (xem Câu hỏi mở / Việc cho Chief).

## Giả thuyết
Nếu `closed` vắng pool ở Sync kế tiếp thì 28 vendor đóng cửa không còn tới cặp đôi; schema trùng chữ các nhánh thì 6 PR dữ liệu gộp được mà không sửa tay `schema.py`. Chỉ số bảo vệ: vendor khác trong pool không đổi; pool/inv-010 và T-231 adv-01 xanh.

## Hành vi
1. **Schema.** `tools/scraper/schema.py` trên main có đúng một dòng khai báo `ai_mode_result:` và dòng đó (bỏ khoảng trắng đầu/cuối) là `ai_mode_result: Optional[Literal["found", "not_found", "closed", "address_mismatch", "wrong_category"]] = None` (cùng thụt lề 4 dấu cách, cùng vị trí). Dòng comment phía trên **giữ nguyên** (4 giá trị), để trùng chữ các nhánh. `Vendor.model_validate` nhận 5 giá trị, null, vắng; từ chối mọi biến thể khác (`"Closed"`, `"closed "`, `"CLOSED"`, `"permanently_closed"`...).
   - Kết quả gộp (đã thử bằng bản vá tham chiếu): không còn xung đột `schema.py` với **cả 6** nhánh. #121, #123, #125 còn sửa dòng import (`Literal`) và #123, #125 thêm `price_source` vào `PriceRange`, nhưng các thay đổi đó trùng chữ với main nên git gộp sạch. Xung đột còn lại duy nhất: `tools/scraper/output/HCMC/enrich-report.json` ở #120, #121, #123, #125, #127 (báo cáo sinh lại, giải bằng sinh lại theo INV-003); #126 gộp sạch hoàn toàn.
2. **Pool.** Ở bước 6, vendor có **ít nhất một** bản ghi nguồn mang khoá cấp vendor đúng chuỗi `"closed"` hoặc `"not_found"` vắng pool (kể cả không được thêm lại qua `--prune`). Biến thể khác không loại. Nguồn không đổi. Đảo ngược: đổi mọi bản ghi của id khỏi `closed`/`not_found` (vd `"found"` hoặc xoá khoá) rồi Sync, vendor quay lại cùng id/tên/hạng mục (như T-230 Hành vi 7).
3. **Báo cáo.** Khoá `ai_mode_result` của dòng báo cáo: một bản ghi giữ đúng giá trị nếu thuộc 5 giá trị; nhiều bản ghi lấy ưu tiên cao nhất `not_found` > `closed` > `wrong_category` > `address_mismatch` > `found`; giá trị lạ bỏ qua; không còn gì thì null. Nhóm/summary không đổi.
4. **Drawer admin (tohong-back `lib/vendorEnrich.js`).** Vendor vắng pool mà dòng báo cáo có `ai_mode_result: "closed"` có đúng một lý do, mã **`ai_mode_closed`**, chữ "Google AI Mode: vendor đã đóng cửa vĩnh viễn (ai_mode_result: closed): không vào pool" (khác chữ `ai_mode_not_found`). `not_found` giữ mã `ai_mode_not_found`. Vendor có cả bản ghi `not_found` và `closed`: dòng báo cáo là `not_found` nên lý do là `ai_mode_not_found`. Hai mã AI Mode đứng thay `temp_closed`/`removed`/`not_generated` như T-230.
5. **`ai_mode_flags.py`.**
   - `count`: thêm khoá `"closed"`; khoá đầy đủ `found, not_found, closed, address_mismatch, wrong_category, empty, invalid`.
   - `check`: `closed` là giá trị hợp lệ (không `invalid_value`); `no_log` áp như 4 giá trị kia.
   - **`verified_not_found` mở rộng sang `closed`** (tên luật giữ nguyên để không phá T-233): `verified` mà cờ `closed` là vi phạm. Lý do: điều kiện `verified` hiện hành đòi "có nguồn chính thức cho thấy còn hoạt động" (PR #112, spec 008 FR-004), trái nghĩa với đóng cửa; `closed` cũng là giá trị báo vấn đề như `not_found`. Dữ liệu hiện tại: 0/28 bản ghi `closed` là `verified`, nên luật mở rộng không làm đỏ dữ liệu.
6. **Không làm**: không đổi dữ liệu cũ ghi đóng cửa là `not_found` (PR #124, ADR-155 nói vẫn hợp lệ).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (`schema.py` một dòng, `build_pool.py`, `build_enrich_report.py` `AI_MODE_PRIORITY`, `ai_mode_flags.py`, báo cáo sinh lại nếu byte đổi) và `phungrk/tohong-back` (`lib/vendorEnrich.js` mã + chữ lý do; báo cáo generated sinh lại nếu cần). Nhánh: `t-234-ai-mode-closed`. Vùng: `planner/vendor`. Không chạy `clean_style_tags.py`.
- Bất biến đã đọc: `planner/vendor/pool/inv-010` (vẫn xanh, check_8), `inv-001..009`, `admin/vendor-enrich/inv-003` (báo cáo commit = sinh lại). Không bất biến nào trong bể coi `closed` là giá trị lạ.
- Không chạm: dữ liệu các PR mở; hạng mục `wrong_category`; Google; app cặp đôi.
- Bậc: B (ADR-155).
- Chạy eval: `TOHONG_REPO=<clone git của nhánh, có ref origin/feat/enrich-hcm-*-batch-01> TOHONG_BACK_REPO=<back đã cài dependencies> python3 -I eval/T-234/check_N_*.py`.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí | Eval |
| --- | --- | --- |
| 1 | `schema.py` đúng một dòng trùng chữ 6 nhánh; nhận 5 giá trị + null/vắng, từ chối biến thể | `python3 -I eval/T-234/check_1_schema_nam_gia_tri_dung_chu_nhanh.py` |
| 2 | Gộp với 6 nhánh không xung đột ngoài `tools/scraper/output/`; schema gộp đúng một dòng (đường lui khi không có ref nào: dòng HEAD đúng chữ) | `python3 -I eval/T-234/check_2_khong_xung_dot_schema_voi_6_nhanh.py` |
| 3 | `closed` (một bản ghi, nhiều bản ghi với found/not_found, vendor mới) vắng pool; biến thể và found còn; nguồn sạch | `python3 -I eval/T-234/check_3_closed_vang_pool.py` |
| 4 | Đảo ngược `closed` bằng `found` hoặc xoá khoá: quay lại pool | `python3 -I eval/T-234/check_4_closed_dao_nguoc.py` |
| 5 | Báo cáo giữ `closed`, gộp theo ưu tiên mới, nhóm/summary không đổi | `python3 -I eval/T-234/check_5_bao_cao_closed_va_uu_tien.py` |
| 6 | Drawer: `closed` -> `ai_mode_closed` (chữ "đóng cửa", khác `not_found`); `not_found` và hỗn hợp -> `ai_mode_not_found` | `python3 -I eval/T-234/check_6_drawer_phan_biet_closed.py` |
| 7 | `ai_mode_flags.py` count có `closed`; check: closed hợp lệ, `no_log`, `invalid_value`, `verified_not_found` với closed | `python3 -I eval/T-234/check_7_ai_mode_flags_nhan_closed.py` |
| 8 | pool/inv-010 và T-231 adv-01 vẫn đạt | `python3 -I eval/T-234/check_8_bat_bien_va_adv_cu_van_xanh.py` |

Ghi chú: check_8 xanh sẵn trên main (rào chắn); 1-7 đỏ trên main.

## Eval cũ mâu thuẫn với ADR-155 (Chief xử lý, tôi không sửa)
Đã chạy trên bản vá tham chiếu, các eval sau **đỏ** vì coi `closed` là giá trị lạ hoặc so khoá `count` cố định:
- `eval/T-232/check_1_bao_cao_giu_du_4_gia_tri.py`: `ODD` có `"closed"`, cần null.
- `eval/T-232/check_3_dem_theo_hang_muc_mot_lenh.py`: `KEYS` không có `closed` (so cả dict).
- `eval/T-232/check_4_schema_tu_choi_gia_tri_la.py`: `ODD` có `"closed"`, cần bị từ chối.
- `eval/T-233/adv-01-ai-mode-flags-bien.py` ca D: so `count` với dict 4 giá trị.
- `eval/T-232/check_5_khong_xung_dot_pr120.py`: hiện xanh (có ref); **đường lui khi không có ref sẽ đỏ** vì `PR120_LINE` là dòng 4 giá trị (nhánh #120 nay khai báo 5 giá trị).
Không đổi: `planner/vendor/pool/inv-010`, T-231 adv-01, T-231 adv-02 (xanh trên bản vá). Không bất biến nào trong `eval/invariants/` cần đổi.

## Bất biến đề xuất (tầng 2)
Mở rộng `planner/vendor/pool/inv-010` thành "vendor có bản ghi `not_found` **hoặc** `closed` vắng pool, nguồn nguyên" (gộp check_3). Chief/spec-critic quyết khi đưa vào bể.

## Không làm
Sửa dữ liệu PR mở (kể cả bổ sung log cho 28 bản ghi `closed`); đổi `not_found` cũ của PR #124 thành `closed`; đổi hạng mục `wrong_category`; đổi tên luật `verified_not_found`; sửa dòng comment trên khai báo schema.

## Câu hỏi mở
Không cho Capu. Việc cho Chief: 28 bản ghi `closed` ở 6 PR dữ liệu không có `ai_mode_result` trong dòng log `google_ai_mode`, nên `ai_mode_flags.py check` sẽ báo `no_log` cho chúng sau khi T-234 merge; cần bổ sung log trên các PR đó theo cách đã chọn cho PR #124 (ADR-153 phụ lục).
