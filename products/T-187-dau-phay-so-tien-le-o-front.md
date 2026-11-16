# Spec T-187: Mọi số tiền lẻ cặp đôi thấy ở front dùng dấu phẩy

> v1 · Spec Writer (product) · 2026-11-16 · bậc A · vùng `planner/front/budget` · chỉ `tohong-front` (main `26c5758`) · nối tiếp T-167 (khuôn số), T-183/T-184 (ADR-113, ADR-114: chip và câu tư vấn của back đã dấu phẩy).

## Ý định
Capu 2026-11-16, trả lời câu mở của ADR-113/114: "có, đổi sang dấu phẩy luôn". Chip và dòng phép so (back) đã ghi "3,9tr/bàn"; thẻ vendor ngay bên cạnh vẫn ghi "4tr–4.6tr/bàn" và "Bạn đã lưu lúc 3.5tr". Cặp đôi thấy hai dấu thập phân trên cùng một màn. Sau việc này: một dấu duy nhất, dấu phẩy, ở mọi số tiền lẻ app cặp đôi tự định dạng.

## Bằng chứng
- `board/T-187.md` (lời Capu), `decisions/2026-11-16-adr-113-…md` ("khoảng giá vendor ở front giữ dấu chấm trong việc này; đề xuất Capu việc riêng"), `…adr-114-…md` ("còn mở: khoảng giá vendor ở front vẫn dấu chấm — chờ Capu").
- Khuôn số: `products/T-167-…md` H2 ("dấu phẩy thập phân, bỏ phần thập phân nếu là `.0`, KHÔNG có dấu phân cách hàng nghìn, không đổi sang tỷ"; làm tròn `Math.round(x*10)/10`).
- Quét `tohong-front` main `26c5758` (file:dòng ở mục "Danh mục chỗ phải đổi"): mã front có MỘT hàm định dạng chung (`src/ui/priceText.js:2-4`, in số thô `${min}tr`) cộng khoảng 25 chỗ in số thô `{x}tr`. Chỉ `Budget.jsx:496-498` (nút Tìm) và `src/budget/sigLabel.js:5` (nhãn "Theo dự toán …") đã dấu phẩy.
- Số thô còn gây lỗi nhìn thấy ngoài dấu: ở bản dựng giả của main, dự toán 12.34, 3.4, 60, 30 cho "Đã phân bổ 105.74000000000001tr", "Còn 14.759999999999991tr", "Vượt 1.1999999999999997tr", trang chủ "Vượt 5.239999999999995tr" (eval 3 chạy trên main đỏ đúng các chỗ này). Làm tròn 1 chữ số sửa luôn lỗi sai số dấu phẩy động. Tự tin cao (đo được).
- Bể bất biến: không bất biến nào của `planner/front/*` hay `_shared/` khoá dấu chấm ở front (đã đọc `budget/`, `layout/`, `loading/`, `navigation/`, `vendor-images/`; `budget/lib/budget_inv.cjs:128` và `nut_tim_inv.cjs:85` nhận cả `.` lẫn `,`; `budget_inv.cjs:115-116` chỉ gọi với số nguyên). `planner/vendor/matching/inv-007`, `inv-009` khoá dấu phẩy ở BACK, cùng chiều. Không đề nghị đổi bất biến nào.

## Giả thuyết
Nếu mọi số tiền lẻ ở app cặp đôi dùng cùng một khuôn dấu phẩy thì cặp đôi không còn thấy "3,9tr" cạnh "3.9tr" trên cùng một thẻ. Chỉ số bảo vệ: không con số nào đổi giá trị (chỉ đổi cách viết); điều kiện hiển thị và thứ tự (đã cập nhật, vượt/còn dư, rẻ nhất) vẫn tính trên số thật.

## Hành vi (người dùng thấy gì)

### H1 · Khuôn một số tiền (triệu đồng)
Với giá trị `x` là số hoặc chuỗi thập phân API trả ("12.34"):
- Chữ hiện ra = `Math.round(Number(x) × 10) / 10`, phần thập phân bằng dấu phẩy, bỏ ",0" khi nguyên: 4.6 -> `4,6`; 3.96 -> `4`; 4.25 -> `4,3` (đúng như back làm tròn ở chip); "12.34" -> `12,3`; 12 -> `12`; "14.0" -> `14`.
- Không phân cách hàng nghìn, không đổi sang tỷ: 1440 -> `1440tr`, 1404 -> `1404tr`.
- Số âm giữ dấu trừ như từng chỗ đang in (dấu "-" hoặc "−" của thanh trượt) rồi tới số đã làm tròn: -7,74 -> `-7,7tr`. Kết quả làm tròn bằng 0 thì ghi `0`, không `-0`.
- Giá trị thiếu (không có) hiện đúng như hôm nay (không thêm chữ "undefined", "NaN", "null" nào).
- Số thật không đổi: chữ chỉ là cách viết. Mọi điều kiện (giá đã cập nhật khi giá lúc lưu khác giá hiện tại; "Vượt"/"Còn dư"; vendor rẻ nhất; trạng thái Cân đối) vẫn tính trên số thật, không trên chữ đã làm tròn. Hệ quả chấp nhận: "giá đã cập nhật" vẫn hiện khi hai giá khác nhau chưa tới 0,05 dù chữ giống nhau; chênh lệch dưới 0,05 ghi `0tr`.

