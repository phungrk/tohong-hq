# Spec T-204: Cờ ADMIN_OPEN bật thì thao tác admin tính là Capu (ký export được)

## Ý định
Capu 2026-11-18 (ADR-126, `decisions/2026-11-18-adr-126-co-mo-admin-tinh-la-capu.md`): không muốn tắt cờ ("hiện chỉ mỗi mình anh đang test web app này"); chọn "cách 2, merge luôn khi xong": khi `ADMIN_OPEN === "1"`, mọi thao tác admin, kể cả 132 review T-200 đã ghi dưới danh tính cố định lúc cờ đang bật, tính là quyết định của Capu và đi vào export ký. Cờ tắt thì mọi thứ như cũ. Nguồn: `board/T-204.md`.

## Bằng chứng
- ADR-126, ADR-116 (danh tính cố định), ADR-117 (bất biến planner/admin inv-001..004), ADR-125 (cờ giữ khi deploy).
- Đọc mã back (`/home/user/tohong-back`): `lib/adminAuth.js` `isCapu` loại `OPEN_ADMIN_ID` ở một chỗ; `lib/vendorEnrich.js`: `effective(env, rv)` = `rv.by_capu === true && isCapu(env, rv.reviewed_by)` tính LÚC ĐỌC (dùng cho liệt kê, lọc status, export, và chặn 409 `decided_by_capu` ở `putEnrichReview`/`withdrawEnrichReview`); `putEnrichReview` lưu `by_capu: isCapu(env, by)` lúc ghi; `exportEnrich` ký nhãn `labelOf(reviewed_by)` = `"admin:" + 8 hex đầu SHA-256(reviewed_by)`; `api/admin.js` ghi nhật ký `admin_id`, `before`, `after` (= nguyên bản review). Bản ghi 132 review cũ: `reviewed_by="admin-khong-dang-nhap"`, `by_capu=false` đã nằm trong R2.
- Đọc mã tohong: `tools/scraper/apply_admin_reviews.py` `make_entry` đòi `by_capu === true`, chữ ký Ed25519, `reviewer_label` khớp `admin:[0-9a-f]{8}`, không `reviewed_by`, không Clerk id thô trong cả mục; trường lạ khác (vd `via`) được bỏ qua (chỉ chép trường đã biết). `eval/lib/capu_decision.py` có `DEC_RE` cùng dạng nhãn. Workflow `apply-admin-reviews.yml` dựng lại PR từ TOÀN BỘ export mỗi lần chạy.
- Tự kiểm: một bản cài giả 5 dòng (ở thư mục tạm, không đụng repo) làm cả 7 eval PASS; trên main thật cả 7 đỏ (vì hành vi mới). Tự tin ~85% rằng cài đặt thật theo cùng đường sẽ xanh.

## Giả thuyết
Nếu cờ bật thì quyết định của Capu trên web app mở (kể cả 132 review đã có) vào export ký ngay mà không phải tắt cờ hay duyệt lại. Chỉ số bảo vệ: cờ tắt hoặc khác đúng `"1"` thì không đổi byte nào so với hôm nay; export vẫn qua `apply_admin_reviews.py` thật.

## Hành vi (người dùng thấy gì)

Định nghĩa: **danh tính cố định** = đúng chuỗi `admin-khong-dang-nhap`. **Cờ bật** = `ADMIN_OPEN` của Worker đúng chuỗi `"1"`; thiếu, rỗng, `0`, `true`, `yes`, `on`, ` 1`, `1 `, `01`, `TRUE`... đều là **tắt**. **Hiệu lực của review** (`by_capu` hiệu lực) là giá trị back dùng để hiện "Chờ áp dụng", lọc `status`, quyết định vào export và chặn 409.

**Quyết định thiết kế (trả lời câu "lúc đọc hay lúc ghi")**: hiệu lực được tính LÚC ĐỌC từ cờ hiện tại, không lưu thành quyền trên bản ghi. Quy tắc duy nhất:
- Review có `reviewed_by` = danh tính cố định: hiệu lực `by_capu` = (cờ bật). Trường `by_capu` lưu trong bản ghi, trường `via`, `ADMIN_USER_IDS`, `CAPU_USER_IDS` đều không ảnh hưởng.
- Review có `reviewed_by` khác: giữ y như hôm nay (`by_capu` lưu là true VÀ `reviewed_by` là Capu thật theo `isCapu` hiện tại).
- `isCapu(env, id)` với id = danh tính cố định trả (cờ bật); mọi id khác như cũ.
Lý do chọn đọc-lúc-đọc: (1) 132 review đã ghi mang `by_capu=false` và phải tính ngay, không cần chạy bước di trú ghi lại R2 (chạm dữ liệu người dùng, không đảo ngược); (2) quyền "là Capu" của danh tính cố định chỉ có nghĩa khi cờ còn bật, nên tắt cờ là thu hồi tức thì, đúng ADR-126 "cờ tắt giữ nguyên luật cũ"; ghi-lúc-ghi sẽ biến một khung giờ mở cờ thành quyền Capu vĩnh viễn cho bất kỳ ai có link.

