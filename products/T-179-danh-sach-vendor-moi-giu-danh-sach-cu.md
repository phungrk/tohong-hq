# Spec T-179: Đổi dự toán thì "Tìm vendor" in danh sách MỚI, danh sách cũ giữ nguyên

> v2 (sau `handoffs/T-179-D1.md`, Chief phân xử) · v1 · Spec Writer (product) · 2026-11-15 · bậc B · vùng `planner/vendor/matching` · chỉ chạm `tohong-front` (back không đổi) · thay hướng "cập nhật tại chỗ" của T-174 (spec `products/T-171-the-vendor-theo-du-toan-hien-tai.md` v3.1 H1-H4) theo ADR-106; giữ H5-H8 của T-171.

## Ý định
Capu (ADR-106, trả lời câu mở của T-171): "mỗi lần số dự toán đổi so với lần trước, danh sách vendor mở bằng nút 'Tìm vendor' phải lấy lại danh sách mới, không cần tải lại trang, và danh sách mới sẽ được in lại chứ không phải thay đổi lại nội dung danh sách cũ. Nội dung danh sách cũ vẫn giữ nguyên." Cặp đôi giữ được cả hai: danh sách theo số cũ làm chứng, danh sách theo số mới để chọn.

## Bằng chứng
- `decisions/2026-11-15-adr-106-danh-sach-moi-giu-danh-sach-cu.md` (quyết định của Capu).
- Code front main `7d65d5e` (đọc 2026-11-15): nút "Tìm <hạng mục>" ở `src/screens/Budget.jsx:489` gọi `onOpenVendorChat(cat.id)` -> `App.jsx:172 openAIVendor` đặt `vendorSeed = { catId }` -> `AIChatModal.jsx:46 VendorThread`. `VendorThread` chỉ dựng lại cuộc trò chuyện khi `vendorSeed.catId` đổi (effect deps `[vendorSeed?.catId]`), nên bấm lại cùng hạng mục không in gì; mở chat thường (`openAI`) đặt `vendorSeed = null` và gỡ luồng vendor, lần bấm kế tiếp dựng lại một thẻ (eval T-171 check_6 dựa vào điều này). Thẻ danh sách `VMatchChatCard` (`VendorChatCards.jsx:224`) lấy lại điểm tại chỗ theo `scoreEpoch` (T-174); chi tiết `VDetailChatCard` nhận điểm của hàng đã bấm và lấy lại nếu đợt cũ; "Xem thêm" (`loadMore`) gọi `/api/vendors/match` theo `offset`.
- `VendorCtx.jsx` có `budgetCats`/`guests` nhưng chỉ tải một lần (không tự làm mới sau khi lưu), nên không dùng làm "số đã lưu".
- Dòng phép so của chi tiết (`budgetBasisText`, vd `so với 40tr tiệc cưới`) đã tự ghi số dùng; hàng trong danh sách thì không ghi, nên chỉ danh sách cần nhãn mới.

## Giả thuyết
Nếu mỗi lần bấm Tìm vendor sau khi đổi số in một danh sách mới (có nhãn số dùng) thay vì sửa danh sách cũ thì cặp đôi không còn thấy điểm tự nhảy dưới tay mình và không còn thấy danh sách trái với màn Ngân sách (đo: số lần Capu báo "danh sách vendor không khớp dự toán" về 0; số cuộn lên thẻ cũ rồi chọn nhầm vendor theo số cũ không tăng). GIẢ ĐỊNH, tự tin ~70%: cặp đôi hiểu nhãn "Theo dự toán Xtr" là số đã dùng cho danh sách đó. Chỉ số bảo vệ: số lần gọi `/api/vendors/match` không tăng khi số không đổi; điểm/thứ tự/lý do do back quyết định không đổi.

