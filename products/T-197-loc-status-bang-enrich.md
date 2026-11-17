# Spec T-197: Bộ lọc Status của bảng Enrich Google Maps (admin)

## Ý định
Capu 2026-11-17 (chép nguyên văn từ `board/T-197.md`): "thêm filter Status trong table admin vendor enrich google". Mục tiêu ghi trên việc: admin lọc bảng enrich theo đúng giá trị cột Status đang hiện. Không có insight kèm theo.

## Bằng chứng
- Mã hiện tại (front `4b2197e`, back `1f7455c`, đọc ngày 2026-11-17):
  - `tohong-front/src/admin/EnrichTable.jsx`: cột "Status" in (a) `GROUP[r.group]` (9 nhãn), hoặc (b) "Chờ áp dụng" khi `review.by_capu === true`, "Chờ Capu" khi có review mà `by_capu` khác true, hoặc (c) khi `r.override`: nhãn nhóm VÀ nhãn "Đã duyệt tay" cạnh nhau. Bản `review` của dòng đã có override luôn bị bỏ (`reviewOf` trả null).
  - `tohong-back/lib/vendorEnrich.js` `listEnrich`: lọc + chia trang ở back; nhận `filter` (5 chip + 9 khoá nhóm), `category`, `q`, `offset`, `limit`; `review` của từng hàng do `pendingFor` tính (bỏ qua hàng override, `by_capu` = đã ký VÀ người ký hiện là Capu).
- Dữ liệu thật nhúng ở back (chạy `node` đọc `lib/vendorEnrichReport.generated.js`, 2026-11-17): 870 hàng; nhóm: full 94, addr_diff_accepted 57, name_similar 252, not_found 354, name_same_addr_diff 50, unverified 59, temp_closed 3, matched_no_photo 1, not_enriched 0; 3 hàng có override (nhóm temp_closed, addr_diff_accepted, full). Nhóm "Chưa enrich" hiện RỖNG nhưng vẫn là một giá trị Status hợp lệ.
- Số review đang chờ ở R2 thật: không biết (không đọc R2 thật). GIẢ ĐỊNH, tự tin ~85%: có vài review, nên "Chờ Capu" / "Chờ áp dụng" là hai giá trị Capu sẽ muốn lọc nhất.
- Ý định chọn MỘT giá trị tại một thời điểm (không chọn nhiều): GIẢ ĐỊNH, tự tin ~80% (cột Status mỗi dòng hiện một nhãn; chip hiện có cũng chọn một).

## Giả thuyết
Nếu admin lọc được theo đúng chữ ở cột Status thì để tìm "các dòng đang chờ Capu" hoặc "các dòng chưa kiểm khớp" không còn phải cuộn 18 trang. Chỉ số bảo vệ: chip, ô tìm, Hạng mục, Approve, Sửa thủ công, drawer và quyền admin vẫn như hôm nay; không dữ liệu nào bị đổi.

## Hành vi (người dùng thấy gì)

Định nghĩa dùng xuyên suốt: **Status hiển thị** của một hàng là chữ ở cột "Status" của hàng đó, tính theo đúng luật đang chạy:
- hàng đã có override: nhãn nhóm VÀ "Đã duyệt tay" (hai nhãn);
- hàng chưa override mà có review chờ: MỘT nhãn: "Chờ áp dụng" nếu review do Capu ký (`by_capu` đúng), ngược lại "Chờ Capu" (nhãn nhóm KHÔNG hiện);
- còn lại: nhãn nhóm.

