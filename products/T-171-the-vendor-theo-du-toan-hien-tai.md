# Spec T-171: Thẻ vendor trong chat luôn chấm điểm theo dự toán và số khách hiện tại

> v1 · Spec Writer (product) · 2026-11-15 · bậc A · vùng `planner/vendor/matching` · chỉ chạm `tohong-front` (back không đổi) · nối tiếp T-167 (dòng phép so `budgetBasis`), ADR-097, ADR-098.

## Ý định
Capu đổi dự toán Tiệc cưới 90tr -> 40tr ở màn Ngân sách; thẻ vendor trong chat vẫn chấm điểm và ghi phép so "so với 90tr". Điểm và dòng phép so trên mọi thẻ vendor phải theo số hiện tại của cặp đôi, và nếu số đó chưa lưu được thì cặp đôi phải được báo.

## Bằng chứng (Chief đọc front main `0221a5c`, Product đối chiếu lại bằng code ngày 2026-11-15)
- Nguyên nhân 1 (chính), xác nhận: `src/screens/chat/VendorChatCards.jsx:222-241`, `VMatchChatCard` gọi `api.matchVendors` trong một `useEffect` với deps `[catId, coupleId]`, nên chỉ gọi lúc mount; không có gì làm nó chạy lại khi dự toán/số khách đổi. Ở `src/App.jsx:389-435` `VendorProvider` và `AIChatModal` luôn mount (chat chỉ trượt ra/vào bằng `transform`, `AIChatModal.jsx:105-115`) nên thẻ sống suốt phiên và giữ kết quả cũ.
- Nguyên nhân 2, xác nhận: màn chi tiết và bảng so sánh dùng điểm chụp sẵn từ danh sách. `VDetailChatCard` (`VendorChatCards.jsx:493`) nhận `vendor` đã `adaptVendor` (điểm, `breakdown`, `budgetBasisText` từ dòng 25-55); effect `:527-545` chạy một lần theo `[vendor?.id, coupleId]` và CHỈ lấy `res.match.whyThisVendor`, bỏ `scoreBreakdown`/`totalScore`/`budgetBasis` mà server vừa trả. Hiển thị ở `:626` (`{vendor.match}% phù hợp`) và `:640-643` (dòng phép so). Bảng so sánh `VCompareTableChatCard` (`:863`, hàng "Phù hợp" `:902`) nhận mảng `vendors` đã chụp qua `pushAI(VCompareTableChatCard, {catId, vendors:[anchor, ...chosen]})` (`:767`), không gọi API.
- Nguyên nhân 3, xác nhận: `VendorProvider` (`src/screens/VendorCtx.jsx:50-59`) tải `getBudget` một lần theo `[coupleId]` (`budgetCats`, `guests`); màn Ngân sách giữ bản riêng qua `useBudget(coupleId, [], refreshKey)` (`Budget.jsx:564`) và chỉ biết `refreshKey` tăng khi `VendorCtx.syncBudgetItem` ghi (`VendorCtx.jsx:88-89`, `App.jsx:389`) hoặc chat action `add_budget_item` (`App.jsx:365-376`). Không có tín hiệu nào từ "dự toán vừa lưu" tới thẻ chat.
- Nguyên nhân 4 (phụ), xác nhận: `src/budget/useBudget.js:86-105` `scheduleSave` ghi sau 800ms bằng `api.putBudget(...).catch(() => {})` (dòng 98-103): lỗi bị nuốt, UI giữ số mới như đã lưu (`mutate` đặt `cats` trước khi lưu), server giữ số cũ. Lỗi này tự nó đủ để thẻ chat "vẫn so với 90tr" dù thẻ có tải lại đúng.
- Back không phải nguyên nhân: Chief đã đọc back chấm theo bảng dự toán mỗi request (`api/vendors.js:110-128`, T-159 H4); `api/budget.js:98-111` PUT ghi thẳng `budget.json`. Không đổi back.
- Số khách: back lấy `guests` của bảng dự toán nếu > 0, không thì hồ sơ (`api/vendors.js:93-101`; INV-005). Danh sách khách ở màn Khách mời KHÔNG vào phép chấm, nên sửa danh sách khách không phải sự kiện của spec này. Đường front đổi số khách server dùng: ghi hồ sơ (`api.updateProfile`, `App.jsx:290` lúc onboarding) và action chat `update_profile` (server ghi, front nhận kết quả ở `App.jsx:371-376`).
- Chưa có số liệu người dùng; mức độ ảnh hưởng ngoài Capu: GIẢ ĐỊNH, tự tin ~70% rằng cặp đôi nào đổi dự toán rồi mở lại thẻ trong cùng phiên đều gặp. Nguyên nhân 1-4 là sự thật theo code (tự tin cao ~90%); phần tương tác thật (vd debounce, dev server) eval sẽ đo.

