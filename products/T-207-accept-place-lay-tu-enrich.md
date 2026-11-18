---
type: spec
task: T-207
version: 1
tier: C
area: planner/admin/vendor-enrich
repos: [tohong]
confidence: medium-high
sources: [board/T-207.md, decisions/2026-11-18-adr-130-duyet-chi-resolve-overrides.md, products/T-110-duyet-tay-venue.md, products/T-129-capu-bam-la-quyet.md, products/T-135-resolve-tu-chay-pool-o-back.md, eval/invariants/planner/admin/vendor-enrich/inv-001-bao-cao-enrich-phan-hoach.py, eval/invariants/planner/admin/vendor-enrich/inv-003-bao-cao-enrich-commit-bang-sinh-lai.py, eval/invariants/planner/admin/vendor-enrich/inv-004-chu-ky-back-tohong-hq-cung-mot-dinh-nghia.py, eval/invariants/planner/admin/vendor-enrich/inv-007-bao-cao-khong-mang-lien-he-dia-chi.py, eval/invariants/planner/vendor/images/inv-016-khong-ung-vien-ngoai-tinh.py, eval/invariants/planner/vendor/images/inv-017-mot-place-id-mot-dia-chi-goc.py]
---
# T-207 · accept_place lấy thông tin địa điểm từ dữ liệu Enrich, không gọi lại Google khi không cần

## Giả thuyết
Nếu mục accept_place mà admin nhận từ bảng Enrich được điền `resolved` từ chính dữ liệu Enrich (cái bảng admin đang hiển thị) thay vì gọi Place Details, thì số request Google của lô duyệt tay từ bảng Enrich giảm từ 1 mỗi mục xuống 0 (lô T-200: 132 mục, tối đa 132 request, ADR-130). Chỉ số bảo vệ: không mục nào được nhận mà bỏ qua kiểm đóng cửa, tỉnh/thành (INV-016), trùng place (INV-017); chữ ký export không đổi.
Tự tin: trung bình-cao. Phần "bảng admin = báo cáo enrich" đã kiểm trong code (báo cáo tohong -> sinh lại ở back, INV-003 giữ báo cáo đúng từng byte so với dữ liệu); phần số request tiết kiệm là suy ra, chưa đo.

## Bằng chứng đã đọc (không phải giả định)
- `resolve_overrides.py`: mọi accept_place chưa có `resolved` tốn 1 Place Details (place_id) hoặc mở link + 1-2 lượt (link); `place_id` thắng `maps_link`.
- `apply_admin_reviews.py` (`make_entry`): export từ màn admin CHỈ mang `place_id` hoặc `maps_link` (chữ ký Ed25519 phủ place_id, maps_link, reason, nhãn, thời điểm); mọi entry có trường `resolved` bị từ chối `bad_entry`. Vậy admin nhận ứng viên Enrich = entry chỉ có `place_id` của ứng viên.
- `build_enrich_report.py`: dòng báo cáo có `google.{place_id, name, address}` (đều là dữ liệu Google, không phải địa chỉ marry); KHÔNG có `business_status`, KHÔNG có thời điểm từng dòng (chỉ `data_as_of` chung). Dòng audit/log hiện cũng không lưu `businessStatus` (google_maps.py đọc `businessStatus` rồi bỏ).
- INV-007: báo cáo không được mang liên hệ/địa chỉ vendor (marry). Spec này chỉ thêm trường lấy từ Google.