1. **Ô chọn.** Trong thanh công cụ của bảng "Bảng enrich vendor" có một ô chọn (`<select>`, vai trò combobox) tên truy cập đúng "Status" VÀ có nhãn "Status" nhìn thấy được, gắn với ô (phần tử `<label>`), đặt ngay trước ô, để người dùng không chỉ thấy hai chữ "Tất cả" (chip và ô chọn) mà không biết ô lọc gì. Có đúng 13 lựa chọn, đúng thứ tự và đúng chữ sau (chữ nhóm chép từ `GROUP`, kể cả dấu phẩy): "Tất cả", "Enrich 100%", "Khớp, chưa có ảnh Google", "Địa chỉ khác marry", "Có ảnh Google, chưa kiểm khớp", "Tên trùng, địa chỉ lệch", "Tên hơi giống", "Không thấy trên Maps", "Tạm đóng cửa", "Chưa enrich", "Chờ Capu", "Chờ áp dụng", "Đã duyệt tay". Không có số đếm trong chữ lựa chọn. Lúc vào bảng đang chọn "Tất cả"; bảng khi đó y như hôm nay (870 hàng, "Hiển thị 1–50 / 870", từng hàng, từng chữ Status).
2. **Chọn một giá trị.** Bảng chỉ còn các hàng **mang** giá trị đó trong Status hiển thị, ở mọi trang (chia trang 50 hàng như hôm nay, thứ tự báo cáo như hôm nay, STT liên tục 1..N), và dòng "Hiển thị a–b / N" có N đúng bằng số hàng mang giá trị đó. Quy tắc "mang":
   - nhãn nhóm (9 giá trị): hàng thuộc nhóm đó VÀ chưa có review chờ (hàng nhóm đó đang "Chờ Capu"/"Chờ áp dụng" KHÔNG mang nhãn nhóm, vì cột không hiện nó); hàng override của nhóm đó CÓ mang (cột hiện nhãn nhóm);
   - "Chờ Capu": hàng chưa override có review chờ mà chưa do Capu ký; "Chờ áp dụng": hàng chưa override có review chờ do Capu ký;
   - "Đã duyệt tay": hàng đã override (mọi nhóm).
   Hệ quả: 9 nhãn nhóm + "Chờ Capu" + "Chờ áp dụng" chia toàn bộ danh sách (mỗi hàng đúng một ô, tổng = 870 khi bỏ lọc); "Đã duyệt tay" là tập con nằm chồng lên nhãn nhóm.
3. **Chữ ở cột Status của mọi hàng hiện ra**: nhãn nhóm → đúng nhãn đó (hoặc "<nhãn> Đã duyệt tay" nếu là hàng override); "Chờ Capu" → đúng "Chờ Capu"; "Chờ áp dụng" → đúng "Chờ áp dụng"; "Đã duyệt tay" → kết thúc bằng "Đã duyệt tay".
4. **Không hàng nào**: giá trị không có hàng (hôm nay "Chưa enrich") vẫn chọn được; bảng hiện dòng "Không có vendor nào khớp bộ lọc.", "Hiển thị 0–0 / 0", "Trang trước" và "Trang sau" đều bị khoá (như bộ lọc rỗng hôm nay).
5. **Kết hợp: luôn là AND, độc lập.** Status giao với chip (Tất cả / Enrich 100% / Chưa có ảnh Google / Tên hơi giống / Địa chỉ khác marry), Hạng mục và ô tìm. Status KHÔNG thay chip và chip KHÔNG thay Status: chip "Enrich 100%" + Status "Enrich 100%" ra các hàng nhóm full chưa có review chờ (ít hơn chip một mình nếu có hàng full đang chờ); chip "Enrich 100%" + Status "Chờ Capu" ra các hàng nhóm full đang "Chờ Capu". Bấm chip "Tất cả" chỉ đưa chip về "Tất cả", KHÔNG đặt lại Status. Đổi chip, Hạng mục hay ô tìm KHÔNG đổi Status. Đổi Status KHÔNG đổi chip, KHÔNG đổi Hạng mục, KHÔNG đổi từ khoá đã áp (đã bấm tìm / Enter) và KHÔNG đổi chữ đang hiện trong ô tìm; bảng sau khi đổi Status = Status AND chip AND Hạng mục AND từ khoá ĐÃ ÁP. Chữ gõ dở trong ô tìm mà chưa bấm tìm KHÔNG được áp khi đổi Status (như đổi chip / Hạng mục hôm nay), và ô tìm vẫn hiện nguyên chữ gõ dở đó. Muốn bỏ Status thì chọn lại "Tất cả" trong ô Status.
6. **Về trang 1.** Mỗi lần đổi Status, bảng về trang 1 ("Hiển thị 1–…", hàng đầu STT 1), kể cả đang ở trang 2 trở đi. Đổi chip / Hạng mục / ô tìm khi đang lọc Status cũng về trang 1 (như hôm nay) và Status vẫn giữ.
7. **Cái không đổi theo Status:** năm chip và số trên chúng, dòng "<N> vendor · enrich lần cuối <ngày>" (đếm trên toàn bộ danh sách như hôm nay). Status không lưu qua lần tải lại trang (như chip): tải lại trang trong cùng phiên thì ô Status về "Tất cả" và bảng là "Hiển thị 1–50 / 870" như mặc định.
8. **Ghi khi đang lọc.** Khi Status khác "Tất cả", sau mỗi lần Approve, Rút lại hoặc Lưu của Sửa thủ công thành công, bảng được tải lại với đúng các bộ lọc đang chọn và GIỮ trang đang đứng (trang 2 vẫn là trang 2 nếu còn hàng), nên mọi hàng đang hiện vẫn mang giá trị Status đang chọn (hàng vừa Approve rời "Tên hơi giống" và sang "Chờ Capu"; hàng vừa Rút lại rời "Chờ Capu"). Nếu trang đang đứng không còn hàng nào mà vẫn còn hàng ở trước, bảng về trang cuối còn hàng, KHÔNG về trang 1 (đang ở trang 3 với 101 hàng, Rút lại hàng 101 → "Hiển thị 51–100 / 100"; không bao giờ hiện bảng trống khi tổng > 0). Khi Status là "Tất cả": như hôm nay, hàng ở nguyên chỗ và chữ Status đổi tại chỗ.
9. **API (back).** `GET /api/admin/vendor-enrich` nhận thêm tham số `status`, giá trị khoá: `full`, `matched_no_photo`, `addr_diff_accepted`, `unverified`, `name_same_addr_diff`, `name_similar`, `not_found`, `temp_closed`, `not_enriched` (9 khoá nhóm, trùng khoá của `filter`), `pending_capu` ("Chờ Capu"), `pending_apply` ("Chờ áp dụng"), `override` ("Đã duyệt tay"). Thiếu, rỗng (`status=`) hoặc `all` = không lọc, phản hồi giống từng byte bản không có `status`. Giá trị khác (kể cả sai hoa/thường, có khoảng trắng, `full,override`) → 400 `{"error":"invalid_status"}`; `filter` lạ vẫn báo `invalid_filter` trước. Nhiều tham số `status` → lấy cái đầu. `total`, `rows`, `n`, `offset`, `limit` tính trên tập đã lọc (như `filter`); `summary` và `data_as_of` không đổi theo `status`. Mỗi `rows[]` giữ nguyên các trường như hôm nay. Quy tắc "mang" ở mục 2 được tính ở back bằng đúng định nghĩa review chờ của `pendingFor` (kể cả người ký đã thôi là Capu thì review đó là "Chờ Capu", không phải "Chờ áp dụng").
10. **Không đổi:** quyền (người không phải admin vẫn 403 `{"error":"forbidden"}` giống từng byte dù có hay không có `status`, hợp lệ hay lạ), dữ liệu (GET không ghi R2, không gọi Google/mạng), drawer chi tiết (không chạm; INV-010 chạy ở Code Gate), Approve / Rút lại / Sửa thủ công, các route khác.