## Giả thuyết
Nếu thẻ vendor lấy lại điểm sau mỗi lần ghi thành công dự toán/hồ sơ thì Capu (và cặp đôi) không còn thấy dòng phép so mâu thuẫn với màn Ngân sách (đo: số lần Capu báo "điểm so với số cũ" về 0). Chỉ số bảo vệ: số lần gọi `/api/vendors/match` và chi tiết khi không có gì đổi giữ nguyên (không tăng), điểm/thứ tự/lý do do back quyết định không đổi.

## Định nghĩa (để mỗi câu chỉ có một cách hiểu)
- **Sự kiện đổi số** = một lần ghi THÀNH CÔNG (server trả 2xx) mà front thực hiện lên dự toán (`api.putBudget`, `PUT /api/couples/<id>/budget`) hoặc hồ sơ cặp đôi (`api.updateProfile`, `PATCH /api/couples/<id>`), và nội dung ghi làm đổi ít nhất một số server dùng để chấm: ngân sách hạng mục, tổng ngân sách, số khách, ngày cưới, thành phố, phong cách. Lần ghi nội dung y hệt bản đã lưu không phải sự kiện. Ghi lỗi (không 2xx, mạng đứt) không phải sự kiện.
- **Thẻ vendor** = thẻ danh sách (`VMatchChatCard`), thẻ chi tiết (`VDetailChatCard`), bảng so sánh (`VCompareTableChatCard`). Mỗi thẻ đang mount hoặc hiện trong chat của phiên này.
- **Điểm của thẻ** = phần trăm tổng, ba thanh (Ngân sách, Phong cách, Lịch trống), thứ tự, chip lý do và dòng phép so `budgetBasis.text`. Front chỉ hiển thị số back trả, không tự tính.

## Hành vi (người dùng thấy gì)

### H1 · Sau sự kiện đổi số, mọi thẻ vendor đang có trong phiên lấy lại điểm
- Thẻ danh sách: gọi lại `GET /api/vendors/match` đúng một lần cho mỗi sự kiện; hiện điểm và THỨ TỰ mới của server (xếp lại tại chỗ, không giữ thứ tự cũ).
- Thẻ chi tiết (đang mở trong chat): gọi lại `GET /api/vendors/:id?coupleId=…` đúng một lần cho mỗi sự kiện và đổi tại chỗ: "Phân tích AI · N% phù hợp", ba thanh, chip lý do, dòng phép so (vd `≈ 3,9tr/bàn × 20 bàn = 78tr so với 40tr tiệc cưới`) lấy từ phản hồi mới; không chỉ câu AI `whyThisVendor`.
- Bảng so sánh đã tạo: hàng "Phù hợp" (và mọi giá trị điểm của từng cột) lấy lại điểm từ phản hồi mới cho từng vendor trong bảng. Số cuộc gọi để làm việc này do Engineering chọn (một lần theo danh mục hoặc chi tiết từng vendor); eval không đếm cho bảng so sánh.
- Không tải lại trang; không mất vị trí cuộn của chat; nút đã bấm (Lưu, Kết nối) giữ nguyên trạng thái.
- Mở một thẻ chi tiết mới sau sự kiện (bấm vendor ở danh sách) hiện ngay điểm mới, không cần chờ thêm sự kiện.
- Sự kiện xảy ra khi người dùng đang ở màn khác (Ngân sách, Hồ sơ) hoặc chat đang đóng: thẻ lấy lại điểm ngay sau khi ghi thành công, để lúc quay lại chat điểm đã mới; không chờ tới lúc mở chat.
- Nhiều lần chỉnh liên tiếp mà front gộp thành một lần ghi (debounce 800ms hiện có) = MỘT sự kiện = MỘT lần lấy lại mỗi thẻ.

### H2 · Trong lúc chờ điểm mới, không hiện điểm cũ như điểm hiện hành
Từ lúc sự kiện xảy ra tới lúc phản hồi mới về, phần điểm của thẻ (phần trăm tổng, ba thanh, dòng phép so) được thay bằng chữ `Đang cập nhật điểm…` (một dòng, thẻ giữ tên vendor, ảnh, giá). Lấy lại điểm LỖI thì thẻ hiện `Chưa cập nhật được điểm. Thử lại` kèm nút `Thử lại` (bấm gọi lại một lần), không hiện số cũ. Phản hồi tới trễ của lần gọi trước (đã có sự kiện mới hơn) không được ghi đè kết quả của lần gọi sau.

