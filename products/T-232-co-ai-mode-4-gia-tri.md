# Spec T-232: cờ ai_mode_result đủ 4 giá trị ở báo cáo, schema chặn giá trị lạ, kiểm SC-002/SC-004

## Ý định
Hiện thực phần còn thiếu của spec 008 của Capu (`tohong` nhánh `feat/enrich-hcm-invitation-batch-01` = PR #120, `specs/008-ai-mode-result-flag/spec.md`), với FR-009/FR-010 đã thay theo ADR-153. Nguồn: `board/T-232.md`, `decisions/2026-11-28-adr-153-*.md`, `products/T-230-ai-mode-not-found-khong-vao-pool.md` (code T-231 trên tohong main b9b7932).

## Bằng chứng
- Main b9b7932: `build_enrich_report.py` `ai_mode_result_of` chỉ trả `not_found`/`found`/None, nên `address_mismatch`, `wrong_category` thành null (eval check_1, check_2 đỏ trên main). `schema.py` chưa có trường; pydantic mặc định bỏ qua khoá lạ nên mọi giá trị đều "được nhận" (check_4 đỏ). Chưa có công cụ đếm/kiểm cờ.
- PR #120 thêm đúng hai dòng vào `class Vendor` sau `verification_notes` (comment + `ai_mode_result: Optional[Literal[4 giá trị]] = None`).
- Dữ liệu các PR mở (đọc 2026-11-28): invitation (#120) found 20, not_found 33, wrong_category 5, address_mismatch 2, đều có dòng log khớp; wedding_gift (#121) 7/35/1/2, đều có log; #124 (ceremony 25, flower 51 bản ghi `not_found`) **không có dòng log nào** mang `ai_mode_result`. Không bản ghi nào `verified` mà cờ khác `found`.
- Main hiện đã xung đột với PR #120 ở `tools/scraper/output/HCMC/enrich-report.json` (do T-231 sinh lại báo cáo); xung đột dữ liệu sinh lại không do T-232 và được giải bằng sinh lại.

## Giả thuyết
Nếu báo cáo giữ đủ 4 giá trị và có một lệnh đếm/kiểm thì người duyệt đếm được `not_found` từng hạng mục bằng một lệnh (SC-001) và PR dữ liệu lệch quy ước bị bắt trước khi merge. Chỉ số bảo vệ: pool như T-231 (pool/inv-010 xanh), báo cáo không đổi nhóm/summary.

## Hành vi
1. **Báo cáo giữ 4 giá trị.** Khoá `ai_mode_result` của mỗi dòng `enrich-report.json`:
   - một bản ghi: đúng giá trị của bản ghi nếu thuộc 4 giá trị, còn lại null;
   - nhiều bản ghi cùng id: lấy giá trị **ưu tiên cao nhất** có mặt theo thứ tự `not_found` > `wrong_category` > `address_mismatch` > `found`; giá trị lạ bị bỏ qua như vắng; không còn gì thì null. Lý do: (a) `not_found` đứng đầu để báo cáo khớp luật pool của T-230 (một bản ghi `not_found` là vendor vắng pool); (b) `wrong_category` trên `address_mismatch` theo ca biên của spec 008 ("khớp địa chỉ nhưng sai nhóm: ưu tiên `wrong_category`"); (c) mọi giá trị báo vấn đề đứng trên `found` để người duyệt không bỏ sót. Thứ tự bản ghi không ảnh hưởng.
   - Không đổi `group`, `summary` (như T-230 Hành vi 5). Giá trị lạ không làm lỗi báo cáo (khớp T-231 adv-01).
2. **Đếm theo hạng mục bằng một lệnh (SC-001, FR-008).** `python3 ai_mode_flags.py count [--state HCMC] [--output-dir output]` chạy ở `tools/scraper`, in một JSON: khoá là hạng mục nguồn (tên thư mục chứa `vendors.json`), giá trị `{found, not_found, address_mismatch, wrong_category, empty, invalid}` đếm **theo bản ghi của chính file đó** (vendor ở hai hạng mục được đếm ở mỗi nơi theo giá trị nơi đó); cộng lại bằng số bản ghi file. Lọc theo giá trị: báo cáo có khoá theo dòng (mục 1); hạng mục ở báo cáo là hạng mục app (gộp, vd invitation + wedding_gift = stationery), nên đếm theo hạng mục nguồn dùng lệnh này. Lý do không đưa vào `summary` báo cáo: T-230 chốt cờ không đổi summary.
3. **FR-005 "từ chối" nghĩa là hai nơi, không ở pipeline pool:**
   - Schema: `Vendor.model_validate` nhận 4 giá trị, null, vắng khoá (đối tượng đọc ra mang đúng giá trị, vắng = None) và **ném lỗi kiểm tra** với mọi giá trị khác (sai hoa thường, khoảng trắng, chuỗi rỗng, kiểu khác). Cài bằng **đúng hai dòng của PR #120, cùng vị trí, cùng chữ** để git coi là cùng thay đổi: gộp nhánh code với PR #120 không xung đột ở file nào ngoài `tools/scraper/output/` (kiểm bằng `git merge-tree`).
   - Cổng dữ liệu: `ai_mode_flags.py check` báo `invalid_value` (mục 5).
   - **Bước 6 (`build_pool.py`) và báo cáo KHÔNG đọc qua schema và KHÔNG dừng** khi gặp giá trị lạ: giá trị lạ không loại vendor, báo cáo ra null. Lý do: một bản ghi lỗi không được chặn Sync toàn bộ pool; giữ nguyên pool/inv-010 và T-231 adv-01. Giá trị lạ phải bị chặn ở PR dữ liệu bằng `check`, không ở Sync.
4. **Pool giữ hành vi T-231.** `address_mismatch`, `wrong_category`, `found` không ẩn vendor; `not_found` loại (ADR-153 thay FR-009).
5. **Kiểm SC-002, SC-004 chạy được: `python3 ai_mode_flags.py check [--state] [--output-dir] [--base <git ref>]`** ở `tools/scraper`. Mỗi vi phạm in một dòng `AI_MODE_FLAG_VIOLATION <luật> <hạng mục> <id> <chi tiết>`; có vi phạm thì thoát 1, không thì thoát 0 (in `AI_MODE_FLAGS_OK n=<số bản ghi có cờ>`). Luật:
   - `invalid_value`: khoá `ai_mode_result` khác null và ngoài 4 giá trị.
   - `no_log` (SC-002): bản ghi có cờ hợp lệ mà dòng `enrichment_log` `source: google_ai_mode` **cuối cùng có khoá `changes.ai_mode_result`** không mang cùng giá trị, hoặc không có dòng nào như vậy.
   - `verified_not_found` (SC-004, US3 kịch bản 2): `verification_status == "verified"` mà cờ là `not_found`, `address_mismatch` hoặc `wrong_category`.
   - `status_changed` (SC-004, chỉ khi có `--base`): so với bản ghi cùng hạng mục, cùng id ở ref nền, cờ đổi **và** `verification_status` đổi, mà dòng `google_ai_mode` cuối có khoá `changes.verification_status` không mang đúng trạng thái mới. Chỉ thêm cờ, trạng thái giữ nguyên: không vi phạm. Đổi trạng thái có ghi rõ trong dòng log: không vi phạm.
   - **Miễn trừ:** `tools/scraper/ai_mode_flags_exempt.json` = `{"exempt": [{"category", "id", "rule", "reason"}]}`; mục có `reason` không rỗng miễn đúng luật đó cho đúng bản ghi đó (in `AI_MODE_FLAG_EXEMPT ...`, không tính vi phạm); `reason` rỗng thì không có tác dụng. File vắng = không miễn.
6. **Dữ liệu PR #124: Chief đã chọn bổ sung nhật ký (ADR-153, phụ lục).** PR #124 thêm `ai_mode_result: "not_found"` vào `changes` của dòng `google_ai_mode` cuối hiện có của 76 bản ghi (không thêm dòng mới, giữ bằng chứng style tag T-215); không cần miễn trừ. Cơ chế miễn trừ ở mục 5 vẫn có cho trường hợp sau, nhưng không dùng cho PR #124.

## Cập nhật spec 008 (đề xuất câu thay thế, không sửa nhánh của Capu)
- **FR-009 (thay):** "Vendor có `ai_mode_result: not_found` không vào pool vendor (bước Sync loại, dữ liệu nguồn giữ nguyên, đảo ngược bằng đổi cờ; xem T-230/T-231). `address_mismatch`, `wrong_category`, `found` không ẩn vendor. Quyết định: ADR-153."
- **FR-010 (thay):** "Các hạng mục đã enrich trước đó được gắn cờ bù từ `verification_notes` khi Capu yêu cầu (ceremony, flower ở PR tohong#124, ADR-153); bản ghi gắn bù phải có `ai_mode_result` trong `changes` của dòng `enrichment_log` `google_ai_mode` cuối hiện có (dòng đã ghi `verification_notes` đó), để SC-002 đạt; không dùng miễn trừ."
- Assumptions, câu cuối: bỏ "feature này không làm đổi pool và không cần Sync vendor pool riêng"; thay "cờ `not_found` làm đổi pool ở lần Sync kế tiếp (T-231)". Phần "Nguồn dữ liệu thật" bỏ "Vendor `not_found` hiện vẫn nằm trong pool...".

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (`tools/scraper/schema.py` hai dòng y hệt PR #120, `build_enrich_report.py` `ai_mode_result_of`, `tools/scraper/ai_mode_flags.py` mới, báo cáo sinh lại nếu byte đổi (INV-003)). Không chạm tohong-back (drawer chỉ đọc `not_found`). Nhánh: `t-232-ai-mode-4-gia-tri`. Vùng: `planner/vendor`.
- Bất biến đã đọc: `planner/vendor/pool/inv-010` (xanh trên bản vá tham chiếu), T-231 adv-01/adv-02, `planner/admin/vendor-enrich/inv-003` (báo cáo commit = sinh lại). Không đổi bất biến nào.
- Không chạm: Google; dữ liệu các PR enrich mở; app cặp đôi; ẩn vendor theo `address_mismatch`/`wrong_category`; `pool-input-fields.json` (không cần mục mới: build_pool không đọc thêm trường).
- Bậc: B (ADR-153).
- Chạy eval: `TOHONG_REPO=<clone git của nhánh, có ref origin/feat/enrich-hcm-invitation-batch-01> TOHONG_BACK_REPO=<back đã cài dependencies> python3 -I eval/T-232/check_N_*.py`. Offline, bản sao tạm.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí | Eval |
| --- | --- | --- |
| 1 | Báo cáo giữ đúng 4 giá trị (một bản ghi); vắng và giá trị lạ là null; báo cáo sinh được | `python3 -I eval/T-232/check_1_bao_cao_giu_du_4_gia_tri.py` |
| 2 | Nhiều bản ghi: ưu tiên not_found > wrong_category > address_mismatch > found, bỏ giá trị lạ, không phụ thuộc thứ tự | `python3 -I eval/T-232/check_2_gop_nhieu_ban_ghi_theo_uu_tien.py` |
| 3 | `ai_mode_flags.py count` in JSON đếm đúng theo từng hạng mục nguồn | `python3 -I eval/T-232/check_3_dem_theo_hang_muc_mot_lenh.py` |
| 4 | Schema nhận 4 giá trị/null/vắng, ném lỗi với giá trị lạ | `python3 -I eval/T-232/check_4_schema_tu_choi_gia_tri_la.py` |
| 5 | Gộp với PR #120 không xung đột ngoài `tools/scraper/output/`; schema gộp có đúng một khai báo | `python3 -I eval/T-232/check_5_khong_xung_dot_pr120.py` |
| 6 | `check`: `no_log`, `invalid_value`, miễn trừ có lý do; sạch thì thoát 0 | `python3 -I eval/T-232/check_6_sc002_co_co_thi_co_dong_log.py` |
| 7 | `check`: `verified_not_found`, `status_changed` (với `--base`); chỉ thêm cờ không vi phạm | `python3 -I eval/T-232/check_7_sc004_co_khong_doi_trang_thai_xac_minh.py` |
| 8 | Pool như T-231 (address_mismatch/wrong_category/found ở lại, not_found vắng); T-231 adv-01 đạt | `python3 -I eval/T-232/check_8_pool_giu_hanh_vi_t231.py` |

Ghi chú: check_5 và check_8 xanh sẵn trên main (rào chắn); các check còn lại đỏ trên main.

## Bất biến đề xuất (tầng 2)
`planner/vendor`: "`python3 tools/scraper/ai_mode_flags.py check` thoát 0 trên dữ liệu main" (gộp SC-002, SC-004, FR-005 cho dữ liệu thật). Đưa vào bể khi PR #124 (đã bổ sung nhật ký, ADR-153 phụ lục) và các PR dữ liệu mang cờ đã merge.

## Không làm
Gọi Google; sửa dữ liệu PR #120, #121, #124-#133; đổi app cặp đôi; ẩn vendor theo `address_mismatch`/`wrong_category`; đưa đếm cờ vào `summary` báo cáo; bắt build_pool/báo cáo dừng khi gặp giá trị lạ.

## Câu hỏi mở
Không.

## Lịch sử sửa
- 2026-11-28 (sau Spec Gate v1, sửa dựng eval theo tiền lệ ADR-128, không phải spec rework): check_5 thêm đường lui khi không có ref PR #120 (đạt nếu schema.py có đúng một khai báo giống hệt PR #120); bỏ phương án miễn trừ khỏi câu thay thế FR-010 và Hành vi 6, vì Chief đã chọn bổ sung nhật ký (ADR-153 phụ lục).