### Bảng chốt một cách hiểu (ba cách cài, chọn một)
| # | Câu dễ hiểu hai nghĩa | Cách A | Cách B | Cách C | Chốt | Người dùng thấy khác nhau ở đâu | Eval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hàng thuộc nhóm "Tên hơi giống" nhưng cột đang ghi "Chờ Capu": lọc theo nhóm hay theo chữ cột? | theo nhóm (hàng chờ nằm lại trong nhóm) | theo chữ cột | cả hai (hàng ở hai giá trị) | **B** (mục 2) | A: lọc "Tên hơi giống" ra hàng ghi "Chờ Capu" (sai "đúng Status đó"); C: tổng hai giá trị cộng lại vượt 870 | check_2 (từng hàng từng trang), check_4 (tổng chia 870, hàng full đang chờ) |
| 2 | Hàng override hiện nhãn nhóm + "Đã duyệt tay": nó thuộc giá trị nào? | chỉ "Đã duyệt tay" | chỉ nhãn nhóm | cả hai | **C** (mục 2) | A: lọc nhóm mất hàng mà cột vẫn ghi nhãn nhóm; B: không lọc được hàng đã duyệt tay | check_2 (nhóm full/addr_diff/temp_closed có hàng override), check_4 |
| 3 | Status trùng chữ với chip ("Enrich 100%", "Tên hơi giống") | Status thay chip | AND độc lập | OR | **AND độc lập** (mục 5) | A/C: số hàng khi chọn cả hai khác giao | check_3 (a, b, c) |
| 4 | Lọc ở đâu | front lọc trên 50 hàng đã tải | back lọc toàn bộ | tải hết về lọc | **back** (mục 9) | A: trang 2, 3 sai, số tổng sai | check_2, check_4 (offset, total) |
| 5 | Bấm chip "Tất cả" | đặt lại cả Status | chỉ đặt chip | | **chỉ chip** (mục 5) | Status giữ hay mất | check_3 |
| 6 | Hàng vừa Approve khi đang lọc | nằm lại, đổi chữ tại chỗ | rời bảng | tải lại về trang 1 | **rời bảng, giữ trang (hoặc trang cuối còn hàng)** (mục 8) | A: bảng có hàng sai Status; C: mất chỗ đứng | check_6 |
| 7 | Đổi Status khi Hạng mục / ô tìm đang có giá trị | giữ cả hai (chốt) | đặt lại cả hai | áp luôn chữ gõ dở | **A** (mục 5) | B: mất Hạng mục và ô tìm; C: bảng lọc theo chữ chưa bấm tìm | check_3 |
| 8 | Status sau tải lại trang | về "Tất cả" (chốt) | nhớ lại (localStorage) | | **A** (mục 7) | B: F5 xong vẫn chỉ còn một giá trị | check_1 |
| 9 | Ô chọn có nhãn | chỉ aria-label | nhãn "Status" nhìn thấy (chốt) | | **B** (mục 1) | A: hai chữ "Tất cả" không rõ ô lọc gì | check_1 |
| 10 | Cách đặt tên tham số / giá trị lạ | bỏ qua | 400 | 200 rỗng | **400 invalid_status** (mục 9) | Chỉ thấy qua API; chặn gõ sai khoá âm thầm | check_4 |