1. **Cờ bật, review cũ.** Review đã ghi từ trước của danh tính cố định (`by_capu=false`, hoặc vắng trường) hiện "Chờ áp dụng" (`review.by_capu=true` trong `GET /api/admin/vendor-enrich`, lọc `status=pending_apply` có chúng, `pending_capu` không có), và có mặt trong export ký (`by_capu=true`). Đọc/xuất không ghi lại R2.
2. **Cờ bật, review mới.** Approve, Sửa thủ công (link, gỡ...) của mọi yêu cầu `/api/admin/*` (danh tính luôn là cố định, bất kể token): phản hồi `review.by_capu=true`, `reviewed_by` = danh tính cố định, hiện "Chờ áp dụng", vào export. Admin thường không phải Capu (bản ghi cũ của Clerk id không có trong `CAPU_USER_IDS`) vẫn "Chờ Capu", không vào export.
3. **Cờ tắt (hoặc khác đúng `"1"`).** Danh tính cố định không bao giờ là Capu: mọi bản ghi của nó (by_capu=false, vắng, hay by_capu=true do ghi lúc cờ bật) hiện "Chờ Capu", không vào export, `waiting_capu` đếm chúng; dù `ADMIN_USER_IDS`/`CAPU_USER_IDS` liệt kê chính chuỗi đó. Capu thật (trong cả hai danh sách) vẫn duyệt và ký như hôm nay. **Số phận review khi cờ tắt về sau**: chúng ngừng được tính là của Capu ngay lần đọc kế tiếp (về "Chờ Capu", rời export), không bị xoá hay sửa; bật cờ lại thì tính lại. Nếu export đã được lấy và áp dụng (PR tohong của Capu merge) trước khi tắt cờ, phần đã áp dụng ở pool tohong không bị back thu hồi (chữ ký đã hợp lệ lúc đó; workflow dựng PR từ export hiện hành nên lần chạy sau khi cờ tắt không còn mục đó). Chọn "ngừng tính" thay vì "tính tiếp nếu đã ký" vì: bản ghi chỉ trở thành chữ ký khi xuất và áp dụng; trước đó nó chỉ là ý định chờ, không có gì để "đã ký".
4. **Nhãn và nguồn gốc trong export.** Mục export của review do danh tính cố định: `reviewer_label` = `"admin:" + 8 hex đầu SHA-256("admin-khong-dang-nhap")` = **`admin:2ddfc6ef`** (cố định, nằm trong phần được ký, khác nhãn của mọi Capu thật; dạng khớp `LABEL_RE` của apply) và thêm trường `via: "admin_open"` (không ký, chỉ để người đọc export thấy "cờ mở admin"). Mục của Capu thật không có trường `via` và giữ nhãn băm của chính họ. Không mục nào có `reviewed_by`, Clerk id thô hay chuỗi `admin-khong-dang-nhap`. Chữ ký mọi mục kiểm được theo định nghĩa chuẩn `eval/lib/capu_decision.py`; đổi nhãn thì chữ ký hỏng. Không đổi cách ký, thứ tự trường, định dạng nhãn.
5. **Apply đầu-cuối.** Export có mục của danh tính cố định (cũ + mới: Approve, link, gỡ) được `tools/scraper/apply_admin_reviews.py` thật nhận: `APPLY_OK`, mục sinh ra qua `check_entry` chuẩn, `decision` chứa `:admin:2ddfc6ef@`, `reason` chứa `[duyệt qua admin: admin:2ddfc6ef,`, `approved_by=capu`. Không sửa repo tohong (phạm vi một repo: back).
6. **Chặn 409 `decided_by_capu` theo cờ.** Luật không đổi: bản review "đang của Capu" (hiệu lực lúc này) chỉ bị ghi đè/rút bởi người cũng là Capu (hiệu lực lúc này). Cờ bật: danh tính cố định là Capu nên ghi đè/rút được bản của Capu thật và bản của chính nó (200). Cờ tắt/khác `"1"`: bản của Capu thật vẫn 409 với admin thường; bản của danh tính cố định (kể cả by_capu=true lưu lúc bật) không còn "của Capu" nên admin thường ghi đè/rút được (200), kết quả `by_capu=false`. Kiểm vẫn nằm trong vòng đọc-sửa-ghi có etag.
7. **Nhật ký.** Cờ bật: dòng nhật ký `vendor_enrich.review` có `admin_id` = danh tính cố định, `after.by_capu=true`, `after.via="admin_open"` (trường `via` được lưu lúc ghi chỉ để tra cứu, không bao giờ quyết định quyền); dòng rút có `admin_id` cố định. Cờ tắt, Capu thật ghi: dòng nhật ký có `admin_id` của Capu và không có `via`.

