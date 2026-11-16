# Spec T-194: Màn Ngân sách đọc số phân bổ rỗng/không phải số như 0

> v1 · Spec Writer (product) · 2026-11-16 · bậc A · vùng `planner/front/budget` · chỉ `tohong-front` (main `6b9ad94`) · khuôn số theo INV-008.

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
H0. Quy tắc một số: số phân bổ (allocated_tr) của một hạng mục là số của nó nếu là số hữu hạn hoặc chuỗi số ("20", "3.4"); rỗng ("", null, bỏ khuyết) hoặc không phải số ("abc") thì là 0. Giống thẻ ngân sách chat.
H1. Tổng quan: "Đã phân bổ" = tổng số theo H0 của mọi hạng mục (phép cộng số, không nối chuỗi); câu trạng thái "Còn X" / "Vượt X" / "Cân đối" theo tổng đó và mục tiêu. Mọi số theo khuôn INV-008 (dấu phẩy, tối đa 1 chữ số lẻ).
H2. Hàng hạng mục ở tổng quan ghi số theo H0 ("0tr" cho hạng mục rỗng/lạ). Trang chi tiết hạng mục: thẻ "Dự toán" ghi số theo H0, thanh trượt "Dự toán" có giá trị 0 (aria-valuenow = 0), phần phần trăm và chữ đọc của thanh trượt không "NaN".
H3. Không chỗ nào trên màn Ngân sách (tổng quan, trang hạng mục) còn "tr" đứng riêng (không có số đi trước), "abc", "undefined", "NaN", "null".
H4. Cùng số với thẻ ngân sách chat: với cùng một dự toán, số mỗi hạng mục ở màn Ngân sách bằng số ở thẻ chat, và "Đã phân bổ" bằng tổng các hàng của thẻ chat.
H5. Chỗ ghi lại dự toán: khi người dùng chỉnh một hạng mục, bản gửi lên server có allocated_tr của MỌI hạng mục là số JSON hữu hạn: hạng mục rỗng/lạ gửi 0 (không "", "abc", null, bỏ khuyết), chuỗi số gửi dạng số, hạng mục vừa chỉnh gửi số mới. Chỉ mở màn, không chỉnh gì: vẫn không ghi (INV-003).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-194-so-phan-bo-rong` · Vùng: `planner/front/budget`. Chỉ đổi cách màn đọc và ghi số; không đổi API, back, mục con (`items[].amt`), admin.
- Bất biến đã đọc: `_shared/`, `planner/front/` (budget inv-001..010). Không vi phạm; H5 giữ INV-003, INV-005.
- Không chạm payment, auth, schema, dữ liệu người dùng. Bậc A: chữ hiển thị, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (`--repo <tohong-front>` hoặc `TOHONG_FRONT_REPO`; mọi eval nhận `--repo`, khác check_5b của T-164 cần `--repo` khi gate chạy), khung `eval/T-187/_lib.cjs` + Playwright. Dự toán giả trộn: "", "abc", 30, "20", null.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | "Đã phân bổ 50tr / 100tr", "Còn 50tr"; mục tiêu 40 -> "Vượt 10tr"; mục tiêu 50 -> "Cân đối"; không "tr" trơ, "abc", NaN | `node eval/T-194/check_1_tong_phan_bo_con_lai_vuot.cjs` |
| 2 | Hàng tổng quan "0tr","0tr","30tr","20tr","0tr"; trang hạng mục "abc": "DỰ TOÁN 0tr", thanh trượt 0, không NaN/"tr" trơ | `node eval/T-194/check_2_hang_hang_muc_va_trang_hang_muc.cjs` |
| 3 | Mỗi hạng mục cùng số ở màn Ngân sách và thẻ chat; "Đã phân bổ" = tổng hàng thẻ chat | `node eval/T-194/check_3_cung_so_voi_the_chat.cjs` |
| 4 | Bản gửi lên sau khi chỉnh: mọi allocated_tr là số hữu hạn (0,0,31,20,0); chỉ xem thì 0 lần ghi | `node eval/T-194/check_4_ghi_lai_du_toan_khong_ghi_abc.cjs` |
| 5 | Dữ liệu hợp lệ không đổi chữ: 20, 60, 3.4, 12.34, 0 -> "Đã phân bổ 95,7tr / 120,5tr", "Còn 24,8tr", hàng "3,4tr", "12,3tr", "0tr" | `node eval/T-194/check_5_du_lieu_hop_le_khong_doi.cjs` |

Trên main `6b9ad94`: eval 1-4 ĐỎ đúng chỗ lỗi; eval 5 XANH (chỉ số bảo vệ). Đã thử xanh: bản vá giả ở worktree tạm (ép allocated_tr thành số ngay khi nhận dữ liệu) cho cả 5 PASS; worktree đã gỡ.

## Bất biến đề xuất (tầng 2)
Vùng `planner/front/budget`: màn Ngân sách với allocated_tr rỗng/không phải số không có "tr" trơ/NaN và tổng là phép cộng số (phần tổng quan của eval 1, hàng của eval 2). Dùng lại lib T-194 khi Spec critic rút.

## Không làm
Không đổi API/back, không đổi `items[].amt` (mục con), không đổi Dashboard hay Vendors, không sửa nhập số ở ô sửa.

## Câu hỏi mở
Không. Giả định ghi rõ: chuỗi số hợp lệ ("20") coi là số, và H5 yêu cầu gửi dạng số JSON (kể cả chuỗi số), tự tin ~80%.
