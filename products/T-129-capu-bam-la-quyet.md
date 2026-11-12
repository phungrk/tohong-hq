# Spec T-129: capu-bam-la-quyet

> v1 · Spec Writer (product) · 2026-11-12 · bậc C · vùng `planner/admin/vendor-enrich` · chạm 3 repo (tohong, tohong-back, tohong-front) · **follow-up của T-124/T-125: làm sau khi ba PR tohong#84, tohong-back#46, tohong-front#68 được Capu merge** (spec này sửa Hành vi 5 của `products/T-124-bang-enrich-vendor.md` v2 và thay eval #5 phần export, #7, #8 của T-124).

## Ý định
Capu (ADR-065, 2026-11-12): "bấm approve tính là anh đã quyết". Cú bấm **Approve / Sửa thủ công của Capu** trên trang admin bảng enrich là quyết định của Capu; áp vào `manual_overrides.json` không còn bước "Capu xác nhận cả lô" và không còn việc Chief of Staff viết một file `decisions/` cho từng lô. Capu không gọi Google, không đổi nhóm/số đếm của bảng.

## Bằng chứng
- `decisions/2026-11-12-adr-065-capu-chot-t126-t124.md` mục 3: Capu thay luồng xác nhận cả lô; cần sửa Hành vi 5 + eval #7 + INV-020 + luật "ai trong ADMIN_USER_IDS được coi là Capu". Tự tin cao (nguyên văn Capu).
- Luồng hiện tại (T-125, đã qua Code Gate GREEN 20/20, `handoffs/T-125-v2.md`): bấm → review `pending` ở R2 → Chief of Staff lấy export, Capu đọc, CoS ghi `decisions/…-duyet-qua-admin-<lô>.md` → `apply_admin_reviews.py --decision … --hq …` → PR tohong bậc C → Capu merge → `resolve-overrides.yml`. Đo trên mã PR tohong#84 (`tools/scraper/apply_admin_reviews.py`) và tohong-back#46 (`lib/vendorEnrich.js`, `api/admin.js`).
- INV-020 (`eval/invariants/planner/vendor/images/inv-020-…py`) đòi `decision` = file trong `<HQ>/decisions/` có `decided_by: capu` và nhắc `vendor_id`; INV-015 (điều khoản miễn accept_match, hàm `_exempt`) đòi đúng điều kiện đó. **Chỉ hai bất biến này** đọc `decision` (đo bằng grep `decided_by` trong `eval/`). Tự tin cao.
- Back chỉ biết `userId` từ token (`requirePlatformAdmin`, `lib/adminAuth.js`); `ADMIN_USER_IDS` là danh sách phẳng, chưa phân biệt Capu với admin khác. Số admin thật trên production: không biết (GIẢ ĐỊNH ~70% chỉ Capu), nên spec không dựa vào số đó.
- Các luồng ghi nối với bên ngoài đã có: `resolve-overrides.yml` (Google trả phí, Capu bấm chạy, tự merge PR, ADR-049), `peter-evans/create-pull-request@v6` đang dùng ở đó.

## Giả thuyết
Nếu cú bấm của Capu tự thành dòng trong PR dữ liệu thì số việc Capu/CoS phải làm giữa "bấm" và "merge" giảm từ 4 bước (xin export, đọc lô, xác nhận để CoS ghi `decisions/`, chạy apply) còn 1 (merge PR; tùy chọn bấm chạy workflow). Chỉ số bảo vệ: **không mục nào vào `manual_overrides.json` mà không truy được về một cú bấm của Capu** (INV-020 v2) và không admin nào khác làm thay được.

## Hành vi (người dùng thấy gì)

### 1. Ai là Capu
- Biến môi trường mới của back, **`CAPU_USER_IDS`**: Clerk user id cách nhau dấu phẩy, đọc đúng như `ADMIN_USER_IDS` (cắt khoảng trắng, bỏ mục rỗng). Capu đặt; spec chỉ đặt tên, không đặt giá trị.
- **Một người là Capu khi và chỉ khi có trong `ADMIN_USER_IDS` VÀ có trong `CAPU_USER_IDS`.** `CAPU_USER_IDS` thiếu hoặc rỗng: không ai là Capu (đóng mặc định). User chỉ có trong `CAPU_USER_IDS` mà không có trong `ADMIN_USER_IDS`: vẫn 403 `forbidden` ở mọi route admin (T-124 Hành vi 6 không đổi).
- Được xác định **từ token ở phía back** lúc bấm. Thân yêu cầu có `by_capu`, `capu`, `reviewed_by`, `decided_by` thì bị bỏ qua.