### Bảng ca biên
| Đầu vào / trạng thái | Hành vi chốt | Eval |
| --- | --- | --- |
| Giá trị không có hàng ("Chưa enrich": 0 hàng thật) | mục 4 | check_2, check_4 |
| Hạng mục + từ khoá đã áp + chữ gõ dở rồi đổi Status | giữ Hạng mục và từ khoá đã áp, không áp chữ gõ dở, ô tìm vẫn hiện chữ gõ dở (mục 5) | check_3 |
| Tải lại trang sau khi chọn Status | Status về "Tất cả" (mục 7) | check_1 |
| Đang trang 3 (101 hàng), Rút lại hàng 101 | về trang 2, "Hiển thị 51–100 / 100" (mục 8) | check_6 |
| Đang trang 2 khi Approve trong bộ lọc | giữ trang 2 (mục 8) | check_6 |
| Tổng 1 trang đúng 50 hàng, tổng 51 (trang cuối 1 hàng) | trang 2 hiện "Hiển thị 51–51 / 51"; Rút lại hàng đó → "Hiển thị 1–50 / 50", không trang trống (mục 8) | check_6 (hồ sơ 51 review) |
| `offset` quá cuối trong API | 200, `rows` rỗng, `total` đúng | check_4 |
| Review còn trong kho của hàng đã có override | override thắng: hàng ở nhóm của nó và ở "Đã duyệt tay", KHÔNG ở "Chờ Capu" | check_4 |
| Người ký review thôi là Capu (CAPU_USER_IDS đổi) | review đó là "Chờ Capu", không còn "Chờ áp dụng" | check_4 |
| `status=` rỗng, `status=all` | như không có | check_4 |
| `status=Full`, `FULL`, ` full`, `full,override`, `constructor`, `__proto__`, `0`, `null` | 400 `invalid_status` | check_4 |
| `status=a&status=b` | lấy `a` | check_4 |
| Status + chip không giao nhau ("Tên hơi giống" + "Địa chỉ khác marry") | 0 hàng, thông báo rỗng | check_3 |
| Đang trang 2 rồi đổi Status / chip | về trang 1, Status giữ | check_3 |
| Gõ ô tìm có hoa/thường/không dấu cùng Status | như ô tìm hôm nay (không dấu, không phân biệt hoa/thường, theo tên) | check_3, check_4 |
| Người không phải admin kèm `status` hợp lệ / lạ / rỗng | 403 giống từng byte bản không có `status` | check_5 |
| POST/PUT/DELETE/PATCH trên đường dẫn danh sách kèm `status` | 405 như không có `status` | check_5 |
| Review trong kho không phải object | N/A: kho kiểm schema nghiêm (`reviews_corrupt` 500 cho mọi route, hành vi cũ, không đổi) | không đo |
| Hai admin sửa cùng lúc, đọc lệch phiên | N/A: danh sách luôn đọc kho mới nhất mỗi lần gọi (như hôm nay); bảng chỉ đúng tại thời điểm tải | không đo |
| Mất mạng / 500 khi tải lại sau ghi | N/A: hiện lỗi như hôm nay (`ErrorNote` kèm nút thử lại) | không đo |

