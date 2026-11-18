# Spec T-212: Test lọc Status của back phải theo chữ cột Status (sửa test, không sửa hành vi)

## Ý định
PR "Sync vendor pool" từ dữ liệu tohong `resolve-overrides/run-44412131387` (commit 9c341703b3b6ec8cdffab72618bbadc5f7636b48) phải xanh. Hiện đỏ ở `tohong-back/test/test_vendor_enrich.js:266` (expected 220, actual 222). Nguồn: `board/T-212.md`.

## Bằng chứng
- Dựng lại offline (sinh pool + nhúng báo cáo đúng các bước `sync-vendor-pool.yml`, `regen-pool-styles.sh --back . --photos-for all`, `generate-vendor-enrich-report.js --from …/enrich-report.json`) trên bản sao của back `origin/main` (241166c): `node --test test/test_vendor_enrich.js` → 14 pass, 1 fail, đúng dòng 266, 220 vs 222. Tái hiện được 100%.
- Dữ liệu mới có 223 hàng `group=name_similar`; trong đó **2 hàng có `override`**: `marry_71ab04906a99` (ÁO DÀI DULY) và `marry_ed3c040233be` (Chi Bridal - Quận Thủ Đức), đều `override.action=accept_place`, `approved_on=2026-11-18`, `google.matched=false`. Chính là hai mục lỗi `place_closed_permanently` của OVERRIDE_SUMMARY: tohong ghi nhận duyệt tay nhưng KHÔNG áp được (`overrides.py:324`), nên `group` ở lại `name_similar` còn `override` vẫn có. Cả hai vẫn nằm trong pool (inpool=true).
- Dòng 266 đếm `rows.filter(group==="name_similar" && !override && id!==ns.id)` = 223 − 2 − 1(ns, đã chuyển sang Chờ áp dụng) = 220. API trả 222 = 223 − 1: tính cả 2 hàng override.
- Trước giờ không hàng override nào nằm nhóm `name_similar` (nên `!r.override` vô hại); run 44412131387 là lần đầu có.
- Chữ cột Status của hàng override (`tohong-front/src/admin/EnrichTable.jsx:215`) là **nhãn nhóm + nhãn "Đã duyệt tay"** (`<Badge>{label}</Badge><Badge>Đã duyệt tay</Badge>`) → hàng đó đúng là "Tên hơi giống" VÀ "Đã duyệt tay". Spec T-197 (Hành vi 2) và `eval/invariants/planner/admin/vendor-enrich/inv-015` định nghĩa y như vậy; code API `lib/vendorEnrich.js` `statusOk` (`!pend && r.group === status`) khớp. INV-015 chạy trên dữ liệu mới: PASS (kể cả "override: 136 hàng", chia đủ 870).
- Tự tin ~95%. Dòng 270 của chính test (`status=override` đếm `rows.filter(r => r.override)`) đã ngầm thừa nhận override là một ô Status chồng với nhóm.

## Giả thuyết
Nếu sửa dòng đếm của test cho khớp chữ cột Status thì sync-vendor-pool chạy xanh với dữ liệu hiện tại và mọi dữ liệu sau, không đổi hành vi API. Chỉ số bảo vệ: INV-015 vẫn xanh; không hàng nào bị lọc mất khỏi `status=name_similar`.

