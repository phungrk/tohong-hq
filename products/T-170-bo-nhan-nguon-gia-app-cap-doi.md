# Spec T-170: Bỏ nhãn nguồn giá trên mọi màn app cặp đôi

> v1 · Spec Writer (product) · 2026-11-15 · bậc A · vùng `planner/vendor/images` · chỉ chạm `tohong-front` (mốc main `0221a5c`) · đảo một phần H4 của T-164 theo ADR-099.

## Ý định
Capu (2026-11-15, `decisions/2026-11-15-adr-099-bo-nhan-nguon-gia-app-cap-doi.md`): "hãy bỏ hiển thị nguồn giá. Ví dụ: Giá marry.vn · 06/2026"; phạm vi chọn "Mọi màn app cặp đôi", admin vẫn thấy. Chief đã nêu rủi ro (nhãn "Ước tính theo hạng mục" là dấu duy nhất báo giá là giá đoán); Capu vẫn chọn bỏ.

## Bằng chứng
- Quyết định trực tiếp của Capu (ADR-099). Danh sách chỗ hiện nhãn dưới đây đọc từ `tohong-front` main `0221a5c` bằng `grep` toàn `src/` (các từ khoá: `PriceTag`, `price_label`, `price_source`, `price_basis`, `marry.vn`, "ước tính", "xác minh", "Giá do Tơ Hồng", "Giá cũ marry"). Tự tin ~90% là đủ; 10% còn lại là chữ do back/AI sinh (xem "Câu hỏi mở").

### Mọi chỗ app cặp đôi hiện nhãn nguồn giá (tất cả đi qua một component `PriceTag`, `src/ui/PriceTag.jsx:4-18`)
`PriceTag` vẽ NGUYÊN VĂN `price_label` của API; thiếu thì chữ dự phòng theo `price_source`: "giá đã xác minh" nếu `verified`, còn lại "giá ước tính" (`PriceTag.jsx:6`, kể cả khi `price_source` thiếu). Các nhãn hiện thật: "Giá marry.vn · 06/2026", "Ước tính theo hạng mục", "Giá đã xác minh", "Giá do Tơ Hồng cập nhật", "Giá cũ marry.vn", "giá ước tính", "giá đã xác minh".

| # | Màn | file:dòng | Ghi chú |
| --- | --- | --- | --- |
| 1 | Chat: danh sách vendor (VMatchChatCard), cạnh giá mỗi hàng | `src/screens/chat/VendorChatCards.jsx:383` | |
| 2 | Chat: chi tiết vendor (VDetailChatCard), dưới giá ở đầu | `VendorChatCards.jsx:617` | |
| 3 | Chat: thẻ chọn vendor để so sánh (VPickerMultiChatCard) | `VendorChatCards.jsx:826` | |
| 4 | Chat: bảng so sánh (VCompareTableChatCard), ô "Giá" | `VendorChatCards.jsx:899` | |
| 5 | Tab Vendor: danh sách đã lưu (ScreenVendorShortlist), nhánh giá đã đổi | `src/screens/Vendors.jsx:45` | đi kèm "giá đã cập nhật (…)" |
| 6 | Tab Vendor: danh sách đã lưu, nhánh giá không đổi | `Vendors.jsx:46` | |
| 7 | Ngân sách: sheet chi tiết vendor, giá không đổi | `src/screens/Budget.jsx:220` | |
| 8 | Ngân sách: sheet chi tiết vendor, giá đã đổi ("Bạn đã lưu lúc …tr. Giá hiện tại trên Tơ Hồng: … · [nhãn]") | `Budget.jsx:223` | |
| 9 | Ngân sách: hàng vendor đã lưu, nhánh giá đã đổi | `Budget.jsx:442` | đi kèm "giá đã cập nhật" |
| 10 | Ngân sách: hàng vendor đã lưu, nhánh giá không đổi | `Budget.jsx:443` | |

Không phải chỗ hiện (đã rà, giữ nguyên): `VendorChatCards.jsx:39-41` (`adaptVendor` chỉ giữ dữ liệu `priceSource`/`priceLabel`/`perTable`), `VendorChatCards.jsx:522`, `Budget.jsx:115,126`, `ConnectCtx.jsx:14` (`price_verified` gửi đi trong tin nhắn kết nối, không vẽ ra màn), `src/api.js:153`, `connectContext.js:12`. Chỗ admin giữ nhãn: `src/admin/EnrichDrawer.jsx:30,170,198,238` (dòng "Nhãn giá: …"), `src/admin/VendorData.jsx:11-14,96` (cột Nhãn, ô chọn Nhãn), `EnrichTable.jsx:136` (tiêu đề cột, không phải nhãn giá). Hai màn Chat/AI khác (`AppChat.jsx:169`) chỉ có chữ "Ước tính số bàn cần đặt" là gợi ý chat về số bàn, không phải nhãn giá.