### H2 · Khoảng giá
- `priceText` (giá niêm yết ở thẻ danh sách, chi tiết, so sánh, đã lưu, Ngân sách): `{a}tr–{b}tr`, thêm `/bàn` cho nhà hàng có nguồn giá: "4tr–4,6tr", "4tr–4,6tr/bàn", "12tr–14tr".
- Khoảng chỉ ghi hai đầu khi hai CHỮ sau làm tròn khác nhau. Hai đầu cùng chữ (3,5 và 3,5; 4,2 và 4,24) ghi một số: "3,5tr", "4,2tr/bàn" (không "4,2tr–4,2tr").
- Câu "Bạn đã lưu lúc … Giá hiện tại trên Tơ Hồng: …" giữ đúng khuôn cũ, chỉ đổi số: "Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,2tr/bàn"; khoảng thì một chữ "tr" ở cuối: "Giá hiện tại trên Tơ Hồng: 4,3–4,8tr"; nguyên: "25–27tr". Cùng luật "hai đầu cùng chữ thì một số".

### H3 · Danh mục chỗ phải đổi (`tohong-front` main `26c5758`)
Mỗi dòng là một chỗ cặp đôi nhìn thấy số tiền. Eval 1-5 phủ từng nhóm.

Nhóm A, giá niêm yết qua `priceText` (định nghĩa `src/ui/priceText.js:2-4`):
- `src/screens/chat/VendorChatCards.jsx:431` thẻ danh sách chat; `:676` thẻ chi tiết; `:909` hàng ở thẻ chọn so sánh; `:1012` ô "Giá" của bảng so sánh.
- `src/screens/Vendors.jsx:42` danh sách đã lưu, giá lúc lưu; `:43` "giá đã cập nhật (…)".
- `src/screens/Budget.jsx:213` giá lớn ở sheet vendor; `:450` hàng vendor đã lưu ở hạng mục.

Nhóm B, câu "Bạn đã lưu lúc …" (khuôn riêng, không qua `priceText`): `Budget.jsx:221`.

Nhóm C, số in thô `{x}tr`:
- `VendorChatCards.jsx:161` "Budget ~{n}tr" (thẻ chọn danh mục); `:1122` câu tư vấn "({giá}tr) đáng cân nhắc nhất".
- `Vendors.jsx:84` số dự toán từng hạng mục (`Amount unit="tr"`); `:144`, `:147` "{đã chốt}tr / {tổng}tr đã chốt".
- `Budget.jsx`: `:61` khoản nhà hàng chỉ đọc; `:252` "Dự toán: {n}tr"; `:254` chênh lệch "+{n}tr"/"{n}tr"; `:369` "Dự toán" lớn; `:375` "Ngân sách cưới"; `:461` "Vượt {n}tr so với dự toán"/"Còn dư {n}tr"; `:496-498` nút "Tìm … trong khoảng {n}tr" (đã dấu phẩy, giữ đúng chữ, nên dùng chung hàm mới); `:631` "Vượt {n}tr"/"Còn {n}tr"; `:694` "{tổng}/{mục tiêu}tr"; `:696` "Đã chốt {n}tr"; `:724`, `:725` "Đã phân bổ"; `:735` "Đã chốt vendor"; `:747` "+{mừng}tr → thực ~{n}tr"; `:805` số dự toán từng hạng mục; `:817` giá vendor đã chốt ở hàng hạng mục.
- `src/screens/chat/cards.jsx:331` "Phân bổ {n}tr", `:334` "+{n}tr" tiền mừng.
- `src/ui/atoms.jsx:109` số hiển thị của `EditAmount` (nút bấm để sửa).
- `src/screens/Dashboard.jsx:295` "Ngân sách {n}tr", `:296` "Vượt {n}tr".
- `src/components/BaselineSlider.jsx:72`, `:73` chữ nổi "+{n}tr"/"−{n}tr" trên thanh trượt dự toán (giá trị ban đầu từ API có thể lẻ); `:135` "Ban đầu {n}tr"; `:189` `aria-valuetext` ("{n} triệu, …", người đọc màn hình nghe).