### H3 · Không gọi thừa
Không có sự kiện đổi số thì số lần gọi `/api/vendors/match` và chi tiết KHÔNG tăng khi: chuyển qua lại các tab/màn, mở lại chat, mở lại màn Ngân sách, kéo thanh về đúng giá trị đã lưu, ghi lỗi. Thẻ vừa mount tự lấy điểm đúng như hôm nay (một lần lúc hiện).

### H4 · Thẻ cũ trong lịch sử chat
Thẻ đã hiện trong chat của phiên này (kể cả cuộn lên cao) được cập nhật tại chỗ theo H1; không đóng băng. Thẻ vendor được dựng lại từ lịch sử cuộc trò chuyện cũ khi mở lại cuộc trò chuyện hoặc tải lại trang chạy như thẻ mới mount (lấy điểm theo số hiện tại). Giả định, xem "Câu hỏi mở".

### H5 · Lưu dự toán lỗi không im lặng (màn Ngân sách)
Khi lần ghi dự toán tự lưu lỗi (server không 2xx hoặc mạng đứt):
- Màn Ngân sách hiện, thấy được cùng lúc với số chưa lưu, câu `Chưa lưu được dự toán` kèm nút `Thử lại`. Số cặp đôi vừa chỉnh (vd 40) KHÔNG bị tự trả về số cũ (không làm mất việc vừa làm); câu báo là dấu cho biết đó chưa phải bản đã lưu.
- Câu báo còn nguyên khi chuyển tab rồi quay lại, tới khi một lần ghi thành công.
- Bấm `Thử lại` ghi lại bản mới nhất đang hiện trên màn (không ghi bản cũ). Ghi thành công: câu báo biến mất và đây là một sự kiện đổi số (H1). Chỉnh tiếp khi đang có câu báo: lần tự lưu kế tiếp thành công cũng làm câu báo biến mất.
- Trong lúc chưa lưu được, thẻ vendor KHÔNG lấy lại điểm (server chưa đổi) và vẫn hiện điểm, dòng phép so theo bản ĐÃ lưu (90tr): đúng với server, không phải với số chưa lưu.
- Câu báo cùng quy tắc áp cho mọi chỗ khác front ghi dự toán và lỗi (vd khi chốt vendor ở `VendorCtx.syncBudgetItem`); eval chỉ kiểm đường tự lưu của màn Ngân sách (xem "Không làm").

