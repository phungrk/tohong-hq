# Spec T-150: drawer-moi-admin-nhan-reviews

> v1 · Spec Writer (product) · 2026-11-13 · **bậc C** (chạm auth) · vùng `planner/admin/vendor-enrich` · chạm tohong-back và tohong-front · **nối tiếp** `products/T-147-drawer-vendor-enrich.md` (v2, đã xong; T-147 đã sửa hai câu chữ và có con trỏ về đây) · nguồn quyết định: `decisions/2026-11-13-adr-083-khong-che-lien-he-moi-admin-xem-drawer.md` (Capu trả lời mục 1–4)

Spec này **chỉ nêu phần đổi**. Mọi thứ không nhắc ở đây giữ đúng như T-147 v2. Hai bản mâu thuẫn thì **T-150 thắng**.

## Ý định
Capu (ADR-083, 2026-11-13): (1) không che số điện thoại và link trong dữ liệu vendor; (2) "ai là admin thì đều xem được" drawer; (3) thêm nhãn lý do cho chỗ pool lệch nguồn ở `reviews`: "ok"; (4) sửa hai câu chữ trong spec T-147: "ok".

## Bằng chứng
- **Quyền hiện tại** (đọc mã đã merge, tohong-back): `api/admin.js` route `…/<id>/detail` gọi `isCapu` ngay sau `requirePlatformAdmin`; `lib/vendorEnrich.js` `getEnrichDetail` kiểm `isCapu` lần nữa. Hai chỗ này là toàn bộ "chỉ Capu" của drawer. Approve/Sửa thủ công ghi `by_capu = isCapu(...)`; export ký (`exportEnrich`) chỉ lấy review có `by_capu` hiệu lực; admin khác bấm sau Capu nhận 409 `decided_by_capu`. Tự tin cao (~95%): đọc mã trực tiếp.
- **`field_notes` hiện không có `reviews`**: generator (`tools/generate-vendor-pool.js`) đặt `reviews` = tối đa 5 phần tử `top_reviews` có `text`, dạng `{author, rating, text}`, và **bỏ hẳn trường nếu không có phần tử nào**. Đo trên báo cáo nhúng và pool đang chạy của tohong-back (2026-11-13, chạy thật, 867 vendor trong pool có nguồn): **144 vendor nguồn có chữ đánh giá mà pool không có `reviews`**; **2 vendor pool có `reviews` mà nguồn không có**; 21 vendor khớp; 0 vendor cùng có nhưng khác số phần tử. Tự tin cao (~90%). **Lưu ý cho Capu:** ADR-083 ghi "2 vendor lệch"; đó là kiểu thứ hai. Kiểu thứ nhất (144) là cùng một nguyên nhân (pool nền chưa sinh lại `reviews`, cùng gốc với `rating`/`reviewCount` lệch ở T-147), nên nhãn phủ cả hai kiểu.
- **Drawer hiện bỏ rơi ghi chú của trường vắng**: `EnrichDrawer.jsx` chỉ vẽ ghi chú ngay dưới dòng của trường có trong `pool.vendor`. Với 144 vendor kia `pool.vendor` không có `reviews` nên nhãn mới sẽ vô hình nếu không đổi. Đây là lý do Hành vi 2 có luật "dòng trường vắng".
- **Hai câu chữ T-147**: (a) "tay cầm … khung nhìn > 560px": luật là max = max(min, 90% khung nhìn), min = min(560, khung nhìn); max > min khi 90% khung nhìn > 560, tức khung nhìn từ **623px** (mã dùng `Math.round(0.9·V)`, cùng kết quả cho số nguyên). (b) "chỉ có hai tệp nguồn": danh mục có thêm `extra_inputs` (pool nền, manifest ảnh). **Cả hai đã sửa trong lượt này** ở `products/T-147-drawer-vendor-enrich.md` (có đánh dấu "[Đã sửa ở T-150]").
- **Liên hệ**: ADR-083 mục 1 giữ nguyên hành vi hiện tại (T-148 đóng). Không đổi mã nào cho mục này; chỉ khoá bằng eval để sau này không ai che nhầm.