## Định nghĩa (để mỗi câu chỉ có một cách hiểu)
- **Danh sách vendor** = thẻ danh sách theo hạng mục trong khung chat vendor (có tiêu đề hạng mục, kicker "Gợi ý phù hợp" và các hàng vendor). Thẻ chi tiết và bảng so sánh KHÔNG phải danh sách.
- **Cuộc trò chuyện vendor hiện tại** = chuỗi thẻ đang có trong luồng vendor kể từ lần luồng được dựng gần nhất. Giữ cách bắt đầu lại hiện có: mở luồng vendor cho HẠNG MỤC KHÁC, hoặc mở luồng vendor sau khi đã dùng chat thường, thì bắt đầu lại và chỉ còn một danh sách của hạng mục vừa mở (xem "Không làm").
- **Số đã lưu của hạng mục c** = cặp (D, K): D = `allocated_tr` của hạng mục c, K = `guests`, trong bản dự toán ĐÃ LƯU trên server, front đọc bằng `GET /api/couples/<id>/budget` tại lúc cần (không suy luận, INV-005). D vắng hoặc <= 0 thì D = 0; K vắng hoặc <= 0 thì K = "chưa có". Đọc lỗi (không 2xx, mạng đứt) KHÔNG cho ra số: không có "số chưa biết", xem H1 bước 2.
- **Số chấm của một danh sách** = số đã lưu của hạng mục đọc ngay trước khi danh sách đó được yêu cầu.
- **Danh sách gần nhất của hạng mục c** = danh sách CUỐI CÙNG của hạng mục c trong cuộc trò chuyện vendor hiện tại.
- **So với lần trước** = so số đã lưu hiện tại với số chấm của danh sách gần nhất của hạng mục đó, bằng SỐ THÔ đã lưu (không làm tròn: 90 và 90,04 là khác nhau, hai danh sách cùng nhãn `90tr` là chấp nhận được). "Khác" = D khác hoặc K khác.
- **Lần lưu đang chờ** = thay đổi dự toán trên màn Ngân sách chưa gửi (đang đợi gộp 800ms) hoặc đã gửi chưa có phản hồi.

## Hành vi (người dùng thấy gì)

### H1 · Khi nào in danh sách mới (mỗi lần bấm "Tìm <hạng mục>")
"Tìm vendor" = nút `Tìm <tên hạng mục>` ở chi tiết hạng mục màn Ngân sách, và mọi lối khác mở luồng vendor kèm một hạng mục. (Lối mở thẻ chọn hạng mục `catId = null` cũng theo luật H1 này, xem bullet "Lối thẻ chọn hạng mục" bên dưới; chỉ cách bắt đầu lại luồng khi đổi `catId` giữ nguyên.) Mỗi lần bấm:
1. Nếu có lần lưu đang chờ: đợi nó xong rồi mới đọc số đã lưu. Lần lưu lỗi thì số đã lưu vẫn là số cũ (và câu báo `Chưa lưu được dự toán` ở màn Ngân sách giữ như T-171 H5). Đợi không quá thời gian của chính lần lưu đó; không thêm giới hạn riêng. Trong lúc đợi và đọc, khung chat MỞ NGAY và cuối cuộc trò chuyện hiện đúng một dòng `Đang lấy dự toán…`, biến mất khi xong (KHÔNG có eval đo dòng này; yêu cầu không đo).
2. Đọc số đã lưu của hạng mục: đúng một lần `GET /api/couples/<id>/budget`, không PUT/POST, không gọi `/api/vendors/match`. **Đọc lỗi (không 2xx, mạng đứt): KHÔNG in danh sách mới (kể cả khi hạng mục chưa có danh sách nào), không gọi match, hiện đúng một dòng `Chưa đọc được dự toán. Thử lại` kèm nút `Thử lại` ở cuối cuộc trò chuyện; danh sách đang có giữ nguyên. Bấm `Thử lại` đọc lại và đi tiếp từ bước 3. Không bao giờ in danh sách theo số đoán (0).** (T-179 sửa T-177 H5, vốn ghi bấm nút "không gọi API thêm": nay bấm được đọc dự toán một lần bằng GET, vẫn không PUT/POST thêm.)
3. Hạng mục chưa có danh sách nào trong cuộc trò chuyện vendor hiện tại: in MỘT danh sách (như hôm nay), gọi match một lần.
4. Có danh sách gần nhất và số đã lưu KHÁC số chấm của nó: in thêm MỘT danh sách mới ở CUỐI cuộc trò chuyện (một lần gọi match), cuộn tới nó. Không tải lại trang.
5. Số đã lưu BẰNG số chấm của danh sách gần nhất: KHÔNG in, KHÔNG gọi match, chat mở như cũ.
- So sánh luôn chỉ với danh sách GẦN NHẤT, không với mọi danh sách cũ: 90 -> 40 -> 90 in danh sách thứ ba dù bằng danh sách thứ nhất.
- KHÔNG tự in khi dự toán đổi: danh sách mới chỉ ra khi bấm Tìm vendor. Lý do: tránh gọi API cho cặp đôi không mở vendor, tránh in nhiều danh sách theo từng lần kéo thanh, và đúng câu Capu ("danh sách mở bằng nút Tìm vendor").
- Số khách đổi cũng tính (K trong cặp). Chỉ dự toán hạng mục (D) và số khách trong dự toán (K) được so; đổi phong cách, thành phố, ngày cưới không tự in danh sách mới (xem "Không làm").
- Danh sách tải lỗi (match không 2xx) giữ cách báo hiện có; lần bấm sau thử lại như hôm nay.
- Lối thẻ chọn hạng mục (`catId = null`): chọn một hạng mục trên thẻ chọn áp CÙNG luật H1 (đọc số, so với danh sách gần nhất của hạng mục đó trong cuộc trò chuyện, in hoặc không in; đọc lỗi thì dòng báo). Mở `Tìm <hạng mục>` khi luồng đang ở thẻ chọn (hoặc ngược lại) vẫn BẮT ĐẦU LẠI như hôm nay (đổi `catId` của luồng).