### 2. Cú bấm và nhãn trạng thái
- Review (T-124 Hành vi 4) thêm trường **`by_capu`** (boolean): lưu `true` khi người bấm là Capu lúc đó, `false` nếu không. Mọi phản hồi trả `by_capu` **hiệu lực** = đã lưu `true` **và** người đó hiện vẫn là Capu (gỡ id khỏi `CAPU_USER_IDS` thì review chờ của id đó thành `false` mà không cần ghi R2; GET không bao giờ ghi R2).
- **Một dòng có review chờ: Status ghi "Chờ áp dụng" nếu `by_capu` hiệu lực `true` (Capu đã quyết, chờ vào PR dữ liệu), ghi "Chờ Capu" nếu không** (admin khác bấm: đề xuất, chưa phải quyết định). Đây là **thay đổi giao diện duy nhất**, cộng một câu lỗi (Hành vi 2.3). Chip, số đếm (876/98/680/244/107), 6 cột, nút Approve / Rút lại / Sửa thủ công, hộp thoại giữ nguyên như T-124.
- Quyền đè/rút (một luật): review có `by_capu` hiệu lực `true` chỉ Capu mới `PUT` đè hoặc `DELETE` được; admin khác nhận **409 `{"error":"decided_by_capu"}`, R2 không đổi**. Capu đè hoặc rút review của admin khác được (đè thì thành `by_capu` true). Admin khác rút review của admin khác (không phải Capu) được như cũ. Để nhận review "Chờ Capu" thành quyết định của mình, Capu bấm **Rút lại** rồi **Approve** (không thêm nút).
- Giao diện: khi API trả 409 `decided_by_capu`, hiện câu "Capu đã quyết dòng này, chỉ Capu rút lại hoặc đổi được." (không hiện mã thô), dòng giữ nguyên.
- Nhật ký admin (`vendor_enrich.review`) ghi thêm `after.by_capu`.

### 3. Export: chỉ cú bấm của Capu, nhãn băm thay id
- `GET /api/admin/vendor-enrich/export` (admin) trả `{count, waiting_capu, skipped_not_approvable, entries}`. **`entries` chỉ gồm review có `by_capu` hiệu lực `true`**, sắp theo `vendor_id`, mỗi entry `{vendor_id, action, place_id|maps_link, reason, reviewer_label, reviewed_at, by_capu:true}`. `reviewer_label` = `"admin:" + 8 ký tự hex đầu của sha256(Clerk user id)`. **Không có `reviewed_by`, không chuỗi user id nào trong thân.** `waiting_capu` = số review chờ không phải của Capu. Quy tắc bỏ review của dòng đã có override / id không còn / Approve không còn approvable như T-124.
- **Đường xuất cho workflow:** `GET /api/internal/vendor-enrich/export`, cùng thân, mở bằng `Authorization: Bearer <ENRICH_EXPORT_TOKEN>` (biến môi trường mới của back, một khoá máy chỉ để đọc; đối chiếu hằng thời gian; thiếu, rỗng hoặc < 16 ký tự thì mọi yêu cầu bị từ chối). Không nhận token người dùng; không nhận token trong query; phương thức khác GET → 405 (sau khi qua khoá); mọi từ chối → 403 `{"error":"forbidden"}` (đúng một khoá, `no-store`, R2 không đổi). Khoá này **không** mở được bất kỳ route `/api/admin/*` nào. Capu đặt giá trị (cùng giá trị ở GitHub secret `ENRICH_EXPORT_TOKEN` của repo tohong); spec chỉ đặt tên.