## Ràng buộc (vòi)
- Repo: `tohong-front` (EnrichTable.jsx, api.js) và `tohong-back` (lib/vendorEnrich.js) · Nhánh: `t-197-loc-status-enrich` · Vùng (`area`): `planner/admin/vendor-enrich`
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001..004) + `planner/` (INV-001..007; chạm: INV-005 worker khởi động trong workerd, INV-007 worker nền dưới 1MB; thêm một vài dòng mã không đổi gì) + `planner/admin/` (INV-001..004, cờ ADMIN_OPEN) + `planner/admin/vendor-enrich/` (INV-001..013) + vùng anh em `planner/admin/members/` (INV-001..006, chỉ chạm ở chỗ mock `/api/admin/vendor-enrich` của `lib/members_ui_inv.cjs`; thêm ô Status không làm vỡ mock vì ô render không phụ thuộc dữ liệu). Trích nguyên văn câu chạm tới:
  - inv-008: "người không phải admin (GET /api/admin/me trả 403) vào ?admin chỉ thấy "Bạn không có quyền xem trang này": không có thanh tab "Các mục admin", không có "Bảng enrich vendor", và trình duyệt không gửi request nào tới /api/admin/vendor-enrich* hay /api/admin/vendors*." → spec không đổi gì ở phần chặn; thêm ô Status nằm trong bảng nên cũng không hiện.
  - inv-010: "(a) người không nằm trong ADMIN_USER_IDS (…) gọi /api/admin/vendor-enrich/<id>/detail … luôn nhận 403 … (d) đọc detail (chặn lẫn mở) không ghi R2 và không làm export đổi." → spec chỉ chạm list, không chạm `detail`/`export`/ghi; check_5 đo thêm: list kèm `status` cũng 403 với người ngoài và không ghi R2.
  - inv-001 (`planner/admin`): "ADMIN_OPEN khác đúng chuỗi "1" … mọi /api/admin/* của người không trong ADMIN_USER_IDS nhận 403 {"error":"forbidden"}, giống hệt từng byte cờ thiếu, không ghi R2" → không thêm route, không đụng cờ; spec và eval KHÔNG bật cờ hay đặt biến.
  - inv-001 (`vendor-enrich`): báo cáo là phân hoạch (mỗi id một nhóm, tổng = total) → bộ lọc dựa trên đúng phân hoạch đó; `summary` không đổi.
  - Không mâu thuẫn bất biến nào; không đề nghị đổi bất biến.
- ADR đã đọc: ADR-116/117 (mở admin không đăng nhập, cờ ADMIN_OPEN mặc định tắt; Chief không bật cờ) → spec không động tới cờ.
- Bề mặt dùng chung đã grep (3 repo + eval): (1) `api.adminEnrichList` chỉ được `src/admin/EnrichTable.jsx` gọi (grep `src/`); (2) `listEnrich` chỉ gọi ở `api/admin.js` (handleVendorEnrich, route list); `exportEnrich`, `getEnrichDetail`, `putEnrichReview`, `withdrawEnrichReview` không đổi; (3) tham số `status` đã có ở route khác (`connect-requests`, `upgrade-requests`) nhưng là route riêng, không đụng; (4) eval cũ chạm bảng: T-124 check_4/check_8, T-147 check_6, T-153, T-164 — không eval nào đếm số combobox/`select` của bảng enrich hoặc dùng `getByText('Tất cả')` (grep `combobox|select|Tất cả` trong `eval/`), và T-124 check_4 chỉ kiểm `filter`; (5) `members_ui_inv.cjs` mock `/api/admin/vendor-enrich` (đã nêu). Không có nơi nào khác người dùng thấy giá trị Status (không CSV, không thẻ chat, không báo cáo).
- Kiến trúc: ô chọn dùng lớp `adm-select` như "Hạng mục"; lọc ở back (không lọc ở front); không thêm dữ liệu vào báo cáo nhúng; không gọi Google/mạng.
- Không chạm: payment, auth, schema, báo cáo nhúng, chữ ký back/HQ, workflow dữ liệu, drawer, route ghi, quyền. Không bật cờ, không đặt biến môi trường, không chuỗi giống secret.
- Bậc lưới lọc đề xuất: **B** — logic lọc ở API admin (đọc) và ô giao diện; eval tự động phủ toàn bộ tiêu chí; chạm vùng quyền admin chỉ ở mức đọc, không đổi quyền, không ghi dữ liệu. (Nếu adversary thấy `status` chạm ranh giới cứng thì nâng bậc.)