## Quyết định thiết kế (đã chốt trong spec; Capu không cần chọn)
1. **Nguồn dữ liệu = báo cáo enrich trong repo tohong, không phải export.** Resolve (chạy trong repo tohong, sau khi PR `admin-reviews/capu` merge) đọc `output/<state>/enrich-report.json` đã commit. Không đổi tohong-back, không đổi front, không đổi chữ ký export. Lý do toàn vẹn: (a) `place_id` của mục đến từ export có chữ ký Capu; (b) phần "thông tin địa điểm" đến từ báo cáo, và INV-003 buộc báo cáo đã commit bằng đúng byte báo cáo sinh lại từ `vendors.json`/audit do pipeline Google ghi, cùng độ tin cậy với dữ liệu mà bước áp duyệt tay đã tin; (c) export không bao giờ được mang `resolved` (đã bị từ chối, giữ nguyên, có eval). Người dùng admin không thể bơm tên/địa chỉ/trạng thái giả.
2. **Điều kiện "được phủ"** (mục accept_place KHÔNG có `resolved`, CÓ `place_id`, KHÔNG có `maps_link` được xét; cả 3 phải đúng, thiếu một thì gọi Google như hiện tại): dòng báo cáo của `vendor_id` có `google.place_id` đúng bằng `place_id` của mục; `google.business_status` là chuỗi không rỗng; `google.name`, `google.address` không rỗng; `google.checked_at` đúng dạng `YYYY-MM-DDTHH:MM:SSZ` (UTC) và cách lúc resolve **không quá 30 ngày**. Áp cho cả ứng viên đã nhận (`google.matched=true`) lẫn chưa nhận (`false`): bảng Enrich cho nhận cả hai.
3. **Ngưỡng cũ N = 30 ngày.** Lý do: (a) cùng nhịp với `refresh_photos --min-age-days 25` đã dùng trong repo; (b) điều khoản bộ nhớ đệm dữ liệu Google Maps Platform giới hạn lưu tạm theo ngày (nhớ khoảng 30 ngày với toạ độ; chưa tra lại văn bản hiện hành, tự tin thấp: Engineering/Capu không phải dựa vào con số đó, đây chỉ là lý do phụ); (c) vendor đóng cửa giữa hai lần enrich là rủi ro có thật nhưng thấp, và lần enrich sau vẫn bắt được (mục `retry`/`closed_permanently_reported`); 30 ngày bằng nhịp Capu duyệt lô từ bảng. Đổi N chỉ là đổi một hằng số trong `auto_resolve_limits.json` (khoá `enrich_data_max_age_days`); không phải thay đổi hành vi cần spec mới.
4. **Dữ liệu cũ không suy diễn.** Dòng báo cáo hiện tại (chưa có `business_status`/`checked_at` ở nguồn) KHÔNG được phủ: `business_status` thiếu thì gọi Google, không coi "đã nhận = đang mở". Hệ quả thật: lô T-200 hiện có (132 mục) vẫn tốn ~132 request như ADR-130 đã duyệt; lợi ích bắt đầu từ lần enrich kế tiếp (đường thường và `--budget-usd`). Không backfill bằng Google (tốn tiền, Hỏi trước).
5. **Resolve không tự lọc.** Resolve chỉ điền `resolved` (kể cả khi trạng thái đóng cửa hoặc địa chỉ ngoài tỉnh); quyết định đóng cửa/tỉnh/trùng vẫn chỉ nằm ở `overrides.py` khi áp (một nơi, không hai bản luật có thể lệch).

