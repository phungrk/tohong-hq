# Spec T-194: Màn Ngân sách đọc số phân bổ rỗng/không phải số như 0

> v3 (rework lần 2: H5(i) thêm ngoại lệ Tuần trăng mật rút Dự phòng, defect T-194-D2) · v2 (rework lần 1: H0, H3, H5, D1) · Spec Writer (product) · 2026-11-16 · bậc A · vùng `planner/front/budget` · chỉ `tohong-front` (main `6b9ad94`) · khuôn số theo INV-008.

## Ý định
Màn Ngân sách không bao giờ ghi "ĐÃ PHÂN BỔ tr", "Còn tr" hay một hàng chỉ "tr"; hai nơi (màn Ngân sách, thẻ ngân sách chat) cùng một số. Nguồn: brief `board/T-194.md` (adversary T-193).

## Bằng chứng
- Đo trên main `6b9ad94` (5 eval trong `eval/T-194/`): allocated_tr "abc" cho "ĐÃ PHÂN BỔ tr / 100tr", "Còn tr", hàng "Tiệc & nhà hàng tr"; trang hạng mục ghi "DỰ TOÁN tr", "Ban đầu NaN%", thanh trượt aria-valuenow "abc". Tự tin cao (đo được).
- Đo thêm, ngoài brief: chuỗi SỐ hợp lệ ("20", "3.4") cũng làm tổng thành chuỗi nối ("Đã phân bổ tr"). Cùng nguyên nhân (tổng cộng không ép số), nên gộp vào spec. Chuỗi rỗng "" một mình hiện "0tr" đúng (adversary đã đo), nhưng "" vẫn gửi nguyên "" khi ghi lại.
- Luồng ghi: sửa một hạng mục gửi lại allocated_tr của MỌI hạng mục nguyên văn ("", "abc", "20", bỏ khuyết).
- Thẻ chat đã coi rỗng/không phải số là 0 (ADR-120, `eval/T-193/adv-01`). Bể: inv-001..010 không mâu thuẫn; ADR-119/120 liên quan, không đổi.

## Giả thuyết
GIẢ ĐỊNH, tự tin ~85%: dữ liệu lệch như vậy hiếm nhưng khi có thì màn hỏng cả trang; sửa không đổi gì với dữ liệu hợp lệ. Chỉ số bảo vệ: chữ của dữ liệu hợp lệ không đổi (eval 5).