## Tiêu chí chấp nhận và eval
Mọi eval chạy từ gốc `tohong-hq`; front lấy từ `TOHONG_FRONT_REPO` (mặc định `/home/user/tohong-front`), back từ `TOHONG_BACK_REPO` (mặc định `/home/user/tohong-back`). Các eval giao diện build front rồi chạy trình duyệt thật (Playwright) trỏ vào **worker thật của back** với R2 giả đã gieo review qua API thật (không giả logic lọc), nên PR front của việc này chỉ xanh khi PR back đã có (hai PR cùng nhánh `t-197-…`, như T-124).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Ô chọn "Status" có nhãn "Status" nhìn thấy và đúng 13 lựa chọn đúng chữ, đúng thứ tự (mục 1); mặc định "Tất cả" cho bảng y hệt hôm nay, chọn rồi quay lại "Tất cả" cũng y hệt; chọn một giá trị rồi tải lại trang thì về "Tất cả" (mục 7) | `bash eval/T-197/check_1_o_chon_status.sh` |
| 2 | Chọn từng giá trị trong 12: mọi hàng ở mọi trang có đúng Status đó (chữ cột Status), đúng hàng, đúng thứ tự, "Hiển thị a–b / N" khớp; 9 nhóm + 2 chờ cộng đúng 870; giá trị 0 hàng hiện thông báo rỗng (mục 2, 3, 4) | `bash eval/T-197/check_2_moi_hang_dung_status.sh` |
| 3 | Kết hợp AND với chip, Hạng mục, ô tìm; chip "Tất cả" không đặt lại Status; đổi Status/chip khi đang trang 2 về trang 1; đổi Status giữ Hạng mục và từ khoá đã áp, không áp chữ gõ dở; số chip và dòng đầu không đổi (mục 5, 6, 7) | `bash eval/T-197/check_3_ket_hop_va_ve_trang_1.sh` |
| 4 | API `status`: đúng tập hàng, thứ tự, `total`, `n`, `summary` không đổi, giá trị lạ 400, `status=`/`all` như không có, nhiều `status` lấy đầu, override thắng review tồn đọng, người ký thôi là Capu, AND với `filter`/`category`/`q`/`offset` (mục 9) | `node eval/T-197/check_4_api_loc_status.mjs` |
| 5 | Không đổi quyền và dữ liệu: người ngoài 403 giống từng byte với mọi `status`; GET không ghi R2, không gọi mạng; hàng trả về giống hệt hàng cùng id ở bản không lọc; phương thức ghi trên đường dẫn danh sách vẫn 405 (mục 10) | `node eval/T-197/check_5_quyen_va_khong_ghi.mjs` |
| 6 | Ghi khi đang lọc: Approve / Rút lại / Sửa thủ công làm hàng rời đúng bảng, tổng đổi đúng; không trang trống ở trang cuối, và từ 3 trang trở lên về trang cuối còn hàng chứ không về trang 1; Status "Tất cả" vẫn đổi chữ tại chỗ (mục 8) | `bash eval/T-197/check_6_ghi_khi_dang_loc.sh` |

Mỗi tiêu chí đúng một eval. Mọi eval đo chữ nhìn thấy (ô "Status", chữ cột "Status", "Hiển thị a–b / N", nút) hoặc phản hồi API; không đọc mã nguồn, không bám class. Nhà tiên tri của eval (`eval/T-197/lib/common.mjs`) tính Status hiển thị độc lập từ báo cáo nhúng + danh sách review đã gieo.