Không đổi (đã đúng, không phải số lẻ hay không phải số tiền của cặp đôi):
- `src/budget/sigLabel.js:5` nhãn "Theo dự toán {n}tr" đã đúng khuôn (T-179 check_10 khoá); được phép dùng chung hàm mới nếu chữ ra giống hệt.
- Chữ do back trả và front in nguyên văn: chip lý do, dòng phép so `budgetBasis.text`, câu AI, `BotMarkdown`. Front không viết lại chữ của back (T-167 H3).
- Ô nhập số (`atoms.jsx:64-80` ô gõ, `Budget.jsx:70`/`:85` ô số khoản): chỉ nhận số nguyên, đang sửa chứ không hiển thị.
- `src/screens/VendorFlowSheet.jsx:222`, `:224` ("235tr / 500tr" mẫu cố định minh hoạ cách hoạt động, số nguyên); `src/screens/Onboarding.jsx:21-22`, `:625` (lựa chọn ngân sách nguyên và "1 tỷ+"); `src/screens/chat/paywall.jsx:16` (giá gói bằng đồng, phân cách nghìn của tiền đồng); `src/journey.js` (số đo cho analytics, không hiện); `src/budget/useBudget.js:43-44` (`fmtTr`, `fmtFull` không ai gọi, mã chết: Engineering được xoá hoặc thay bằng hàm mới).