### 4. Từ export thành `manual_overrides.json`: một PR dữ liệu bậc C do máy mở, Capu merge
Đường ít bước nhất mà vẫn giữ "back không ghi git" và "Capu tự merge PR bậc C" (ADR-049 giữ nguyên bước Google trả phí do Capu bấm):
1. **Capu bấm Approve / Sửa thủ công** trên admin. (Đây là quyết định.)
2. **Workflow mới `.github/workflows/apply-admin-reviews.yml` (repo tohong)** chạy hằng ngày (`schedule`) và khi Capu bấm Run (`workflow_dispatch`): lấy `GET $ENRICH_BACK_URL/api/internal/vendor-enrich/export` bằng `curl --fail` với khoá `ENRICH_EXPORT_TOKEN` (biến repo `ENRICH_BACK_URL`: tên, Capu đặt giá trị); chạy `apply_admin_reviews.py`; chạy `test_t110_manual_overrides.py`; mở/cập nhật **một PR cố định** nhánh `admin-reviews/capu`, chỉ chứa `tools/scraper/output/HCMC/manual_overrides.json`, thân PR liệt kê các dòng `ADDED <vendor_id> <action> <nhãn>`. Không có thay đổi (export trống hoặc toàn `SKIP_EXISTING`) thì không mở PR. Không dùng khoá Google, không chạy resolve/enrich/refresh.
3. **Capu merge PR** (bậc C, đã đọc diff hành vi: danh sách vendor, hành động).
4. Như T-110/T-112: Capu bấm chạy `resolve-overrides.yml` (Google trả phí, có sẵn, không đổi) cho các mục `accept_place`; lần enrich/refresh kế tiếp áp override và sinh lại báo cáo → dòng hiện `override`, review hết hạn theo luật vòng đời T-124.

Mỗi lô hiện nằm ở **PR chứ không ở `decisions/`**; Chief of Staff ghi `decisions/` **một lần** (ADR sửa INV-020, kèm danh sách nhãn Capu) thay vì mỗi lô.

**`apply_admin_reviews.py` mới** (thay hợp đồng T-124 Hành vi 5.3; tham số `--decision` bị bỏ):
`python3 tools/scraper/apply_admin_reviews.py --state HCMC --reviews <export.json> --approved-on <YYYY-MM-DD> [--output-dir …] [--hq <gốc tohong-hq>]`
- Mỗi entry thêm một mục đúng schema T-110 (không trường lạ), theo thứ tự `vendor_id`, sau các mục sẵn có: `{vendor_id, action, [maps_link|place_id], reason = "<reason> [duyệt qua admin: <reviewer_label>, <reviewed_at>]", approved_by:"capu", approved_on, decision:"admin-review:<reviewer_label>@<reviewed_at>"}`.
- `decision` dạng mới phải được `enrichment.overrides.validate` chấp nhận: `admin-review:admin:<8 hex>@<YYYY-MM-DDTHH:MM:SS[.fff]Z>` (khớp **toàn chuỗi**, không chấp nhận xuống dòng thừa); dạng `decisions/<tên>.md` vẫn hợp lệ.
- Vendor đã có mục: giữ nguyên byte, in `SKIP_EXISTING <id>` (muốn đổi sau khi đã vào file thì sửa bằng PR như T-110; trong lúc đó back trả 409 `already_overridden` khi báo cáo đã có `override`). Thành công in `APPLY_OK added=N skipped=M` và một dòng `ADDED …` cho mỗi mục thêm. Export trống: `APPLY_OK added=0 skipped=0`, file không đổi.
- Từ chối cả lượt (thoát 2, file không đổi, `APPLY_REFUSED <mã> [<id>]`): `not_capu` (entry không có `by_capu === true` đúng kiểu boolean), `bad_entry` (có trường `reviewed_by`; `reviewer_label` hoặc `reviewed_at` sai dạng; không qua `validate`), `unknown_vendor`, `bad_overrides_file`, và với `--hq`: `label_not_capu` (nhãn không nằm trong `capu_admin_labels` của một file `decisions/` có `decided_by: capu`, Hành vi 5). Chạy lại cùng đầu vào: file giữ nguyên byte. Không mở mạng.