## Hành vi (người dùng/Capu thấy gì)
1. **Mục nhận đúng ứng viên Enrich (được phủ).** Chạy `resolve_overrides.py`: 0 request Google (0 Place Details, 0 Text Search, không mở link), exit 0, `GOOGLE_USAGE text_search=0 photo_details=0 photo_media=0`, mỗi mục in `RESOLVED <vendor_id> <place_id> from=enrich_report`. Khối `resolved` = `{place_id, name=google.name, formatted_address=google.address, business_status, resolved_at=google.checked_at (nguyên văn, KHÔNG phải giờ resolve), resolved_from:"enrich_report"}`. Mọi trường khác của mục và mọi mục khác giữ nguyên byte. Chạy lại: file không đổi byte.
2. **Sau đó áp duyệt tay đủ kiểm.** `enrich.py --category venue` (overrides.py) đọc `resolved` này y như `resolved` từ Google: CLOSED_PERMANENTLY -> `place_closed_permanently`; CLOSED_TEMPORARILY -> `place_temporarily_closed`; địa chỉ Google ngoài tỉnh/thành vendor -> `out_of_province` (INV-016); trùng place_id khác địa chỉ gốc -> `place_conflict` (INV-017). Mục sạch được áp như cũ.
3. **Mục không được phủ giữ hành vi hiện tại.** Mục chỉ có `maps_link`; mục `place_id` mà báo cáo không có dòng cho vendor đó; mục `place_id` khác ứng viên của vendor trong báo cáo (admin dán place_id khác); dữ liệu báo cáo cũ hơn 30 ngày; thiếu `business_status`/`checked_at`/`name`/`address` hoặc `checked_at` sai dạng: gọi Google như hiện nay (`resolved_from` = `place_id` hoặc `link`, `resolved_at` = giờ resolve). Lô hỗn hợp: tổng request Google = đúng số mục không được phủ, mỗi mục tối đa như cũ.
4. **Ước tính và hạn mức chỉ đếm mục không được phủ.** `resolve_overrides.py --dry-run` ("tối đa <n> lượt Places" và danh sách `SẼ RESOLVE`) và `plan_batch.py` (`BATCH_ESTIMATE ... resolve=<n>`, `QUOTA_ALLOWED`) bỏ mục được phủ (công thức mỗi mục không phủ giữ nguyên: place_id = 1 Place Details + 1 Text Search xấu nhất; link = 1 + 2). Lô toàn mục phủ: `resolve=0`, không `QUOTA_EXCEEDED`, không job đỏ. `--max-requests 0` vẫn resolve trọn lô toàn mục phủ (không `budget_stop`); mục không phủ vẫn `budget_stop` như cũ.
5. **Dữ liệu enrich mới mang trạng thái + thời điểm.** Lần enrich (đường thường và `--budget-usd`) ghi, với mọi ứng viên có place_id Google trả (đã nhận, bị từ chối, tạm đóng), `business_status` (nguyên văn Google: OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY; không có thì không ghi) và thời điểm Google trả lời. `build_enrich_report.py` đưa vào `google.business_status` và `google.checked_at` (UTC, `YYYY-MM-DDTHH:MM:SSZ`, đến giây). Dữ liệu cũ không có: `business_status: null`, `checked_at` suy từ dấu thời gian sẵn có nếu có, không thì `null`. Không bao giờ bịa `OPERATIONAL`. Báo cáo vẫn không mang liên hệ/địa chỉ marry (INV-007), vẫn tất định (hai lần sinh = cùng byte).
6. **Chữ ký/export không đổi.** Export của back, `apply_admin_reviews.py`, định nghĩa chữ ký (INV-004) không đổi; entry export có `resolved` vẫn bị từ chối.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (chỉ repo này) · nhánh `t-207-accept-place-tu-enrich` · Vùng: `planner/admin/vendor-enrich`.
- Bất biến đã đọc: `_shared/`, `planner/admin/vendor-enrich/` INV-001 (phân hoạch, `approvable`), INV-003 (báo cáo đã commit = báo cáo sinh lại: PR PHẢI sinh lại và commit `enrich-report.json` bằng code mới, offline), INV-004, INV-007, và `planner/vendor/images/` INV-016, INV-017, INV-020 (mục duyệt tay có quyết định Capu), INV-021, INV-024 (`GOOGLE_REQUEST` in trước mỗi request), INV-035/036 (Google tự chạy chỉ sau merge và theo hạn mức). Spec này không vi phạm bất biến nào; không đổi luật INV-016/017.
- Không chạm: tohong-back, tohong-front, chữ ký/khoá export, luật G1-G6 và luật tỉnh/trùng/đóng cửa, thân workflow (nếu cần đổi `.yml` thì chỉ khi eval 5 đòi; dự kiến không cần), dữ liệu cặp đôi.
- Gợi ý (không bắt buộc, Engineering tự quyết): một hàm "phủ bởi báo cáo" dùng chung cho `resolve_overrides.py` và `plan_batch.py` để hai nơi không lệch; hằng số N trong `auto_resolve_limits.json`; `business_status` ghi ở cả hai đường ghi enrich (`enrichment/pipeline.py` và `enrichment/batch.py`).
- Bậc C (quyết định của Chief): đụng pipeline dịch vụ trả phí và cổng hạn mức tiền, dù không đổi chữ ký/auth/DB. Capu đọc diff hành vi và tự merge.
- Thứ tự merge của PR: PR tohong này một mình (không có PR back/front).

## Tiêu chí chấp nhận và eval
Chạy từ gốc HQ: `python3 -I eval/T-207/<file>` (cần `TOHONG_REPO`; check_7 cần thêm `TOHONG_BACK_REPO`). Offline: Google giả `eval/T-207/_fake`, mạng chặn; chạy đúng CLI như workflow trong bản sao tạm.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mục `place_id` khớp ứng viên tươi (đã nhận lẫn chưa nhận) trong báo cáo: resolve 0 request Google, exit 0, `resolved` điền đúng từ báo cáo với `resolved_from="enrich_report"` và `resolved_at=checked_at`; trường khác/mục khác không đổi byte; chạy lại không đổi byte | `python3 -I eval/T-207/check_1_ung_vien_enrich_khong_goi_google.py` |
| 2 | Sau đó overrides.py vẫn chặn CLOSED_PERMANENTLY, CLOSED_TEMPORARILY, ngoài tỉnh (INV-016), trùng place (INV-017); mục sạch được áp; resolve không tự lọc | `python3 -I eval/T-207/check_2_kiem_dong_cua_tinh_trung_van_chay.py` |
| 3 | Mục dán link, place_id mà báo cáo không biết, place_id khác ứng viên: vẫn gọi Google như cũ; lô hỗn hợp tổng request = số mục không phủ | `python3 -I eval/T-207/check_3_muc_khong_phu_ung_vien_van_goi_google.py` |
| 4 | Ngưỡng 30 ngày: 29 ngày dùng báo cáo; 31 ngày, thiếu `business_status`/`checked_at`/`name`/`address`, `checked_at` sai dạng: gọi Google | `python3 -I eval/T-207/check_4_du_lieu_cu_hoac_thieu_van_goi_google.py` |
| 5 | `--dry-run` và `plan_batch.py` chỉ đếm mục không được phủ; lô toàn mục phủ `resolve=0`, không `QUOTA_EXCEEDED` | `python3 -I eval/T-207/check_5_uoc_tinh_va_dry_run_bo_muc_da_phu.py` |
| 6 | Enrich mới ghi `business_status` + thời điểm (đã nhận, bị từ chối, tạm đóng); báo cáo có `google.business_status`/`checked_at`; dữ liệu cũ là `null`, không bịa; tất định | `python3 -I eval/T-207/check_6_enrich_ghi_trang_thai_va_bao_cao_mang.py` |
| 7 | Chữ ký export kiểm được (ký đúng được nhận, đổi nội dung sau khi ký bị `bad_signature`); export có `resolved` vẫn bị `bad_entry` | `python3 -I eval/T-207/check_7_chu_ky_export_khong_doi.py` |
| 8 | Chi Google không tăng: `--max-requests 0` resolve trọn lô toàn phủ; mục không phủ vẫn `budget_stop`; `--max-requests 1` đúng 1 request có `GOOGLE_REQUEST` in trước, `GOOGLE_USAGE` khớp | `python3 -I eval/T-207/check_8_han_muc_khong_tang.py` |