### H6 · Văn bản cố định (đúng nguyên văn, chữ hoa/thường như ghi)
`Đang cập nhật điểm…` · `Chưa cập nhật được điểm. Thử lại` · `Chưa lưu được dự toán` · nút `Thử lại`.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` (chính: `src/screens/chat/VendorChatCards.jsx`, `src/screens/VendorCtx.jsx`, `src/budget/useBudget.js`, `src/screens/Budget.jsx`, `src/api.js`) · Nhánh: `t-171-the-vendor-theo-du-toan` · Vùng: `planner/vendor/matching`. Back không đổi; không đổi hợp đồng API.
- Bất biến đã đọc: `_shared/`, `planner/vendor/` (inv-001..005) và `planner/vendor/matching/` (inv-001..005). Không vi phạm: không đổi điểm, thứ tự do back, trọng số, nhãn giá (inv-002), giá ước tính không là bằng chứng (inv-003), venue so bàn × giá (inv-004), một số khách hiệu lực (planner/vendor inv-005: front không tự tính số khách), điểm Ngân sách suy ra từ `budgetBasis` (matching inv-005: front chỉ hiển thị `budgetBasis.text` nguyên văn của lần gọi mới nhất, không tự tính lại). Không đề nghị đổi bất biến nào.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng mới (chỉ gọi lại các GET đã có quyền), LLM (hash câu AI, `whyThisVendor` giữ nguyên), back.
- Bậc A đề xuất: chỉ front, UI + gọi lại GET sẵn có + một câu báo lỗi; eval tự động phủ cả năm tiêu chí; không chạm ranh giới cứng. Lưu ý: spec chạm đường ghi dự toán (PUT) ở phía báo lỗi/ghi nhận thành công, nhưng không đổi nội dung ghi, không đổi dữ liệu nào được ghi. Chief of Staff cân nhắc nâng bậc nếu coi đó là "tiền"; Product đánh giá không phải.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (biến `TOHONG_FRONT_REPO` mặc định `../tohong-front`, `PLAYWRIGHT_PATH`). Khung chung `eval/T-171/_lib.cjs`: vite dev + Playwright, API giả CÓ TRẠNG THÁI (PUT/PATCH đổi dự toán/số khách, GET match và chi tiết tính điểm theo trạng thái), màn thật `ScreenBudget` + thẻ chat cùng một `VendorProvider`; đổi dự toán bằng cách kéo thanh "Dự toán" (đường tự lưu thật của front). Đỏ trên main (đã chạy: cả 5 đỏ, không ERROR).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Đổi dự toán Tiệc cưới 90 -> 40 ở màn Ngân sách, không tải lại trang: thẻ danh sách hiện Alpha 70% (trước 100%) và thứ tự mới Beta, Alpha; trong lúc chờ phản hồi chậm không hiện 100% cũ mà hiện `Đang cập nhật điểm` | `node eval/T-171/check_1_doi_du_toan_the_danh_sach.cjs` |
| 2 | Cùng thao tác: chi tiết đang mở đổi tại chỗ sang "70% phù hợp", Ngân sách 0%, `20 bàn = 78tr so với 40tr tiệc cưới`; bảng so sánh đã tạo hiện Alpha 70% (không còn 100%); mở chi tiết lần nữa hiện `so với 40tr` | `node eval/T-171/check_2_chi_tiet_va_so_sanh.cjs` |
| 3 | Không gọi thừa: chuyển tab qua lại, kéo 90 -> 95 -> 90 thì số lần gọi match/chi tiết +0; đổi 90 -> 40 (nhiều lần bấm) đúng 1 lần ghi, match +1, chi tiết +1 | `node eval/T-171/check_3_khong_goi_thua.cjs` |
| 4 | Lưu lỗi (500 và mạng đứt): màn Ngân sách hiện `Chưa lưu được dự toán` + `Thử lại` cùng lúc với số 40; thẻ chat không gọi lại, còn 100% theo bản đã lưu; câu báo còn sau khi chuyển tab; `Thử lại` thành công thì câu báo mất và thẻ hiện 70% | `node eval/T-171/check_4_luu_loi.cjs` |
| 5 | Số khách 200 -> 300 qua ghi hồ sơ (`api.updateProfile`): chi tiết và danh sách lấy lại điểm (`30 bàn = 117tr so với 90tr`, 70%); ghi hồ sơ lỗi thì không gọi lại | `node eval/T-171/check_5_doi_ho_so_so_khach.cjs` |

Ghi chú về eval 5 (rủi ro khung): đường đổi số khách có thật duy nhất mà eval dựng được ở mức thành phần là lệnh ghi hồ sơ của front; spec ghi hợp đồng ở ranh giới `api.updateProfile`/`api.putBudget` ("Sự kiện đổi số"), cách Engineering móc (ở `api.js` hay ở nơi gọi) tuỳ chọn miễn mọi nơi gọi đều được phủ.

## Bất biến đề xuất (tầng 2)
INV (vùng `planner/vendor/matching`, front): "Thẻ ghép vendor trong chat không hiện điểm hay dòng phép so tính trên dự toán/số khách cũ hơn bản đã lưu của cặp đôi trong cùng phiên." Nội dung chạy được = tiêu chí 1 + 2 (sau khi đổi dự toán 90 -> 40 qua đường lưu thật, mọi thẻ hiện `so với 40tr`, không còn `90tr`) cộng tiêu chí 3 (không gọi thừa). Spec-critic rút khi spec qua cổng; điều kiện ADR-028 (đỏ trên main nên để ở `eval/T-171/` tới khi PR front merge).

## Không làm
- Không đổi back, thuật toán chấm, trọng số, thứ tự do back, chip lý do, câu AI.
- Không thêm làm mới định kỳ, không polling, không gọi lại khi mở chat lúc không có sự kiện (H3).
- Không báo lỗi/ghi nhận thành công cho các PUT dự toán khác ngoài đường tự lưu của màn Ngân sách trong eval (`VendorCtx.syncBudgetItem`, action chat `add_budget_item`/`update_profile` do server ghi) ngoài quy tắc H5 đã nêu; chưa có eval cho các đường này (ghi nhận rủi ro; đề nghị việc kế tiếp nếu Capu muốn).
- Không đổi nội dung dữ liệu ghi lên server; không làm ngược (ghi lại số cũ khi lỗi).
- Không coi sửa danh sách khách ở màn Khách mời là sự kiện đổi số.

## Câu hỏi mở
Một câu cho Capu: thẻ cũ trong lịch sử chat (đã cuộn lên cao) nên TỰ CẬP NHẬT tại chỗ theo dự toán mới (đề xuất, và đã ghi ở H1/H4), hay ĐÓNG BĂNG và ghi nhãn "điểm theo dự toán lúc <giờ>"? Đề xuất cập nhật vì cặp đôi hay quay lại thẻ cũ để chọn vendor và nhãn đóng băng buộc họ gọi lại thẻ thủ công; nếu Capu chọn đóng băng, H1/H4 và eval 1-2 đổi.

## Lịch sử sửa
- v1 (2026-11-15): bản đầu.