## Giả thuyết
Nếu bỏ nhãn nguồn giá khỏi app cặp đôi thì màn gọn hơn đúng như Capu muốn. Chỉ số bảo vệ: giá vẫn hiện đúng; không chip ngân sách cho giá ước tính; API vẫn trả nhãn cho admin.

## Hành vi (người dùng thấy gì)
H1. Ở 10 chỗ bảng trên, cạnh/bên dưới giá chỉ còn giá. Không chữ nào trong danh sách nhãn ở trên xuất hiện ở app cặp đôi: "Giá marry.vn · …", "Ước tính theo hạng mục", "Giá đã xác minh", "Giá do Tơ Hồng cập nhật", "Giá cũ marry.vn", và chữ dự phòng "giá ước tính" / "giá đã xác minh" kể cả khi back cũ không trả `price_label`. Không để lại dấu "·" mồ côi (hai "·" liền nhau, hoặc "·" ngay sau giá/"giá đã cập nhật (…)" mà không còn gì phía sau).
H2. Giá vẫn hiện như cũ: số và đơn vị không đổi; venue có nguồn giá vẫn "4tr–4.6tr/bàn"; hạng mục khác không có "/bàn".
H3. Vẫn giữ: "giá đã cập nhật" ở hàng đã lưu khi giá hiện tại khác giá lúc lưu; câu "Bạn đã lưu lúc 10tr. Giá hiện tại trên Tơ Hồng: 12–14tr" (chỉ bỏ phần "· [nhãn]" cuối câu).
H4. Admin không đổi: bảng "Danh sách vendor" hiện cột Nhãn và ô chọn "Nhãn"; ngăn kéo enrich hiện "Nhãn giá: …".
H5. Dòng phép so T-167 dưới thanh "Ngân sách" của chi tiết vẫn in nguyên văn, kể cả tiền tố "Giá ước tính: " (ADR-099: đó là phép so, không phải nhãn nguồn). Giá ước tính vẫn không có chip "Trong ngân sách"/"Rẻ hơn …" (inv-003).
H6. API không đổi: `price_label`, `price_basis` vẫn trả như cũ (inv-002). Việc này không chạm `tohong-back` hay `tohong`.