Ai thấy gì (diff hành vi cho Capu): với cờ bật, bất kỳ ai mở được `?admin=` ký được export dưới tư cách Capu (rủi ro Capu đã nhận ở ADR-126; phải tắt cờ trước khi mở web app cho người khác; tắt cờ là thu hồi ngay). 132 review T-200 sẽ hiện "Chờ áp dụng" và vào export ở lần đọc đầu sau deploy; lần chạy `apply-admin-reviews` kế tiếp (cron 03:17 UTC hoặc chạy tay) tạo PR dữ liệu bậc C để Capu duyệt, không merge tự động.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` (một repo; front và tohong không đổi: badge "Chờ áp dụng" của `EnrichTable.jsx` đọc `review.by_capu` từ API) · Nhánh: `t-204-co-mo-admin-la-capu` · Vùng: `planner/admin`
- Chỗ đổi dự kiến (gợi ý, eval không đòi): `isCapu` và `effective` trong `lib/vendorEnrich.js`; `via` ở `buildReview` và `exportEnrich`. Giữ cổng duy nhất `requirePlatformAdmin`; không rải kiểm tra cờ.
- Bất biến đã đọc: `_shared/`, `planner/admin/inv-001..006`, `members/`, `vendor-enrich/inv-001..015`. Xung đột: xem mục sau. Không vi phạm inv-001, 003..006, vendor-enrich inv-004, 010, 015 (chúng dùng Clerk id thật hoặc cờ tắt).
- Không chạm: schema `vendor_enrich_reviews.json` (chỉ thêm trường tuỳ chọn `via`; `validReview` hiện không cấm trường thừa), cách ký, export format ngoài trường `via`, route ngoài `/api/admin/*`, giá trị mặc định của cờ, biến môi trường, repo tohong, pool.
- Bậc: **C** (xác thực, danh tính Capu); ADR-126 cho phép Chief merge sau Spec Gate + Code Gate GREEN + adversary accept.

## Xung đột với bất biến / eval hiện có (để Chief xử lý lúc merge, spec không sửa gì)
- **Bể, tầng 2 của mọi việc planner/admin**: `eval/invariants/planner/admin/inv-002-danh-tinh-co-dinh-khong-bao-gio-la-capu.sh` (+ `case B` trong `lib/admin_open_back.mjs`): ĐỎ khi T-204 xong, đúng như ADR-126. **Lưu ý cổng**: Code Gate chạy inv-002 ở tầng 2 và luật CLAUDE.md "tầng 2 đỏ → spec rework ngay"; Chief cần quyết trước Code Gate (gỡ inv-002 trước khi chạy cổng cho T-204, hoặc adversary ghi nhận đỏ có chủ đích kèm ADR-126) để việc không bị trả về oan.
- Không xung đột (đã đọc, dùng Clerk id thật, không dính danh tính cố định): vendor-enrich inv-004, inv-010 (a,b,c,d), inv-015; planner/admin inv-001, 003, 004, 005, 006; members INV-001..006; `_shared`.
- Eval đóng của việc cũ, KHÔNG chạy trong cổng của việc khác (ADR-117 để ngoài bể) nhưng sẽ đỏ nếu ai chạy lại: `eval/T-188/check_2*` và `check_back.mjs` case 2 (danh tính cố định by_capu=false), `eval/T-190/adv-01.mjs` (b) (cờ bật, danh tính cố định ghi đè bản Capu thật → 409; nay 200), `eval/T-199/adv-01-api-bien-va-co-admin-open.mjs` (e) ("Chờ Capu, không bao giờ Chờ áp dụng"). Đề nghị ghi "superseded by ADR-126" trong `decisions/` khi merge; không sửa.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; mọi eval dựng worker thật + R2 giả của `tohong-back` (`TOHONG_BACK_REPO`, mặc định `../tohong-back`; gốc HQ dò ngược tới `scripts/gate.py`, ADR-070), mạng bị chặn, không ghi vào repo. Bản ghi cũ được gieo thẳng vào R2 giả đúng dạng trước T-204 (không qua code mới).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Cờ bật: review cũ (by_capu=false/vắng) của danh tính cố định hiện "Chờ áp dụng", vào export; admin thường vẫn "Chờ Capu"; đọc không ghi R2 | `node eval/T-204/check_1_cu_hieu_luc_khi_co_bat.mjs` |
| 2 | Cờ bật: review mới (Approve/link/gỡ, mọi token) by_capu=true, "Chờ áp dụng", vào export | `node eval/T-204/check_2_review_moi_khi_co_bat.mjs` |
| 3 | Cờ tắt/khác "1" (10 giá trị × có/không liệt kê trong danh sách): không bao giờ là Capu, không vào export; Capu thật vẫn ký; đảo cờ trên cùng kho tắt/tính lại, không ghi R2 | `node eval/T-204/check_3_co_tat_khong_tinh.mjs` |
| 4 | Export: nhãn `admin:2ddfc6ef` + `via:"admin_open"` cho danh tính cố định; Capu thật không `via`, nhãn riêng; chữ ký đúng chuẩn; không id thô | `node eval/T-204/check_4_nhan_va_nguon_goc.mjs` |
| 5 | Export mở-admin qua `apply_admin_reviews.py` thật: APPLY_OK, mục hợp lệ chuẩn, mang nhãn | `python3 -I eval/T-204/check_5_apply_nhan_entry_co_mo.py` |
| 6 | 409 `decided_by_capu` theo cờ (bật: 200; tắt: Capu thật vẫn 409, bản danh tính cố định không chặn) | `node eval/T-204/check_6_chan_409_theo_co.mjs` |
| 7 | Nhật ký: `via` và `admin_id` cố định khi cờ bật; Capu thật cờ tắt không `via` | `node eval/T-204/check_7_nhat_ky_nguon_goc.mjs` |

Trên main hiện tại cả 7 đỏ (đã chạy, `env -i`); trên bản cài giả 5 dòng cả 7 PASS. Đột biến chủ ý: lưu quyền lúc ghi (không tính lúc đọc) làm 1 đỏ; bỏ `via` làm 4, 7 đỏ; đổi nhãn thành chuỗi tiếng Việt làm 5 đỏ (apply từ chối); hiểu cờ "truthy" làm 3 đỏ; bỏ loại trừ khi cờ tắt làm 3, 6 đỏ.

## Bất biến đề xuất (tầng 2)
Đặt ở `eval/T-204/bat-bien-cho-merge/` (ADR-028; thăng sau merge, Chief đánh số):
- **Thay inv-002** `inv-002-danh-tinh-co-dinh-la-capu-khi-va-chi-khi-co-mo.sh` (+ `lib/admin_open_capu.mjs`, `lib/open_admin_common.mjs`): danh tính cố định là Capu khi và chỉ khi cờ đúng `"1"` tính lúc đọc: bật thì bản cũ/mới vào export; tắt/khác thì không bao giờ, dù liệt kê trong danh sách, dù by_capu=true lưu sẵn; Capu thật ký khi tắt; đảo cờ không ghi R2. Chạy được trên main: ĐỎ (đúng, hành vi mới); trên bản cài giả: PASS.
- **Mới** `inv-007-entry-co-mo-admin-qua-apply.py` (+ `lib/open_admin_export.mjs`): mục export của danh tính cố định luôn qua apply thật (nhãn khớp `LABEL_RE`, không trường bị từ chối). Khung tạm đọc `../check_5...`; khi thăng, dán nội dung check_5 vào file.
- Lời văn vendor-enrich inv-010(c) không đổi (nó nói về admin thường không phải Capu).

## Không làm
- Không đổi giá trị mặc định cờ, không bật/tắt biến môi trường, không đặt secret.
- Không chạy export/apply vào pool tohong; không đổi repo tohong hay front.
- Không di trú/ghi lại 132 review trong R2; không sửa `inv-002` hay bất biến nào (gỡ chỉ lúc merge, theo ADR-126).
- Không đổi cách ký, thứ tự trường, định dạng nhãn; không đụng route ngoài `/api/admin/*`.
- Không thêm cơ chế "đóng băng chữ ký khi cờ tắt".

## Câu hỏi mở
Không có câu cần Capu. Nhờ Chief (không phải Capu): xử lý inv-002 trước Code Gate như mục xung đột.