### H2 · Danh sách cũ đóng băng
Sau khi một danh sách đã hiện, nội dung của nó KHÔNG đổi nữa dù dự toán/số khách đổi: tên, ảnh, giá, thứ tự hàng, phần trăm và nhãn định tính, nhãn "Theo dự toán …", chip lý do, "PHÙ HỢP NHẤT". Không gọi match lại cho nó, không hiện `Đang cập nhật điểm…` hay `Chưa cập nhật được điểm` trên danh sách vì số đổi (phần T-174 H1, H2 cho thẻ danh sách bị bỏ). Thao tác của người dùng trên thẻ (Lưu/Kết nối, thu gọn/mở rộng) vẫn hoạt động. Thẻ chi tiết và bảng so sánh đã hiện cũng đóng băng (không lấy lại điểm khi số đổi): mọi thẻ chỉ ghi số tại lúc nó ra đời.

### H3 · Nhãn số đã dùng trên mỗi danh sách (chỉ thêm)
Mỗi danh sách có đúng MỘT dòng chữ nhỏ ngay dưới tiêu đề của thẻ: `Theo dự toán {D}tr · {K} khách` (D, K = số chấm của danh sách đó; bỏ phần ` · {K} khách` khi K = "chưa có"); khi D = 0: `Chưa có dự toán cho hạng mục này`. Định dạng số: làm tròn một chữ số thập phân, dấu phẩy, bỏ phần `,0` (90 -> `90`, 39,5 -> `39,5`). Nhãn là dòng THÊM; mọi chữ khác của danh sách giữ như hôm nay. Nhãn không đổi sau khi in. Đây cũng là chữ phân biệt các danh sách với nhau.

### H4 · Chi tiết và so sánh mở từ danh sách (cũ hay mới): chấm theo số đã lưu tại lúc mở, rồi đóng băng
Bấm hàng ở BẤT KỲ danh sách nào (kể cả danh sách cũ) mở một thẻ chi tiết MỚI chấm theo số đã lưu tại lúc mở, KHÔNG theo số của danh sách chứa hàng đó: khối "Phân tích AI" (phần trăm, ba thanh, chip, dòng phép so `… so với {D}tr tiệc cưới`) lấy từ phản hồi chi tiết (điểm theo bản đã lưu hiện tại, như T-171 H7). Trong lúc chờ điểm của thẻ chi tiết hiện đúng MỘT dòng `Đang cập nhật điểm…` thay cho khối đó, không hiện điểm của hàng đã bấm như điểm hiện hành (KHÔNG có eval đo dòng này; ghi là yêu cầu không đo). Lỗi lấy điểm (không 2xx, mạng đứt): `Chưa cập nhật được điểm. Thử lại` kèm nút `Thử lại` (như T-171 H2 cho lần lấy đầu). Phản hồi 2xx với `match: null`: một dòng `Chưa có điểm cho vendor này`, không `Thử lại` (T-171 H6, giữ nguyên). Bảng so sánh tạo từ thẻ chi tiết cũng chấm theo số đã lưu lúc tạo (một lần `ids`, T-171 H8), rồi đóng băng.
- Lý do chọn số hiện tại thay vì số của danh sách cũ: (1) back chỉ chấm được theo bản đã lưu hiện tại, không chấm lại "theo số cũ" được; (2) dòng phép so trên chi tiết tự ghi số dùng nên không gây hiểu nhầm, cặp đôi thấy hàng 100% ở danh sách cũ mà chi tiết ghi 70% so với 40tr thì hiểu ngay vì sao; (3) cặp đôi chọn vendor để chốt/ghi tiền, nên thẻ dẫn tới quyết định phải theo số thật hiện tại; (4) giữ đơn giản: mọi thẻ chi tiết/so sánh mới đều theo số hiện tại.
- Hệ quả đã chấp nhận: điểm trên chi tiết có thể khác phần trăm của hàng đã bấm trong danh sách cũ. Nếu Capu muốn chi tiết từ danh sách cũ giữ điểm của hàng: xem "Câu hỏi mở".