### 5. Sửa INV-020 (và điều khoản miễn của INV-015): nguồn quyết định hợp lệ thứ hai
Đề xuất cụ thể (bản chạy được: `eval/T-129/inv-proposed-inv-020-v2-quyet-dinh-capu-hop-le.py`, `eval/T-129/inv-proposed-inv-015-v2-mien-theo-quyet-dinh-capu.py`; Chief of Staff ghi `decisions/` rồi thay vào bể, spec không tự đổi bất biến):
- **Nguồn (A)** như cũ: `decision` = file `decisions/<tên>.md` có `decided_by: capu`, nhắc `vendor_id`. Mọi mục ADR-048 hiện có giữ nguyên hợp lệ.
- **Nguồn (B) mới:** `decision` = `admin-review:<label>@<reviewed_at>`, hợp lệ khi đủ: (1) `label` nằm trong dòng `capu_admin_labels:` ở frontmatter của một file trong `<HQ>/decisions/` (realpath) có `decided_by: capu` (Capu chốt danh sách người được coi là Capu, bằng nhãn băm, CoS ghi); (2) `reason` kết thúc đúng `[duyệt qua admin: <label>, <reviewed_at>]` cùng nhãn, cùng thời điểm với `decision`; (3) `approved_on` không sớm hơn ngày của `reviewed_at`; (4) `approved_by = "capu"`.
- **Thêm cho cả hai nguồn:** không trường nào của mục chứa Clerk user id thô (mẫu `user_` + ≥ 10 ký tự chữ-số). Id thô chỉ nằm ở R2 và nhật ký admin; trong repo chỉ có nhãn băm (tra ngược bằng cách băm id trong nhật ký).
- **INV-015, hàm `_exempt`:** miễn accept_match cho mục `accept_place` có quyết định hợp lệ nguồn (A) **hoặc** (B) theo đúng các điều kiện trên; mọi phần khác của INV-015 không đổi.
- **Giới hạn nói thẳng:** bất biến chạy offline nên chứng minh được **truy vết và nhất quán** (nhãn do Capu chốt, thời điểm khớp nhật ký admin), không chứng minh được cú bấm có thật. Phần đó do ba lớp khác bảo đảm: back chỉ đánh `by_capu` theo token (eval #1), apply từ chối mục không `by_capu` và chỉ workflow sinh mục nguồn (B) (eval #3, #5), và Capu tự merge PR bậc C. Kẻ chép nhãn công khai vào một mục tay vẫn qua được bất biến nhưng phải qua PR bậc C của Capu.
- **Thứ tự bắt buộc** (CoS): ghi ADR sửa INV-020/015 kèm `capu_admin_labels: admin:<8 hex>` của Capu **trước** khi PR dữ liệu đầu tiên của workflow được merge; nếu không bể tầng 2 đỏ ở lần gate kế.

### 6. Quyền và dữ liệu cá nhân
- Hành vi 1–3 và 6 của T-124 giữ nguyên: mọi route admin sau `requirePlatformAdmin`, 403 `forbidden` cho người lạ. Thêm: `Cache-Control: no-store` ở đường xuất cho workflow.
- Không đọc `conversations/`. `reviewed_by` (user id) vẫn lưu ở R2 và nhật ký admin như T-124; trên GitHub (PR, log Actions, `manual_overrides.json`) chỉ có nhãn băm.

## Ràng buộc (vòi)
- Repo và nhánh (đề xuất): `phungrk/tohong` · `t-129-ap-dung-capu`; `phungrk/tohong-back` · `t-129-capu-bam`; `phungrk/tohong-front` · `t-129-nhan-cho-capu`. Vùng: `planner/admin/vendor-enrich`. Làm trên main sau khi ba PR T-125 merge.
- **Chia việc Engineering** (thứ tự merge: tohong → tohong-back → tohong-front):
  - **tohong**: sửa `tools/scraper/apply_admin_reviews.py` (hợp đồng Hành vi 4; bỏ `--decision`, bỏ băm `reviewed_by`), `enrichment/overrides.py` (`DECISION_RE` chấp nhận dạng `admin-review:` bằng `fullmatch`), thêm `.github/workflows/apply-admin-reviews.yml`, cập nhật test (`test_t124_enrich_report.py` / test apply). Không đổi luật nhận khớp, không đổi `enrich.py`.
  - **tohong-back**: `lib/adminAuth.js` (`CAPU_USER_IDS`), `lib/vendorEnrich.js` (`by_capu` lưu + hiệu lực, khoá `decided_by_capu`, export mới, `reviewer_label`), `api/admin.js` (truyền `userId` cho DELETE, ghi `after.by_capu`), một route `/api/internal/vendor-enrich/export` trong `worker.js`; thêm test vào `npm test`.
  - **tohong-front**: `src/admin/EnrichTable.jsx` (nhãn "Chờ Capu" / "Chờ áp dụng" theo `review.by_capu`), `src/admin/format.js` (câu cho `decided_by_capu`).
  - **tohong-hq (Chief of Staff, không phải Engineering)**: ADR sửa INV-020/INV-015 + `capu_admin_labels` (cần Capu cung cấp user id hoặc đọc từ nhật ký admin để băm), thay hai file bất biến vào bể, đánh dấu T-124 eval #5 (phần export), #7, #8 là **bị T-129 #1–#3, #6 thay** (xem dưới), nhắc Capu đặt `CAPU_USER_IDS`, `ENRICH_EXPORT_TOKEN` (Worker), secret `ENRICH_EXPORT_TOKEN` và biến `ENRICH_BACK_URL` (GitHub tohong).
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/vendor/images/` (INV-012…031), vùng `planner/admin/`. Spec **đề nghị đổi INV-020 và INV-015** (Hành vi 5, lý do ADR-065); không vi phạm INV-016 (không đổi `approvable`), INV-021 (không đổi cách áp), INV-022/025–028 (không đụng dữ liệu vendor hay pool), INV-030 (workflow không `git push`, input không nội suy vào `run:`, `add-paths` chỉ một file), INV-031 (không dùng `gh` ngoài checkout).
- Không chạm: payment, schema DB, dữ liệu cặp đôi, `vendorPool.generated.js`, `vendor_overrides.json`, `conversations/`. **Chạm auth** (một khoá máy mới, một danh sách người quyết mới) và dữ liệu định danh tài khoản nên bậc C.
- Bậc lưới lọc: **C** — đường ghi quyết định duyệt tay lên dữ liệu vendor, đổi bất biến, thêm khoá truy cập máy; Capu đọc diff hành vi và tự merge ba PR.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; back/front/tohong tìm bằng `TOHONG_BACK_REPO` / `TOHONG_REPO` rồi `../tohong-back`, `../tohong`. Mỗi tiêu chí đúng một eval (6 tiêu chí). Hiện đỏ trên `origin/main` (chưa có code) là đúng; #4 xanh sẵn vì nó khoá bản đề xuất bất biến.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Cú bấm của Capu (có trong cả `ADMIN_USER_IDS` và `CAPU_USER_IDS`) tạo review `by_capu` true, admin khác false, không giả được từ thân yêu cầu; `CAPU_USER_IDS` thiếu/rỗng thì không ai là Capu; user chỉ trong `CAPU_USER_IDS` vẫn 403; admin khác không đè/rút được review của Capu (409 `decided_by_capu`, R2 không đổi); Capu đè/rút được review của admin khác; export admin chỉ có review của Capu với `reviewer_label` băm, không lộ user id, `waiting_capu` đúng; gỡ Capu khỏi danh sách thì review chờ thành false; nhật ký ghi `after.by_capu`; GET không ghi R2 | `cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-129/check_1_luat_capu_back.mjs` |
| 2 | `GET /api/internal/vendor-enrich/export` chỉ mở bằng `ENRICH_EXPORT_TOKEN` (thiếu/sai/cắt ngắn/thêm ký tự/token người dùng/query string/khoá thiếu hoặc < 16 ký tự: 403 `forbidden`), trả đúng thân export của admin, `no-store`, chỉ GET (405), khoá máy không mở route admin nào, R2 không đổi | `cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-129/check_2_xuat_cho_workflow.mjs` |
| 3 | `apply_admin_reviews.py` biến export của Capu thành mục `manual_overrides.json` đúng schema T-110 với `decision` `admin-review:`, không cần file decisions của lô; 6 mục mới, 1 bỏ qua, 4 mục cũ giữ byte; export trống không đổi file; từ chối (thoát 2, không đổi) mục không `by_capu`, có `reviewed_by` thô, nhãn/giờ sai dạng (kể cả xuống dòng thừa), vendor lạ, entry hỏng, nhãn không thuộc Capu (`--hq`); `--decision` không còn; `load_overrides` đọc được; INV-020 v2 xanh và đỏ khi thiếu ADR nhãn; chạy lại không đổi; `resolve_overrides.py --dry-run` đếm đúng; không mạng | `python3 -I eval/T-129/check_3_ap_dung_tohong.py` |
| 4 | INV-020 v2 nhận nguồn (B) hợp lệ và nguồn (A) cũ, từ chối hơn 20 ca giả mạo (nhãn lạ, ADR nhãn không `decided_by: capu` / nằm ngoài frontmatter / symlink ra ngoài, reason lệch, giờ lệch, `approved_on` sớm hơn, dạng `decision` sai, id thô, trùng vendor); INV-015 v2 miễn đúng theo cả hai nguồn; bản v2 xanh trên dữ liệu thật hiện tại | `python3 -I eval/T-129/check_4_inv_020_v2.py` |
| 5 | Workflow `apply-admin-reviews.yml` an toàn: chỉ `workflow_dispatch`/`schedule`, quyền tối thiểu, chỉ hai secret, không Google, không chạy resolve/enrich, không nội suy secret vào `run:`, `curl --fail` + Bearer từ env, `apply` không `--decision`, test T-110 trước khi mở PR, `add-paths` chỉ `manual_overrides.json`, không `git push`/`--force`; INV-030 và INV-031 nguyên văn xanh | `python3 -I eval/T-129/check_5_workflow_tohong.py` |
| 6 | Bảng chỉ đổi nhãn trạng thái: dòng chờ có `by_capu` true ghi "Chờ áp dụng", false hoặc thiếu ghi "Chờ Capu"; Approve và Sửa thủ công gửi thân sạch (không `by_capu`/`reviewed_by`/`capu`); 409 `decided_by_capu` hiện câu có chữ Capu, không hiện mã; 5 chip 876/98/680/244/107, 6 cột, nút Rút lại không đổi; không request ra ngoài | `cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-129/check_6_ui_nhan_trang_thai.cjs --repo .` |

Đã chạy thử từng eval trên **bản dựng thử** (không giao, nằm ở scratchpad, dựng từ ba PR T-125): #1, #2, #3, #5, #6 xanh trên bản dựng thử và **đỏ (FAIL, không ERROR)** trên mã T-125 và trên `origin/main`; #4 xanh sẵn; #3 đỏ khi cố ý để `AT_RE.match` thay `fullmatch` (đã bắt), #4 đỏ khi bỏ kiểm nhãn Capu (đã bắt). Hiệu lực với bộ eval cũ của T-124 sau khi T-129 ship: #1–#4, #6, #9 giữ nguyên; **#5 (phần export có `reviewed_by`), #7 và #8 (ba chỗ chờ "Chờ áp dụng" sau Approve với API giả không có `by_capu`) đỏ có chủ đích và được #1, #2, #3, #6 của T-129 thay.** Chief of Staff ghi việc này vào `decisions/` cùng ADR sửa INV-020 (không sửa eval cho khớp code: đây là đổi hợp đồng do Capu quyết).

## Bất biến đề xuất (tầng 2)
- **Sửa INV-020 → v2** và **INV-015 → v2 (`_exempt`)**: Hành vi 5, hai file đề xuất chạy được đã nêu. Lý do: ADR-065.
- **Mới:** không mục `manual_overrides.json` nào chứa Clerk user id thô (đã gộp vào INV-020 v2).
- Không đề xuất thêm bất biến cho back (đã khoá bởi eval #1, #2) hay workflow (INV-030/031 + eval #5).

## Không làm
- Gọi Google (Places, Text Search, Photos, Maps) ở bất kỳ đoạn mã nào của việc này; tự chạy `resolve-overrides.yml`, enrich hay refresh ảnh (Google trả phí, Capu bấm chạy).
- Tự merge PR dữ liệu (bậc C, Capu merge); ghi `manual_overrides.json` hay `decisions/` từ back hoặc front; để back có token GitHub.
- Đổi nhóm, số đếm, luật `approvable`, 6 cột, 5 chip, nút hay hộp thoại (chỉ nhãn "Chờ Capu" và một câu lỗi).
- Nút mới "nhận review của admin khác làm quyết định" (Capu dùng Rút lại rồi Approve).
- Đưa Clerk user id thô, email, hay khoá máy vào repo, PR hoặc log.
- Phân quyền theo vai ngoài Capu / admin; thông báo Slack; thao tác hàng loạt; bảng cho thành phố khác HCMC.
- Tự đổi bất biến (CoS ghi `decisions/`, thay vào bể).

## Câu hỏi mở
**Anh có đồng ý tạo một khoá máy riêng `ENRICH_EXPORT_TOKEN` (chỉ đọc export, cùng giá trị ở Cloudflare Worker và GitHub secret của tohong) để workflow tự lấy cú bấm của anh và mở PR?** Mặc định nếu anh không trả lời: **có**. Nếu **không**: bỏ khoá và đường `/api/internal/…`; Chief of Staff lấy export bằng route admin có sẵn (như T-125) và dán vào ô nhập của workflow `workflow_dispatch` (thêm một bước thủ công cho mỗi lô, không còn chạy hằng ngày); phần còn lại (Capu = `CAPU_USER_IDS`, nhãn băm, INV-020 v2, PR bậc C) giữ nguyên, và Engineering sửa eval #2 và #5 theo.