### Bỏ nhãn làm câu nào trở nên sai hoặc khó hiểu
- `Budget.jsx:223` sau khi bỏ nhãn kết thúc bằng "… 12–14tr ·" nếu chỉ xoá `PriceTag`: phải bỏ cả dấu "·" (H1). Tương tự `Vendors.jsx:45-46`, `Budget.jsx:442-443` (xoá cả " · " đứng trước nhãn).
- "giá đã cập nhật" mất phần giải thích nguồn ("Giá do Tơ Hồng cập nhật"): vẫn đọc được, không sai.
- Với hạng mục gói (ảnh, MC, makeup…) giá ước tính sẽ không còn dấu nào cho cặp đôi biết là giá đoán (dòng "Giá ước tính:" của T-167 chỉ có ở venue). Đây là rủi ro Chief đã nêu và Capu đã chấp nhận (ADR-099); spec không bù bằng chữ khác.
- Lời AI (`whyThoseVendors`, `whyThisVendor`, chat) do back/LLM sinh. Front không chạm. Dòng ngữ cảnh gửi cho AI còn có "(giá ước tính)"/"(giá đã xác minh)" (eval T-136 `check_a2_hien_thi_theo_pool.mjs:7,21`), nên lời AI vẫn có thể nhắc cụm này. Chưa kiểm đầu ra thật (GIẢ ĐỊNH, tự tin ~60%); xem "Câu hỏi mở".

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-170-bo-nhan-nguon-gia` · Vùng: `planner/vendor/images`.
- Bất biến đã đọc: `eval/invariants/_shared/` + `planner/` + `planner/vendor/` + `planner/vendor/images/` + `planner/front/` (mọi nhóm). Spec không vi phạm: inv-002 (đo API; không đổi), inv-003 (không chip ngân sách cho giá ước tính; giữ), `planner/front/vendor-images` inv-006 (ghi công ảnh vẫn ở mọi bề mặt; không đụng), `planner/front/layout` (không tràn ngang: bỏ chữ chỉ làm hẹp). Không đề nghị đổi bất biến nào.
- Eval cũ lỗi thời: xem bảng "Eval cũ lỗi thời" ở handoff; không sửa eval cũ.
- Không chạm: admin (`src/admin/**`), back, `tohong` (orchestrator), payment, auth, DB, dữ liệu người dùng.
- Cách xoá (không bắt buộc, Engineering tự chọn): `PriceTag.jsx` không còn nơi nào dùng ở admin (admin dùng `Badge`); xoá file hay để lại đều được, miễn không còn render ở app cặp đôi.
- Bậc A: chỉ UI, eval Playwright phủ cả 6 tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (mặc định repo front `../tohong-front`, đặt `TOHONG_FRONT_REPO` nếu khác). Xanh/đỏ trên main `0221a5c`: 1, 2, 3, 5 đỏ (nhãn còn); 4, 6 xanh và phải giữ xanh.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Thẻ chat danh sách (#1) và chi tiết (#2): giá còn (venue "…/bàn"), không còn chữ nhãn nguồn giá nào ở 5 vendor thử (3 nhãn mới + 2 kiểu back cũ không `price_label`), không "·" mồ côi | `node eval/T-170/check_1_chat_danh_sach_va_chi_tiet.cjs` |
| 2 | Luồng so sánh: thẻ chọn (#3) và bảng so sánh (#4): giá còn, không nhãn | `node eval/T-170/check_2_chon_so_sanh_va_bang_so_sanh.cjs` |
| 3 | Danh sách đã lưu (#5,#6) và Ngân sách (#7-#10): giá còn (venue "/bàn"), "giá đã cập nhật" và câu "Bạn đã lưu lúc 10tr. Giá hiện tại trên Tơ Hồng: 12–14tr" còn, không nhãn, không "·" treo | `node eval/T-170/check_3_da_luu_va_man_ngan_sach.cjs` |
| 4 | Admin vẫn hiện nhãn (cột Nhãn, ô chọn Nhãn, "Nhãn giá: …" ở ngăn kéo) | `bash eval/T-170/check_4_admin_van_nhan.sh` |
| 5 | Chi tiết venue ước tính: dòng phép so T-167 (kể cả "Giá ước tính: ") in nguyên văn đúng một lần; ngoài dòng đó không còn chữ nhãn; không chip "Trong ngân sách"/"Rẻ hơn" ở danh sách và chi tiết | `node eval/T-170/check_5_giu_dong_phep_so_va_khong_chip.cjs` |
| 6 | API vẫn trả `price_label` + `price_basis` hợp lệ ở mọi bề mặt (inv-002) | `python3 -I eval/invariants/planner/vendor/inv-002-gia-hien-ra-luon-co-nhan.py` |

Kiểm chứng của Spec Writer: cả 4 eval Playwright (1, 2, 3, 5) đỏ trên main, và xanh trên một bản sao của front trong thư mục tạm đã tắt `PriceTag` + bỏ dấu "·" đi kèm (chứng tỏ spec làm được và eval không đòi thừa). Eval 4 và 6 xanh trên main. Chạy thêm `node eval/T-167/check_4_dong_front.cjs` sau cài (xanh trên bản sao).

## Bất biến đề xuất (tầng 2)
Không đề xuất bất biến mới ở tầng chạy mãi: "app cặp đôi không hiện nhãn nguồn giá" là quyết định của Capu và có thể đảo, nên chỉ là eval của việc. Có một việc cho Chief: `eval/invariants/planner/vendor/inv-002` chỉ đo API nên giữ nguyên; nhưng spec T-164 H4 (phần "mọi chỗ hiện giá đều có nhãn trên màn app cặp đôi") bị đảo, nên ADR-099 nên ghi rõ H4 chỉ còn đúng cho admin và API.

## Không làm
- Không đổi API/back/pool/overlay/`price_label`/`price_basis`; không đổi cách tính giá, điểm, thứ tự.
- Không bỏ tiền tố "Giá ước tính: " của dòng phép so T-167 (cần quyết định riêng của Capu).
- Không sửa admin; không thêm chữ thay thế nhãn (kể cả icon, tooltip, "~") ở app cặp đôi.
- Không sửa lời AI/prompt ở back.
- Không sửa hay xoá eval cũ (Chief ghi ADR).

## Câu hỏi mở
Lời AI trong chat (và prompt gửi AI có "(giá ước tính)") vẫn có thể nói "giá ước tính" bằng chữ; Capu có muốn bỏ cả cụm này khỏi lời AI (việc riêng ở back) hay giữ vì đó là văn nói, không phải nhãn nguồn giá không?