### H5 · "Xem thêm" của danh sách không trộn hai số
"Xem thêm N vendor" trong một danh sách chỉ thêm hàng khi số đã lưu hiện tại (đọc lại lúc bấm, như H1 bước 1-2) BẰNG số chấm của danh sách đó. Khác thì KHÔNG thêm hàng nào, danh sách giữ nguyên, và hiện đúng một dòng trong thẻ đó: `Dự toán đã đổi, không thêm được vendor vào danh sách này. Mở lại Tìm vendor để xem danh sách mới.` Đọc số lỗi thì không thêm và hiện đúng một dòng `Chưa đọc được dự toán. Thử lại` kèm nút `Thử lại` trong thẻ đó (bấm thì bấm lại "Xem thêm"). Sau khi câu cố định về số đã đổi hiện, nút "Xem thêm" của danh sách đó ẨN (không còn nút). Thu gọn/mở rộng các hàng đã có vẫn hoạt động. Danh sách mới in ra có nút "Xem thêm" riêng theo số của nó.

### H6 · Giữ nguyên các phần T-174/T-171 về lưu dự toán (không đổi một chữ)
T-171 H5 (lưu lỗi hiện `Chưa lưu được dự toán` + `Thử lại`, số vừa chỉnh không tự trả về số cũ, ghi lại sau lỗi chỉ đè trường người dùng đã đổi và KHÔNG xoá khoản do lần ghi khác đã lưu, màn tải lại ghép giá trị chưa lưu, ADR-104 lựa chọn A), H6 (vendor không có điểm), H7, H8 (back) giữ nguyên. Hệ quả cho bước đọc số của H1: khi lưu lỗi, số đã lưu vẫn là số cũ nên bấm Tìm vendor không in danh sách mới; thẻ chat theo bản đã lưu, như T-171 H5 đã viết.