## Giả thuyết
Nếu mọi admin xem được drawer và mọi chỗ pool lệch nguồn đều có nhãn thì "vì sao vendor này hiện sai" được trả lời ngay trong bảng mà không cần Capu. Chỉ số bảo vệ: người ngoài vẫn 403; Approve, Sửa thủ công và chữ ký export vẫn chỉ Capu; không có khoá liên hệ/địa chỉ nào ra khỏi `pool_input`.

## Hành vi (người dùng thấy gì)

### 1. Quyền: mọi platform admin xem drawer (đổi hành vi có chủ đích, ADR-083 mục 2)
- `GET /api/admin/vendor-enrich/<id>/detail` mở cho **mọi người đăng nhập có user id trong `ADMIN_USER_IDS`**, kể cả khi `CAPU_USER_IDS` rỗng, thiếu hay chỉ có người khác. Admin nhận **đúng cùng thân phản hồi** như Capu (không bớt, không thêm khoá).
- Mọi người còn lại nhận **403 `{"error":"forbidden"}`** (thân đúng một khoá, không lộ vendor nào tồn tại) và không ghi gì: không token, token rác, user không có trong `ADMIN_USER_IDS`, `ADMIN_USER_IDS` rỗng hoặc thiếu, token `dev:` khi `DEV_AUTH_BYPASS` tắt, người chỉ có trong `CAPU_USER_IDS` mà không có trong `ADMIN_USER_IDS`. Kiểm admin vẫn là việc **đầu tiên** của mọi yêu cầu tới `/<id>/detail` (trước kiểm phương thức, id, tìm vendor) nên 403 đi trước 404/400/405.
- Với admin: id không có trong báo cáo 404 `not_found`; id sai dạng 400; POST/DELETE 405. Không ghi R2, không gọi mạng (như T-147).
- **Không đổi, và phải được chứng minh không hồi quy (T-129, inv-004):** Approve và Sửa thủ công của admin không phải Capu vẫn nhận `by_capu=false` ("Chờ Capu"); export ký Ed25519 (`/api/internal/vendor-enrich/export`) chỉ có mục của Capu và không có mục của admin khác; admin khác bấm sau khi Capu đã quyết vẫn nhận 409 `decided_by_capu`; mở drawer không tạo hay đổi review nào.
- Drawer: câu 403 đổi từ "Chỉ Capu xem được chi tiết này" thành **"Chỉ admin xem được chi tiết này"**. (Người không phải admin thường không tới được bảng; câu này chỉ hiện nếu quyền đổi giữa phiên.) 404 và lỗi khác giữ nguyên.
- Bàn giao cho Engineering (nêu cho khỏi đoán): xoá kiểm quyền Capu ở **cả hai** chỗ (route và `getEnrichDetail`); không đổi `isCapu`, `requirePlatformAdmin`, hay bất kỳ chỗ nào của Approve/Sửa/export.

### 2. `field_notes` thêm trường `reviews`
- Trường mới `reviews` đứng **sau `styles`** trong thứ tự của `field_notes` (thứ tự mới: `name, category, city, description, rating, reviewCount, priceMin, priceMax, styles, reviews`).
- Quy tắc: N = số phần tử `top_reviews` **có `text`** của bản ghi nguồn, tối đa 5; M = số phần tử `reviews` của vendor trong pool (thiếu = 0). **N khác M** thì thêm đúng một ghi chú `{field:"reviews", code:"kept_from_base", text:"giữ từ pool nền (ADR-025, --styles-only): nguồn hiện có <N> bài đánh giá có chữ, pool có <M>"}`. N bằng M thì không có ghi chú. Chỉ so **số lượng**, không so nội dung (nội dung nguồn bị cắt `max_chars` khi nhúng nên so chữ sẽ sai; giới hạn này ghi thẳng ở đây). Vendor ngoài pool hoặc báo cáo không có nguồn: `field_notes` vẫn như cũ (`[]` hoặc theo luật T-147).
- Mã `kept_from_base` và chữ phần đầu giữ y các trường khác; chỉ phần sau dấu hai chấm khác (đếm bài thay cho giá trị), vì giá trị là danh sách đối tượng dài, không in nguyên.
- **Dòng trường vắng (drawer):** mỗi `field_notes[]` phải hiện ra. Nếu `field` của ghi chú **không có** trong `pool.vendor` (ca 144 vendor) thì drawer vẽ một dòng "<tên trường> —" ở **cuối danh sách trường pool** rồi ngay sau là ghi chú; nếu có thì như cũ (ngay sau dòng của trường). Giao diện không liệt kê cứng tên trường.