Trạng thái trên `main` hiện tại (đã chạy): check_1..6 và 8 ĐỎ (đúng lý do: resolve vẫn gọi Google cho mục phủ; ước tính đếm cả mục phủ; enrich/báo cáo chưa có `business_status`/`checked_at`); check_7 XANH (rào hồi quy độc lập với INV-004, "chữ ký không đổi" nên xanh từ đầu là đúng). Không eval nào ERROR.
Ghi chú eval: tiêu chí "mỗi mục báo cáo/dữ liệu hợp đồng" của eval 1-5 giả định tên trường `google.business_status`, `google.checked_at`, `google.name`, `google.address` trong `enrich-report.json` (hợp đồng dữ liệu đã nêu ở Hành vi 5). Eval 6 dùng đường enrich thường; đường `--budget-usd` (batch.py) không có eval riêng: Engineering phải ghi cùng trường ở cả hai đường, adversary nên thêm eval tầng 3 cho đường đó.

## Bất biến đề xuất (tầng 2)
1. (hành vi, rút từ check_1 + check_4) "Resolve không bao giờ gọi Google cho mục accept_place có place_id khớp ứng viên tươi (<= 30 ngày, có `business_status`) trong báo cáo enrich; ngược lại mục không đủ điều kiện luôn gọi Google": vùng `planner/admin/vendor-enrich`, chạy `check_1` + `check_4` làm bất biến.
2. (hành vi, rút từ check_2) "Dữ liệu `resolved` lấy từ báo cáo đi qua đúng các kiểm đóng cửa, tỉnh/thành, trùng place như `resolved` từ Google" (vùng `planner/vendor/images`, cạnh INV-016/017).
3. (tĩnh) `eval/T-207/inv-proposed-resolved-tu-enrich-day-du.py`: mọi mục `resolved_from=enrich_report` trong tohong có `resolved` đủ và `business_status` hợp lệ; mọi `google.business_status`/`checked_at` trong báo cáo hợp lệ hoặc null. Xanh hiện nay ("chưa áp dụng").
4. (tĩnh, đề xuất mở rộng INV-004) export của back không bao giờ mang `resolved`; nguồn `resolved` chỉ là Google hoặc báo cáo enrich trong tohong (check_7 (b)).
Không đề xuất đổi hay xoá bất biến nào hiện có.

## Không làm
- Đổi luật INV-016/017 hay luật đóng cửa; đổi chữ ký/định dạng export; sửa tohong-back hoặc tohong-front.
- Cho export mang `resolved`/tên/địa chỉ do màn admin gửi lên (cố ý: không tin dữ liệu từ trình duyệt).
- Backfill `business_status` cho dữ liệu enrich cũ bằng Google (chi tiền, Hỏi trước); tự merge PR dữ liệu.
- Phủ mục chỉ có `maps_link` (link phải mở và so khớp, giữ hành vi T-110).

## Câu hỏi mở
Một câu (không chặn spec): lô T-200 hiện có 132 mục vẫn tốn khoảng 132 request vì dữ liệu cũ chưa có `business_status` (Hành vi 4, ADR-130 đã duyệt chi này). Capu có muốn bỏ qua (mặc định) hay chạy thêm một lượt enrich để các lô SAU hưởng lợi ngay không? Mặc định của spec: bỏ qua, không chi thêm.