### H7 · Văn bản cố định (đúng nguyên văn, chữ hoa/thường như ghi)
`Theo dự toán {D}tr · {K} khách` · `Theo dự toán {D}tr` · `Chưa có dự toán cho hạng mục này` · `Đang lấy dự toán…` · `Chưa đọc được dự toán. Thử lại` (nút `Thử lại`) · `Dự toán đã đổi, không thêm được vendor vào danh sách này. Mở lại Tìm vendor để xem danh sách mới.` · giữ từ T-171: `Đang cập nhật điểm…` · `Chưa cập nhật được điểm. Thử lại` · `Chưa lưu được dự toán` · `Chưa có điểm cho vendor này` · nút `Thử lại`.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-179-danh-sach-moi-giu-cu` · Vùng: `planner/vendor/matching` (đọc thêm `planner/front/budget`). Back không đổi (`GET /api/vendors/match`, `?ids=`, chi tiết có `match` đã có từ T-171/T-175).
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/vendor/matching/` inv-001..006, `planner/front/budget/` inv-001..005, `planner/_shared` nếu có. Không vi phạm inv-001..005 (front không tự tính điểm hay chọn số của server; số đọc từ bản đã lưu). **Mâu thuẫn với inv-006** (xem "Bất biến đề xuất"): đề nghị đổi, không tự sửa. inv-005 (`planner/front/budget`, ghi lại không xoá khoản) giữ nguyên, T-179 không đụng.
- Kiến trúc phải theo: `src/screens/chat/AIChatModal.jsx` (`VendorThread`), `src/screens/chat/VendorChatCards.jsx`, `src/App.jsx` (`openAIVendor`), `src/budget/useBudget.js` (lần lưu đang chờ). Các móc `scoreEpoch` của T-174 cho thẻ danh sách/chi tiết/so sánh được gỡ hoặc thôi dùng (Engineering quyết cách).
- Không chạm: payment, auth, schema, back.
- Bậc đề xuất: B (logic hiển thị và luồng chat, eval tự động phủ phần lớn, không chạm ranh giới cứng).

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (thêm `--repo <đường dẫn>` để chạy trên bản sao; biến `TOHONG_FRONT_REPO`, `PLAYWRIGHT_PATH`). Khung `eval/T-179/_lib.cjs` dùng lại `eval/T-171/_lib.cjs` (vite dev + Playwright + API giả CÓ TRẠNG THÁI), chạy App THẬT: Ngân sách > Nhà hàng tiệc cưới > kéo thanh "Dự toán" (đường lưu thật) > nút `Tìm nhà hàng tiệc cưới`. Eval đo chữ người dùng thấy và số lần gọi API, không đọc mã nguồn. Trong vite dev, StrictMode làm một thẻ mới dựng gọi match 1-2 lần; eval cho phép 1-2 mỗi danh sách mới (không phải sai lệch của front).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Đổi dự toán 90 -> 40, bấm Tìm vendor, không tải lại trang: có HAI danh sách; danh sách mới ở cuối: Beta rồi Alpha 70%, nhãn `Theo dự toán 40tr · 200 khách`; chưa bấm thì không gọi match | `node eval/T-179/check_1_doi_du_toan_in_danh_sach_moi.cjs` |
| 2 | Danh sách cũ giữ nguyên chữ qua hai lần đổi số (90 -> 40 -> 70): Alpha 100% nhãn 90tr, rồi Beta/Alpha 70% nhãn 40tr; không gọi lại điểm cho thẻ cũ; không có `Đang cập nhật điểm…`/`Chưa cập nhật được điểm` | `node eval/T-179/check_2_danh_sach_cu_giu_nguyen.cjs` |
| 3 | Số không đổi thì không in trùng và không gọi lại (bấm nhiều lần; kéo 90 -> 95 -> 90); so với danh sách gần nhất: 90 -> 40 in, 40 -> 90 in danh sách thứ ba | `node eval/T-179/check_3_khong_in_trung.cjs` |
| 4 | Số khách đổi 200 -> 300: in danh sách mới `Theo dự toán 90tr · 300 khách`, Alpha 70%; danh sách cũ `200 khách` giữ nguyên; bấm lại không đổi thì không in | `node eval/T-179/check_4_doi_so_khach.cjs` |
| 5 | Bấm Tìm vendor ngay sau khi kéo (lần lưu đang chờ, và khi phản hồi lưu chậm 1,2s): đúng một danh sách mới theo số vừa kéo | `node eval/T-179/check_5_bam_ngay_sau_khi_keo.cjs` |
| 6 | Lưu lỗi (500): `Chưa lưu được dự toán` còn, bấm Tìm vendor không in, không gọi match; `Thử lại` thành công rồi bấm thì in danh sách theo 40tr | `node eval/T-179/check_6_luu_loi_khong_in_theo_so_chua_luu.cjs` |
| 7 | Chi tiết mở từ hàng của danh sách cũ ghi `20 bàn = 78tr so với 40tr` và `70% phù hợp`; danh sách cũ không đổi; chi tiết đã hiện đóng băng khi đổi tiếp 70tr | `node eval/T-179/check_7_chi_tiet_tu_danh_sach_cu.cjs` |
| 8 | "Xem thêm" của danh sách cũ không thêm hàng, hiện câu cố định; "Xem thêm" của danh sách mới nhất thêm đủ 8 hàng theo 40tr | `node eval/T-179/check_8_xem_them_danh_sach_cu.cjs` |
| 9 | Chi tiết `200 match null`: `Chưa có điểm cho vendor này`, không `Thử lại`, không điểm cũ (giữ T-171 H6, thay adv-01 vốn đo cập nhật tại chỗ) | `node eval/T-179/check_9_chi_tiet_khong_co_diem.cjs` |
| 10 | Giữ T-171 H5: `Thử lại` sau khi vendor chốt ghi xen không đè khoản `vendor_t171_a`, server có 40 | `node eval/T-174/adv-03-thu-lai-khong-de-khoan-ghi-xen.cjs` |
| 11 | Giữ T-171 H5 (ADR-104 A): khoản người dùng thêm/sửa/xoá lúc có câu báo được ghi cùng khi lưu lại, khoản do lần ghi khác lưu còn | `node eval/T-171/check_10_khoan_nguoi_dung_giu_khi_luu_loi.cjs` |
| 12 | Giữ T-171 H5: lưu lỗi rồi chốt vendor ghi xen và màn tải lại: số 40 không mất im lặng | `node eval/T-174/adv-02-luu-loi-roi-chot-vendor-khong-mat-so.cjs` |
| 13 | Nhãn đúng nguyên văn ba dạng: dự toán 0 -> `Chưa có dự toán cho hạng mục này` (không `0tr`); số khách 0 -> `Theo dự toán 90tr` (không `khách`); 39,5 -> `Theo dự toán 39,5tr · 200 khách`; so số thô (90 -> 90,04 in danh sách thứ hai) | `node eval/T-179/check_10_nhan_cac_dang_so.cjs` |
| 14 | Đọc dự toán lỗi (GET 500) lúc bấm: không in, không gọi match, hiện `Chưa đọc được dự toán. Thử lại`; `Thử lại` rồi in theo số đúng; cả ca chưa có danh sách nào | `node eval/T-179/check_11_doc_du_toan_loi.cjs` |
| 15 | T-177 (đối chiếu, M1): bấm nút Tìm mở đúng hạng mục một lần, không PUT/POST thêm | `node eval/T-177/check_4_bam_mo_tim_vendor.cjs` |
| 16 | Bất biến `planner/front/budget` inv-006: số tiền trong chữ nút Tìm khớp thanh Dự toán | `bash eval/invariants/planner/front/budget/inv-006-nut-tim-so-khop-du-toan-doc-du.sh` |
| 17 | Bất biến `planner/front/budget` inv-007: chữ nút Tìm tên dài không tràn ở 320-360px | `bash eval/invariants/planner/front/budget/inv-007-nut-tim-ten-dai-khong-tran-320-360.sh` |