## Hành vi (người dùng thấy gì)
H0. Quy tắc một số, chỉ để HIỂN THỊ và TÍNH TỔNG trên màn: số của một hạng mục = `Number(x) || 0`, đúng y cách thẻ ngân sách chat đọc (`cards.jsx:331`), để hai nơi cùng số. Nên "20" -> 20, "3.4" -> 3,4, " 7 " -> 7; rỗng, null, bỏ khuyết, "abc", "20,5" (dấu phẩy), "20tr" -> 0. Ngoài phạm vi, không đo: giá trị Infinity.
H1. Tổng quan: "Đã phân bổ" = tổng số theo H0 của mọi hạng mục (phép cộng số, không nối chuỗi); câu trạng thái "Còn X" / "Vượt X" / "Cân đối" theo tổng đó và mục tiêu. Mọi số theo khuôn INV-008 (dấu phẩy, tối đa 1 chữ số lẻ).
H2. Hàng hạng mục ở tổng quan ghi số theo H0 ("0tr" cho hạng mục rỗng/lạ). Trang chi tiết hạng mục: thẻ "Dự toán" ghi số theo H0, thanh trượt "Dự toán" có giá trị 0 (aria-valuenow = 0), phần phần trăm và chữ đọc của thanh trượt không "NaN".
H3. Khi allocated_tr rỗng hoặc lạ (mục con hợp lệ), không chỗ nào trên màn Ngân sách (tổng quan, trang hạng mục) còn "tr" đứng riêng (không có số đi trước), "abc", "undefined", "NaN", "null".
H4. Cùng số với thẻ ngân sách chat: với cùng một dự toán, số mỗi hạng mục ở màn Ngân sách bằng số ở thẻ chat, và "Đã phân bổ" bằng tổng các hàng của thẻ chat.
H5 (đã thu hẹp). Dữ liệu đã lưu KHÔNG bị ép: H0 chỉ áp cho hiển thị và tổng. Khi ghi, chỉ hạng mục người dùng vừa chỉnh gửi số mới (số JSON); MỌI hạng mục khác ghi đúng như đã lưu (kể cả "abc", "20", "", bỏ khuyết), ở mọi lối ghi: (i) chỉnh tay. Ngoại lệ có sẵn: chỉnh Tuần trăng mật rút phần chênh từ Dự phòng (`useBudget.js:174-184`); khi đó Dự phòng được coi là hạng mục vừa đổi do luật này: đọc theo H0 rồi rút, gửi số JSON (50 -> 49, "20" -> 19, "abc" -> 0 khi rút 1; không âm, giữ cách kẹp hiện có của code). Mọi hạng mục khác vẫn ghi nguyên như đã lưu; (ii) lần ghi tự động khi nhà hàng đã chốt và số khách đổi (INV-003 cho phép đổi amt khoản vendor trùng id đang chốt; Budget.jsx:595-602), ngoài amt đó không trường nào đổi; (iii) ghi lại sau lỗi (INV-005): hạng mục chưa chỉnh không được coi là đã đổi chỉ vì màn đọc nó thành số, nên giá trị server đã đổi bởi lần ghi khác (vd thẻ chat sửa Tiệc thành 50) được giữ. Chỉ mở màn, không chỉnh gì, chưa chốt nhà hàng: 0 lần ghi (INV-003). Không sửa INV-003/INV-005, không cần ADR.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-194-so-phan-bo-rong` · Vùng: `planner/front/budget`. Chỉ đổi cách màn đọc số để hiển thị; ghi không ép dữ liệu đã lưu (H5); không đổi API, back, mục con (`items[].amt`), admin.
- Bất biến đã đọc: `_shared/`, `planner/front/` (budget inv-001..010). Không vi phạm; H5 giữ INV-003, INV-005 nguyên văn.
- Không chạm payment, auth, schema, dữ liệu người dùng. Bậc A: chữ hiển thị, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (`--repo <tohong-front>` hoặc `TOHONG_FRONT_REPO`; mọi eval nhận `--repo`, khác check_5b của T-164 cần `--repo` khi gate chạy), khung `eval/T-187/_lib.cjs` + Playwright. Dự toán giả trộn: "", "abc", 30, "20", null.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | "Đã phân bổ 50tr / 100tr", "Còn 50tr"; mục tiêu 40 -> "Vượt 10tr"; mục tiêu 50 -> "Cân đối"; không "tr" trơ, "abc", NaN | `node eval/T-194/check_1_tong_phan_bo_con_lai_vuot.cjs` |
| 2 | Hàng tổng quan "0tr","0tr","30tr","20tr","0tr"; trang hạng mục "abc": "DỰ TOÁN 0tr", thanh trượt 0, không NaN/"tr" trơ | `node eval/T-194/check_2_hang_hang_muc_va_trang_hang_muc.cjs` |
| 3 | Mỗi hạng mục cùng số ở màn Ngân sách và thẻ chat; "Đã phân bổ" = tổng hàng thẻ chat; thêm ca cách đọc số "20,5", " 7 ", "20tr", "3.4", "" -> 0, 7, 0, 3,4, 0 ở cả hai nơi | `node eval/T-194/check_3_cung_so_voi_the_chat.cjs` |
| 4 | Ghi không ép dữ liệu đã lưu: (a) chỉ xem 0 lần ghi; (b) chỉnh tay jewelry 31 (số), hạng mục khác nguyên "", "abc", "20", bỏ khuyết; (c) nhà hàng đã chốt + số khách đổi: có lần ghi tự động, vẫn "abc", "", "20", 30, bỏ khuyết; (d) ghi lại sau lỗi: Tiệc "abc" giữ, photography 50 do lần ghi khác không bị đè; (e) chỉnh Tuần trăng mật +1 với Dự phòng 50 / "20" / "abc" -> gửi 49 / 19 / 0 (số JSON), hạng mục khác nguyên | `node eval/T-194/check_4_ghi_lai_du_toan_khong_ghi_abc.cjs` |
| 5 | Dữ liệu hợp lệ không đổi chữ: 20, 60, 3.4, 12.34, 0 -> "Đã phân bổ 95,7tr / 120,5tr", "Còn 24,8tr", hàng "3,4tr", "12,3tr", "0tr" | `node eval/T-194/check_5_du_lieu_hop_le_khong_doi.cjs` |

Trên main `6b9ad94`: eval 1-3 ĐỎ đúng chỗ lỗi; eval 4 và 5 XANH (chỉ số bảo vệ). Đã thử: bản vá giả ép allocated_tr thành số ở lối ghi (clone tạm) làm eval 4 ĐỎ ở ca b, c, d; clone đã gỡ. Bản v1 của bản vá giả (ép ngay khi nhận dữ liệu) qua cả 5 eval v1 chính là lỗ hổng defect D1 chỉ ra; eval 4 v2 bịt nó.

## Bất biến đề xuất (tầng 2)
Vùng `planner/front/budget`: màn Ngân sách với allocated_tr rỗng/không phải số không có "tr" trơ/NaN và tổng là phép cộng số (phần tổng quan của eval 1, hàng của eval 2). Dùng lại lib T-194 khi Spec critic rút.

## Không làm
Không đổi API/back, không đổi `items[].amt` (mục con; amt "abc" ở trang hạng mục là việc riêng Chief sẽ mở nếu cần; ngoài phạm vi, không đo), không đổi Dashboard hay Vendors, không sửa nhập số ở ô sửa.

## Câu hỏi mở
Không. Giả định ghi rõ: chuỗi số hợp lệ ("20") coi là số, chuỗi số theo `Number(x) || 0` như thẻ chat (ADR-120), tự tin cao. Ghi: chỉ hạng mục vừa chỉnh gửi số mới.

## Đã sửa gì ở v2 (spec rework lần 1)
- H5: câu "MỌI hạng mục là số JSON" cho phép ba cách cài khác nhau (D1, `against` INV-003 + H5); nay chỉ hạng mục vừa chỉnh gửi số mới, còn lại ghi nguyên như đã lưu, ở ba lối ghi. Câu cũ "mở màn vẫn không ghi" sửa: chỉ đúng khi chưa chốt nhà hàng.
- H0: bỏ "hữu hạn", chốt `Number(x) || 0` như thẻ chat; thêm ca "20,5", " 7 ", "20tr" vào eval 3.
- H3: viết hẹp "khi allocated_tr rỗng hoặc lạ (mục con hợp lệ)".

## Đã sửa gì ở v3 (spec rework lần 2)
- H5(i): câu "mọi hạng mục khác ghi nguyên" mâu thuẫn luật có sẵn chỉnh Tuần trăng mật rút từ Dự phòng (D2); thêm ngoại lệ theo cách (c) Chief chọn. Chỉ đổi đúng điểm này; thêm ca e vào eval 4.