### 3. Không che liên hệ (ADR-083 mục 1)
Không đổi gì: số điện thoại, URL, zalo trong `description` và `marry.address` hiện nguyên văn; `pool_input` vẫn **không có khoá** `contact`/`phone`/`email`/`website`/`facebook`/`address`/`address_source` (inv-007 giữ nguyên, file không sửa). Một eval ghim cả hai nửa: chữ nguyên văn, khoá vắng.

### 4. Hai câu chữ spec T-147 (ADR-083 mục 4)
Đã sửa trong lượt này, tại `products/T-147-drawer-vendor-enrich.md`: tay cầm kéo hiện từ khung nhìn **623px** (561–622px: drawer 560px, không tay cầm); danh sách "dùng để tạo pool" = hai tệp nguồn **cộng** hai đầu vào ngoài tệp (`extra_inputs`). Không đổi hành vi nào của mã (mã đúng, câu sai).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · nhánh `t-150-detail-moi-admin` (route, `getEnrichDetail`, `fieldNotes`, test); `phungrk/tohong-front` · nhánh `t-150-drawer-nhan` (câu 403, dòng trường vắng). Không chạm `phungrk/tohong`. Vùng: `planner/admin/vendor-enrich`.
- Thứ tự merge: **back trước**, front sau (front merge sớm chỉ hiện dòng "—" thừa nếu back chưa gửi ghi chú: an toàn). Capu merge cả hai (bậc C).
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/` (inv-005 Worker khởi động), `planner/admin/vendor-enrich/` inv-001…007. Spec **không vi phạm**: inv-004 (chữ ký) giữ vì export/Approve không đổi (eval #1 chạy kịch bản của nó lại); inv-007 giữ vì không thêm khoá (eval #5); inv-003 (báo cáo commit) không đổi vì không đụng tohong. Không đề nghị đổi bất biến nào. Kích thước Worker: thêm vài dòng mã, eval T-147 #5 vẫn là ngưỡng.
- Chạm auth nên bậc **C**: Capu đọc diff hành vi và tự merge. Mở cho admin là nới quyền đọc (không nới quyền ghi); mọi admin đã đọc được ghi đè và `contact` qua `GET /api/admin/vendors/<id>`, route này chặt hơn route đó (ghi trong T-147).
- Không chạm: payment, schema DB, dữ liệu cặp đôi, `vendorPool.generated.js`, `vendor_overrides.json`, `decisions/`.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; repo qua `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO` / `TOHONG_REPO`, rồi `../tohong-back`, `../tohong-front`, `../tohong`. Mỗi tiêu chí đúng một eval. **Ai sửa file eval:** các eval #1, #2, #3 là file của T-147 mà **product (Spec Writer) đã sửa ngay trong lượt này**, trong đúng phạm vi ADR-083 (đổi hành vi có chủ đích, không phải sửa cho khớp code; tiền lệ ADR-074); Engineering và adversary không sửa chúng. Eval #4, #5 là file mới ở `eval/T-150/`. Không thay bằng eval mới nào nên Chief of Staff **không cần đăng ký lại** các lệnh của T-147: nhưng `task.py evals T-150` đăng ký chúng vào việc này.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mọi admin (Capu; admin khi `CAPU_USER_IDS` rỗng/thiếu/chỉ người khác) GET detail 200 với thân giống Capu, id lạ 404, id sai 400, POST/DELETE 405; người ngoài (7 kiểu × 5 đường) 403 `forbidden`; không ghi R2; Approve của admin khác `by_capu=false`, export ký chỉ có mục của Capu, 409 `decided_by_capu` còn nguyên | `cd /home/user/tohong-hq && bash eval/T-147/check_4_quyen_chi_tiet.sh` |
| 2 | `field_notes` có `reviews` đúng quy tắc N khác M, đúng chữ, đúng thứ tự, cho mọi vendor trong pool có nguồn (cả hai kiểu lệch: nguồn có/pool không, pool có/nguồn không) | `cd /home/user/tohong-hq && bash eval/T-147/check_3_api_chi_tiet.sh` |
| 3 | Drawer hiện ghi chú `reviews` kể cả khi pool không có trường `reviews` (dòng "reviews —" rồi ghi chú); 403 ghi "Chỉ admin xem được chi tiết này"; mọi hành vi còn lại của drawer T-147 giữ (cùng file eval) | `cd /home/user/tohong-hq && bash eval/T-147/check_6_ui_drawer.sh` |
| 4 | Spec T-147 không còn hai câu sai; ngưỡng 623px khớp phép tính độc lập; danh mục thật có đúng hai `extra_inputs` | `cd /home/user/tohong-hq && python3 -I eval/T-150/check_4_cau_chu_spec.py` |
| 5 | Không che liên hệ: mô tả nguồn còn nguyên số điện thoại/URL, detail trả nguyên văn, `pool_input` không có khoá liên hệ/địa chỉ, inv-007 PASS và file không đổi | `cd /home/user/tohong-hq && bash eval/T-150/check_5_khong_che_lien_he.sh` |

Đã chạy thử: trên `main` hiện tại #1, #2, #3 **đỏ đúng chỗ đổi** (không ERROR), #4 và #5 xanh (#5 là khoá không-đổi). Trên bản sao tạm của tohong-back có vá tối thiểu (bỏ hai chỗ kiểm Capu; thêm ghi chú `reviews`) #1 và #2 xanh, nên eval thoả được. #3 chưa thử xanh vì cần mã front (Engineering).
Các eval T-147 #1, #2, #5 không đổi và không liên quan thay đổi này.

## Bất biến đề xuất (tầng 2)
**Quyền chi tiết drawer = ADMIN_USER_IDS, ghi/ký = Capu** (đề xuất cho Spec critic rút khi spec qua cổng; bản chạy được là phần "không hồi quy" của `eval/T-147/check_4_quyen_chi_tiet.mjs`, cần tách thành `eval/invariants/planner/admin/vendor-enrich/inv-008-…py` bởi spec-critic): (a) người ngoài `ADMIN_USER_IDS` luôn 403 ở route chi tiết, (b) review của admin không phải Capu không bao giờ thành mục ký. Lý do: lần này nới quyền đọc; không có bất biến thì lần nới sau có thể nới luôn quyền ghi mà không ai thấy. Ý (b) inv-004 đã bao một phần; ghi riêng cho rõ ý. Không đề nghị gì khác.

## Không làm
- Che số điện thoại/URL/zalo hay địa chỉ (ADR-083 mục 1; T-148 đóng).
- Mở Approve, Sửa thủ công, Rút lại hay export ký cho admin không phải Capu; đổi `isCapu`/`requirePlatformAdmin`.
- Thêm trường nào khác vào `field_notes`, hay so nội dung đánh giá (chỉ số lượng).
- Sinh lại pool, đổi báo cáo, đổi tohong, workflow, `regen-pool-styles.sh`.
- Nhãn hay vai trò mới trong drawer (ví dụ "Bạn là admin, không phải Capu"): ngoài phạm vi.

## Câu hỏi mở
Không. (Ghi chú, không cần quyết: ADR-083 nói "2 vendor lệch" `reviews`, đo thực là 144 + 2; nhãn phủ cả hai kiểu theo cùng một quy tắc. Nếu Capu chỉ muốn nhãn cho kiểu 2 vendor thì báo lại, đổi một điều kiện.)