Eval 10-12 và 15-17 là eval có sẵn, không phụ thuộc thẻ chat, giữ nguyên (gate T-179 vùng `planner/vendor/matching` không tự chạy bể `planner/front/budget`, nên 16-17 được ghi tường minh vì T-179 chạm `useBudget.js` và luồng bấm). Back (T-171 check_9, adv-09, adv-11) không đổi, chạy lại không cần sửa.

Tự kiểm bằng bản cài giả: bản sao front (`vendorSig.js` đọc số đã lưu và chờ lần lưu; `VendorThread` in thêm khi số khác danh sách gần nhất; nhãn; thẻ thôi lấy lại điểm; chi tiết luôn lấy điểm lúc mở; "Xem thêm" đọc lại số; `useBudget` báo lần lưu đang chờ): eval 1-14 PASS trên bản giả; trên front main `7d65d5e` eval 1-9 đều FAIL; bản đột biến của Spec Gate (`vendorSig.js` nhãn thô `Theo dự toán ${d}tr · ${k} khách`, đọc lỗi trả 0,0) từng PASS 9/9 nay ĐỎ ở eval 13 và 14. Cách cài thật tuỳ Engineering, miễn hành vi như trên.

## Bất biến đề xuất (tầng 2)
**Bản thay cho `planner/vendor/matching/inv-006-the-ghep-khong-hien-diem-cu.sh` (Chief quyết, ghi `decisions/`; spec-critic rút khi spec qua cổng).** inv-006 cũ ("thẻ ghép không hiện điểm hay dòng phép so tính trên dự toán/số khách cũ hơn bản đã lưu của cặp đôi trong cùng phiên") mâu thuẫn với ADR-106 cho danh sách cũ và sẽ ĐỎ ngay khi T-179 merge nếu không thay. Bản thay đề xuất, phát biểu:
> Trong luồng vendor, danh sách vendor MỚI NHẤT của một hạng mục, sau mỗi lần bấm Tìm vendor, luôn theo dự toán hạng mục và số khách ĐÃ LƯU (không có điểm/phép so tính trên số cũ hơn bản đã lưu); mọi danh sách ghi rõ số nó đã dùng (`Theo dự toán {D}tr · {K} khách`) và KHÔNG đổi nội dung sau khi hiện; số không đổi so với danh sách gần nhất thì không in trùng và không gọi lại điểm.
Nội dung chạy được = eval 1 + 2 + 3 + 5 + 7 + 10 của spec này (5: bấm ngay sau khi kéo, đọc số sau lần lưu; 7: chi tiết mở theo số đã lưu; 10: nhãn đúng các dạng số); bản nháp đặt ở `eval/T-179/bat-bien-cho-merge/inv-006-danh-sach-moi-nhat-theo-du-toan-da-luu.sh` (chạy sáu eval, in `PASS` hoặc `FAIL <eval>`). Điều kiện ADR-028: đỏ trên main tới khi PR front T-179 merge; sau đó Chief chép vào `eval/invariants/planner/vendor/matching/` thay inv-006 cũ (dùng lại `eval/T-179/_lib.cjs`, `eval/T-171/_lib.cjs`). Phần cũ còn đúng và được giữ trong bản thay: thẻ chi tiết/so sánh MỚI luôn theo số đã lưu tại lúc mở (eval 7). `lib/the_ghep_inv.cjs` và `the_ghep_khung.cjs` của inv-006 cũ không còn dùng sau khi thay.
Không có bất biến mới khác (inv-005 của `planner/front/budget` giữ nguyên).