**Đã thử (2026-11-17, bản cài thử ở thư mục tạm, hai lần liên tiếp):**
- Bản cài thử theo đúng chữ spec (diff ở `eval/T-197/refs/ok-front.patch`, `ok-back.patch`; chỉ để tự kiểm eval, Engineering không bắt buộc theo): cả 6 eval xanh, hai lần liên tiếp.
- Trên main hiện tại (`front 4b2197e`, `back 1f7455c`): cả 6 đỏ.
- Bản sai nhưng giống (đột biến), mỗi bản làm ít nhất một eval đỏ: front: không về trang 1 khi đổi Status (đỏ 2, 3); không tải lại sau ghi (đỏ 6); chip "Tất cả" đặt lại Status (đỏ 3); chọn Status xoá chip (đỏ 3); thiếu "Chờ áp dụng" hoặc mất dấu phẩy (đỏ 1, 2); không bỏ trang trống (đỏ 6); không gửi `status` (đỏ 2, 3, 6); sai thứ tự lựa chọn (đỏ 1). Back: lọc nhóm lẫn hàng đang chờ (đỏ 4, 5); override rời nhóm (đỏ 4, 5); dùng `by_capu` thô (đỏ 4); Status OR với chip (đỏ 4, 5); review tồn đọng của hàng override tính là chờ (đỏ 4); bỏ qua giá trị lạ (đỏ 4); chấp nhận `FULL` (đỏ 4); lấy `status` cuối (đỏ 4); `summary` đổi theo lọc (đỏ 4); `total` sai (đỏ 4, 5); ghi R2 khi đọc (đỏ 5).

## Bất biến đề xuất (tầng 2)
Một, vùng `planner/admin/vendor-enrich`: **bộ lọc Status luôn khớp chữ cột Status**. Với mọi khoá `status` hợp lệ, hàng trả về đúng là các hàng mà (group, override, review.by_capu) của bản không lọc cho thấy mang giá trị đó, và 9 nhóm + "Chờ Capu" + "Chờ áp dụng" chia toàn bộ danh sách. Lý do: ai thêm một trạng thái vào cột Status (hay đổi luật "chờ") mà quên bộ lọc sẽ làm bộ lọc nói dối. Bản nháp chạy được: `eval/T-197/bat-bien-cho-merge/inv-status-loc-khop-chu-hien-thi.mjs` (không có lối "chưa áp dụng": trên main ĐỎ, trên bản cài thử PASS; chỉ thăng vào bể sau khi PR T-197 merge, nằm ở `bat-bien-cho-merge/` nên Code Gate không chạy nó). Dò gốc HQ ngược tới `scripts/gate.py`, dùng khung `eval/T-197/lib/common.mjs`; khi đưa vào bể cần giữ khung đó hoặc chép sang `lib/` của vùng.

## Không làm
- Không chọn nhiều giá trị Status một lúc; không số đếm trên lựa chọn; không lưu Status qua lần tải lại; không sắp xếp theo Status; không thêm cột; không đổi chip; không đổi luật cột Status (nhãn, màu, nút); không tải hết về front để lọc.
- Không đổi quyền, route ghi, drawer, `summary`, báo cáo nhúng, dữ liệu vendor; không bật cờ; không gọi Google.
- Không sửa `filter` (vẫn nhận 5 chip + 9 khoá nhóm như hôm nay; khoá nhóm của `filter` KHÔNG tính review chờ, khác `status`, vì đó là hành vi đã chạy).

## Câu hỏi mở
Không. (Hai giả định đã ghi ở Bằng chứng: chọn một giá trị, và "Đã duyệt tay" là một lựa chọn riêng. Nếu Capu muốn chọn nhiều giá trị hoặc muốn hàng override chỉ ở "Đã duyệt tay", đổi mục 2 và eval.)

## Sửa ở v2 (spec rework theo handoffs/T-197-D1.md, Chief phân xử)
- B1 đóng bằng mục 5 (thêm chiều "đổi Status → chip / Hạng mục / từ khoá đã áp / chữ gõ dở"), bảng chốt hàng 7, check_3 (khối mới: Hạng mục + tìm đã áp "a" + gõ dở "zzqx" rồi đổi Status).
- B2 đóng bằng mục 8 (ví dụ 101 hàng) và check_6 (hồ sơ 101 review, trang 3, Rút lại hàng 101 → "Hiển thị 51–100 / 100").
- B3 đóng bằng mục 7 và check_1 (chọn "Chờ Capu" rồi tải lại trang trong cùng phiên → "Tất cả", 870).
- M1 chốt: có nhãn "Status" nhìn thấy (mục 1); check_1 đo `<label>` gắn với ô. M2: bỏ lối "PASS chưa áp dụng" của bất biến đề xuất.
- Eval giao diện tự xoá thư mục build tạm `t197-dist-*` khi xong.