## Hành vi (người dùng thấy gì)
Kết luận: **hành vi sản phẩm ĐÚNG, giả định của test SAI. Sửa chỉ ở test.**
1. Admin chọn Status = "Tên hơi giống": thấy mọi hàng có chữ Status "Tên hơi giống", gồm cả hàng đã "Đã duyệt tay" mà nhóm vẫn là name_similar (hai hàng nêu trên, mỗi hàng hai nhãn). Không hàng nào bị ẩn vì có override.
2. Cũng hai hàng đó xuất hiện khi chọn Status = "Đã duyệt tay".
3. Test dòng 266 phải đếm `group === "name_similar"` và loại đúng những hàng đang rời nhóm vì review chờ (ở đây chỉ `ns`), KHÔNG loại theo `override`. Ý nghĩa: số kỳ vọng tính từ chữ cột Status, không từ một giả định về override.
4. Dữ liệu tohong không đổi (phạm vi Capu). Hai vendor đóng cửa vĩnh viễn ở lại trong pool với nhãn "Đã duyệt tay" cho đến khi Capu đổi override sang `remove`: đó là việc dữ liệu riêng, ngoài T-212 (xem Câu hỏi mở).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-212-...` · Vùng: `planner/admin/vendor-enrich`
- Bất biến đã đọc: `_shared/`, `planner/admin/*`, `planner/admin/vendor-enrich` — spec không vi phạm INV-015 (chính là điều nó bảo vệ); không đề nghị đổi bất biến nào.
- Thay đổi cho phép: chỉ `test/test_vendor_enrich.js` (dòng 266: bỏ `&& !r.override` khỏi bộ lọc kỳ vọng). Không sửa `lib/vendorEnrich.js`, không sửa file `*.generated.js` tay, không sửa dữ liệu tohong. Dòng 257 (`ns` chọn hàng chưa override) giữ nguyên.
- Không chạm: payment, auth, schema, dữ liệu người dùng, BACK_DISPATCH_TOKEN.
- Bậc đề xuất: A về rủi ro (chỉ test) nhưng giữ **B** theo board (đã đặt, không hạ).

## Tiêu chí chấp nhận và eval
Chạy từ gốc tohong-hq; đặt `TOHONG_BACK_REPO` (nhánh cài đặt của back), `TOHONG_REPO` (có commit 9c341703; `git fetch origin resolve-overrides/run-44412131387`); tuỳ chọn `TOHONG_DATA_REF`. Mọi eval sinh lại dữ liệu vào bản sao tạm, không ghi vào repo gốc.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Sinh lại pool + báo cáo từ commit 9c341703 như sync-vendor-pool.yml thì `npm test` của back xanh (hiện ĐỎ: 220 vs 222) | `bash eval/T-212/check_1_npm_test_xanh_tren_du_lieu_moi.sh` |
| 2 | Trên dữ liệu đó, với mọi khoá Status và mọi hàng, bộ lọc khớp chữ cột Status (INV-015) | `bash eval/T-212/check_2_loc_status_khop_chu_hien_thi_tren_du_lieu_moi.sh` (hiện xanh, bảo vệ chống sửa sai hướng) |
| 3 | Hai hàng override nằm nhóm name_similar có mặt ở CẢ `status=name_similar` và `status=override`; tổng `status=name_similar` = số hàng group name_similar (ở lúc chưa gieo review) | `node eval/T-212/check_3_hang_da_duyet_tay_van_nam_trong_nhom_cua_chu_status.mjs` (hiện xanh, như trên) |

Chỉ tiêu chí 1 đỏ — đúng vì lỗi nằm ở test. Tiêu chí 2, 3 xanh sẵn là chủ ý: chúng khoá hành vi đúng để Engineering không "sửa" API cho khớp test. Cách hiểu thứ hai cần chặn: "đưa override ra khỏi `status=name_similar`" — bị 2, 3 chặn.

## Bất biến đề xuất (tầng 2)
Không (INV-015 đã bao trọn). Gợi ý nhỏ cho spec-critic: không thêm bất biến mới; nếu muốn khoá thêm, mở rộng INV-015 ghi rõ "hàng override ở lại ô nhóm của nó".

## Không làm
Sửa API lọc; sửa dữ liệu tohong hay override của Capu; BACK_DISPATCH_TOKEN; tự động gỡ hai vendor đóng cửa; đổi chữ cột Status.

## Câu hỏi mở
Hai vendor Chi Bridal và Áo dài Duly đã đóng cửa vĩnh viễn trên Google nhưng override của Capu là `accept_place` nên chúng vẫn trong pool; có đổi sang `remove` không? (Việc dữ liệu của Capu, không chặn T-212.)