### Eval cũ sẽ lỗi thời khi T-179 merge
Hết giá trị (đo hành vi cập nhật tại chỗ, đảo ngược bởi ADR-106) nên phải gỡ khỏi `eval` của T-171 và gate (Chief/adversary quyết cách ghi, không xoá tay file trong sổ cái):
- `eval/T-171/check_1_doi_du_toan_the_danh_sach.cjs` (danh sách đổi 100% -> 70% tại chỗ, `Đang cập nhật điểm…`): thay bằng T-179 check_1, check_2.
- `eval/T-171/check_2_chi_tiet_va_so_sanh.cjs` (chi tiết và bảng so sánh đổi tại chỗ): thay bằng check_7 (chi tiết); bảng so sánh chỉ còn kiểm lúc tạo (không có eval riêng mới, xem "Còn trống").
- `eval/T-171/check_3_khong_goi_thua.cjs` (một sự kiện = 1 lần match + chi tiết không quá 1): thay bằng check_3 (không in trùng); phần "đổi 90 -> 40 gọi 1 lần ghi" nay chỉ là một lần ghi, không kéo theo match.
- `eval/T-171/check_4_luu_loi.cjs` (nửa sau: `Thử lại` thành công thì thẻ chat hiện theo số mới tại chỗ): thay bằng check_6; phần câu báo `Chưa lưu được dự toán` còn đúng.
- `eval/T-171/check_5_doi_ho_so_so_khach.cjs`, `check_7_lay_lai_diem_loi.cjs`, `check_8_phan_hoi_tre_khong_de_len.cjs` (lấy lại điểm sau sự kiện, lỗi lấy lại, phản hồi trễ không đè): hết đối tượng (không còn lấy lại điểm). check_5 thay bằng T-179 check_4.
- `eval/T-174/adv-01-chi-tiet-khong-co-match-khong-ket-loi.cjs` (chi tiết/so sánh sau sự kiện), `adv-04-phan-hoi-rat-tre-va-tai-dau-cham.cjs`, `adv-05-luu-nhanh-loi-xen-ke.cjs` (đều đo thẻ lấy lại điểm sau sự kiện): lỗi thời; adv-01 thay bằng T-179 check_9. adv-04, adv-05 cần adversary đọc lại xem còn phần nào đo lưu (adv-05) hay tải đầu chậm (adv-04) đáng giữ.
- `eval/invariants/planner/vendor/matching/inv-006-the-ghep-khong-hien-diem-cu.sh`: thay theo trên.
Còn đúng, giữ: T-171 check_6 (số khách đổi bằng action chat rồi mở thẻ mới ghi 117tr; đo thẻ MỚI nên vẫn xanh), check_9 và T-174 adv-09, adv-11 (back), check_10, T-174 adv-02, adv-03, adv-06, adv-07, adv-08, adv-10, adv-12 (không dùng thẻ chat).