Nhóm D, trang admin (cặp đôi không thấy): `src/admin/EnrichTable.jsx:44-48`, `src/admin/VendorData.jsx:24-26` (dùng ở `:93`, `:238`), `src/admin/format.js:22`, `src/admin/Members.jsx:53`. QUYẾT ĐỊNH: GIỮ NGUYÊN dấu chấm (đề xuất Chief; Capu nêu "cặp đôi"). Lý do: admin là công cụ nội bộ đọc số thô của pool ("3.9–4.7tr/bàn", T-164 check_5b khoá); đổi thì đổi cả cách admin đối chiếu với dữ liệu pool và API; lệch dấu giữa admin và cặp đôi không gây nhầm cho ai. Nếu Capu muốn admin dấu phẩy thì là việc riêng và phải sửa T-164 check_5b.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-187-dau-phay-front` · Vùng: `planner/front/budget` · Không đổi back, API, dữ liệu, `localStorage`, số gửi lên API (chỉ đổi cách in).
- Bất biến đã đọc: `_shared/` và `planner/front/` (`budget/` inv-001..007, `layout/`, `loading/`, `navigation/`, `vendor-images/`), `planner/vendor/` inv-001..006 và `matching/` inv-001..010. Spec không vi phạm bất biến nào; inv-001..007 của `budget/` đo số ở màn Ngân sách bằng regex nhận cả hai dấu và số nguyên, sẽ chạy lại ở Code Gate.
- Đã có thể dùng chung một hàm định dạng (tên tuỳ Engineering); eval chỉ đo chữ nhìn thấy, không gọi hàm.
- Không chạm: payment, auth, schema, dữ liệu người dùng, dịch vụ trả phí. Chữ do back trả giữ nguyên văn.
- Bậc A: chỉ đổi chữ hiển thị ở front; eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (biến `TOHONG_FRONT_REPO`, mặc định `../tohong-front`; `PLAYWRIGHT_PATH`). Khung: vite dev + Playwright + API giả, dùng khung của `eval/T-170/_lib.cjs` (xem `eval/T-187/_lib.cjs`); số mong đợi tính độc lập trong eval từ giá trị gốc. Đỏ trên main là đúng (main còn dấu chấm).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Giá niêm yết ở khung chat vendor theo khuôn H1-H2: danh sách ("4tr–4,6tr", "3,5tr", "12tr–14tr", "4tr–4,3tr" từ 3,96–4,25), nhà hàng ("4tr–4,6tr/bàn", "3,9tr/bàn", "4,2tr/bàn"), chi tiết, thẻ chọn và bảng so sánh, câu "… (3,5tr) đáng cân nhắc nhất", "Budget ~12,3tr"; không còn "d.dtr" | `node eval/T-187/check_1_gia_niem_yet_o_chat.cjs` |
| 2 | Vendor đã lưu: "giá đã cập nhật (4,3tr–4,8tr)", hàng Ngân sách, câu "Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,2tr/bàn" (hai đầu cùng chữ một số), "4,3–4,8tr", "25–27tr"; không "·" treo | `node eval/T-187/check_2_da_luu_va_cau_ban_da_luu.cjs` |
| 3 | Số tiền ở màn Ngân sách (tổng quan, hạng mục, sheet), "Vendor đã lưu", thẻ ngân sách chat, trang chủ, thanh trượt (chữ nổi và `aria-valuetext`): dấu phẩy, 1 chữ số, không sai số dấu phẩy động ("Vượt 1,2tr so với dự toán", "Còn 14,8tr", "Đã chốt vendor 4,3tr", "+2,3tr") | `node eval/T-187/check_3_so_tien_du_toan_chenh_lech_tong.cjs` |
| 4 | Đầu vào là chuỗi "12.34", "3.5", "4.24", "14.0" (API/Postgres numeric) đọc đúng như số: "12,3tr", "3,5tr", "14tr"; không "NaN"/"undefined"/nối chuỗi | `node eval/T-187/check_4_dau_vao_chuoi_tu_api.cjs` |
| 5 | Số nguyên không ",0"; số lớn không phân cách nghìn ("1440tr", "1404tr" nhà hàng chốt 3,9 x 360 bàn); trang admin GIỮ dấu chấm (T-164 check_5b PASS cùng repo) | `node eval/T-187/check_5_so_nguyen_so_lon_va_admin_giu_nguyen.cjs` |
| 6 | Không phá hành vi cũ: mọi eval front của T-179 (check_1..11), T-182 (adv-01..06), T-185 (check_1..8), cộng T-167 check_4 và T-178 check_4 (chữ back in nguyên văn) vẫn PASS | `bash eval/T-187/check_6_hoi_quy_t179_t182_t185.sh` |

Mỗi tiêu chí đúng một eval. Cả sáu là tầng 1.

## Eval và bất biến cũ lỗi thời sau khi ship
Không bất biến nào lỗi thời (không bất biến nào khoá dấu chấm ở front: xem "Bằng chứng"), nên KHÔNG có bản thay cho Chief. Các eval tầng 1 của việc cũ khoá dấu chấm ở front và sẽ đỏ nếu chạy lại (đã đo trên bản cài giả; không nằm trong bể, không chạy ở Code Gate T-187):
- `eval/T-164/check_5a_nhan_app_cap_doi.cjs:111,115` ("4tr–4.6tr/bàn").
- `eval/T-170/check_1_chat_danh_sach_va_chi_tiet.cjs:32,37` ("4tr–4.6tr/bàn"); `check_5_giu_dong_phep_so_va_khong_chip.cjs:14` (giá "3.9tr" của Sigma); `check_3_da_luu_va_man_ngan_sach.cjs:48` (regex `[\d.]+tr/bàn` không nhận dấu phẩy).
- `eval/T-175/adv-03-venue-thieu-nguon-thieu-khach.cjs:20,40,41` ("4.2tr/bàn", "Bạn đã lưu lúc 3.5tr. Giá hiện tại trên Tơ Hồng: 4.2tr/bàn").
- Test đơn vị trong repo front: `scripts/test-price-text.mjs:7,13` (`'4tr–4.6tr'`, `'4tr–4.6tr/bàn'`; lệnh `npm run test:price-text`). Engineering sửa cùng PR; thêm ca "hai đầu cùng chữ một số" và chuỗi "12.34".
Xanh và phải còn xanh: T-164 check_5b (admin dấu chấm), T-170 check_2, check_3 (phần số nguyên), T-175 adv-01, adv-02, adv-04, T-178 check_4 (chữ back nguyên văn có dấu chấm), T-179, T-182, T-185.

## Bất biến đề xuất (tầng 2)
INV (vùng `planner/front/budget`): mọi số tiền (triệu đồng) lẻ mà app cặp đôi tự định dạng dùng dấu phẩy, tối đa 1 chữ số thập phân, không ",0", không "d.dtr", không số thập phân dài, không phân cách nghìn. Nội dung = phần "không dấu chấm / không số thập phân dài" của eval 1, 2, 3 (`S.noDot`). Spec-critic rút khi spec qua cổng. Không đề nghị đổi hay xoá bất biến hiện có.

## Không làm
- Không đổi back, API, dữ liệu, số gửi lên server, thứ tự, điều kiện hiển thị, điểm.
- Không đổi trang admin (quyết định giữ, xem nhóm D).
- Không viết lại chữ back trả (chip, dòng phép so, câu AI, markdown).
- Không đổi định dạng tiền đồng (`paywall.jsx`, `admin/format.js:22`), không thêm phân cách nghìn hay đơn vị tỷ.
- Không sửa eval/bất biến cũ cho khớp code: các eval cũ lỗi thời ở trên do Chief quyết có thay hay không.

## Câu hỏi mở
Không. (Giả định ghi rõ: "cặp đôi không thấy thì ngoài phạm vi" áp cho trang admin; nếu Capu muốn admin dấu phẩy, đó là việc riêng, bậc A.)