## Không làm
- Không tự in danh sách khi dự toán đổi; không polling, không làm mới định kỳ.
- Không lưu cuộc trò chuyện vendor qua tải lại trang và không giữ danh sách khi luồng bắt đầu lại (đổi hạng mục, dùng chat thường): đúng như hôm nay, lúc đó chỉ còn danh sách mới theo số hiện tại. Tức "danh sách cũ giữ nguyên" áp cho các danh sách đang có trong cuộc trò chuyện vendor hiện tại.
- Không thêm lối mở thẻ chọn hạng mục mới và không đổi cách thẻ chọn bắt đầu lại luồng (đổi `catId`). Chọn một hạng mục trên thẻ chọn theo CÙNG luật H1 (đọc số, so với danh sách gần nhất, in hoặc không in, đọc lỗi thì dòng báo), không có luật riêng. (Ghi chú ADR-112: hiện front không có lối nào mở thẻ chọn, nên luật này chưa có chỗ chạy.)
- Không coi đổi phong cách, thành phố, ngày cưới là "số đổi" (ADR-106 nói về dự toán; nếu cần thì việc riêng). Khi số khách chỉ nằm ở hồ sơ mà dự toán chưa có `guests` (K = "chưa có"), đổi số khách hồ sơ không in danh sách mới; rủi ro đã biết.
- Không xử lý số đổi GIỮA lúc một danh sách đang tải: nó hiện theo điểm server trả, nhãn ghi số đọc lúc yêu cầu; lần bấm sau so với số đó và in mới nếu khác.
- Không xử lý ca dự toán hạng mục = 0 mà back vẫn chấm theo tổng ngân sách × tỷ lệ (`total_share`, T-167): nhãn ghi `Chưa có dự toán cho hạng mục này` trong khi chi tiết ghi `so với 43tr`; đổi tổng ngân sách khi D = 0 không in danh sách mới. Rủi ro đã biết.
- Không đổi thuật toán chấm, trọng số, thứ tự, chip, câu AI; không đổi back; không đổi dữ liệu ghi lên server.
- Không thêm cách "tải lại danh sách cũ" hay nút cập nhật trên thẻ cũ.

## Còn trống (eval không phủ)
- Dòng `Đang cập nhật điểm…` của thẻ chi tiết lúc chờ (H4) và bảng so sánh lúc tạo (chấm theo `ids` một lần): không có eval riêng mới (eval 7 đo kết quả cuối của chi tiết). Cuộn tới danh sách mới, vị trí cuộn giữ khi mở lại chat: không đo.
- Dòng `Đang lấy dự toán…` (H1 bước 1) và dòng `Chưa đọc được dự toán. Thử lại` ở "Xem thêm" (H5): dòng đầu không đo; dòng sau không có eval riêng (cùng nhánh đọc lỗi với eval 14).
- Đo bằng API giả; chưa chạy với back thật (back không đổi).

## Câu hỏi mở
Một câu cho Capu (có mặc định, không chặn): chi tiết vendor mở từ một hàng của danh sách CŨ nên ghi điểm theo dự toán HIỆN TẠI (mặc định trong H4, vì phản hồi chi tiết của back chỉ chấm được theo bản đã lưu và để quyết định chốt theo số thật), hay giữ nguyên phần trăm của hàng đã bấm (cần front ghi nhớ điểm hàng và chỉ lấy câu AI; nếu chọn thế H4 và eval 7 đổi)?

## Lịch sử sửa
- v2.1 (2026-11-16, việc T-183, chỉ sửa chữ, không đổi hành vi): câu mở đầu H1 và bullet "Không làm" về thẻ chọn hạng mục nói "không đổi / như hôm nay / không logic không in trùng", mâu thuẫn với H1 M3 (thẻ chọn áp cùng luật H1; code đã theo H1, ADR-112). Hai câu sửa cho khớp M3; không đổi eval.
- v2 (2026-11-15, theo `handoffs/T-179-D1.md` B1, B2, M1-M6): bỏ khái niệm "số chưa biết" (câu H1 bước 5 và Định nghĩa mâu thuẫn); đọc dự toán lỗi = không in + dòng `Chưa đọc được dự toán. Thử lại` (kể cả chưa có danh sách); thêm eval 13 (ba dạng nhãn + số thô) và 14 (đọc lỗi); bản thay inv-006 chạy thêm check_5 và check_7; ghi T-179 sửa T-177 H5 (thêm một GET), thêm eval T-177 check_4 và bất biến `planner/front/budget` inv-006, inv-007; M2 chat mở ngay + dòng `Đang lấy dự toán…`; M3 thẻ chọn hạng mục áp luật H1; M4 ẩn nút Xem thêm sau câu cố định; M5 so số thô; M6 ghi "Không làm".
- v1 (2026-11-15): bản đầu, theo ADR-106 và brief của Chief (`board/T-179.md`).
