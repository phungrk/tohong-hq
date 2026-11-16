# Spec T-183: Dọn ba nợ nhỏ (dấu phẩy ở chữ do back sinh, bỏ mã chết scoreEpoch, sửa chữ spec T-179)

> v1 · Spec Writer (product) · 2026-11-16 · bậc A · vùng `planner/vendor/matching` · chạm `tohong-back` (`lib/vendorMatcher.js`) và `tohong-front` (mã chết); không đổi điểm, thứ tự, prompt AI, JSON.

## Ý định
Capu 2026-11-16: "Hãy xử lý luôn các nợ nhỏ" (ADR-108, ADR-109, ADR-112). Ba nợ: (1) số tiền lẻ trong chip lý do còn dấu chấm ("3.9tr") trong khi dòng phép so `budgetBasis.text` và nhãn front dùng dấu phẩy ("3,9tr", khuôn T-167); (2) mã chết `scoreEpoch` ở front sau T-182; (3) spec T-179 còn hai câu trái H1 M3.

## Bằng chứng
- `tohong-back` main `2d1a76c`, `lib/vendorMatcher.js`: `fmtTr` (dòng 71) ra dấu chấm, dùng cho chip (144) và `budgetText` (219); `fmtVi` (86) ra dấu phẩy, dùng cho `budgetBasis.text`. `budgetText` (219) và `giá dao động` (254, 257) còn in số thô (`${catBudget}`, `${pMin}`, `${pMax}`).
- `tohong-front` main `bb5781f`: `src/scoreEpoch.js` chỉ còn được nhập ở `src/api.js:7` (bump ở 95, 142) và `src/App.jsx:28, 377`; `useScoreEpoch` không còn nơi dùng (grep toàn `src`, `scripts`); `knownBudgetSig` (`api.js:84, 133-141`) chỉ nuôi lệnh bump; `scripts/test-score-epoch.mjs` thử đúng `scoreEpoch.js`, hai test còn lại trong lệnh `test:score-epoch` (`test-merge-budget.mjs`, `test-saved-budget-sig.mjs`) thử mã SỐNG (`mergeBudget.js`, `sigLabel.js`).
- Tự kiểm bằng bản cài giả: back (5 chỗ sửa trong `vendorMatcher.js`) và front (xoá mã chết) đặt ở thư mục tạm; eval 1, 2, 4, 5 đỏ trên main, xanh trên bản giả; hàng rào eval 3 xanh cả hai. Mọi bất biến `planner/vendor` khác (inv-001, 002, 003, 006; matching inv-001..005) xanh trên bản giả.

## Giả thuyết
Cặp đôi thấy một khuôn số duy nhất ("3,9tr", "128,7tr") ở chip, dòng phép so và câu tư vấn; không còn chỗ chip ghi "3.9" cạnh dòng phép so ghi "3,9". Chỉ số bảo vệ: điểm, thứ tự, số trong JSON, dòng "Theo số bàn" gửi AI, hành vi front (eval T-179/T-182) không đổi. GIẢ ĐỊNH, tự tin ~85%: người dùng Việt đọc dấu phẩy là dấu thập phân tự nhiên hơn dấu chấm.

## Hành vi (người dùng thấy gì)

### H1 · Chữ số tiền lẻ do back sinh dùng dấu phẩy
Khuôn số tiền của mọi chữ người dùng thấy do back sinh trong `lib/vendorMatcher.js`: làm tròn MỘT chữ số thập phân, dấu phẩy, bỏ phần `,0`, không phân cách hàng nghìn (đúng `budgetBasis.text` của T-167: 3,9; 4,25 -> 4,3; 128,7; 85; 4500). Áp cho đủ năm chỗ:
1. **Chip theo bàn** (`match.reasons[].label`, danh sách và chi tiết): `≈ 3,9tr/bàn × 20 bàn = 78tr`; `≈ 3,9tr/bàn × 33 bàn = 128,7tr`; `≈ 4,3tr/bàn × 20 bàn = 85tr` (giá 4,25). Ba số vẫn đúng ba số của `budgetBasis` (`pricePerTableTr`, `tables`, `totalTr`, tổng tính từ giá chưa làm tròn).
2. **`match.whyThisVendor` mặc định** (không gu): tự chứa chip ở mục 1, nên theo cùng dấu phẩy. Không còn số tiền dấu chấm trong câu.
3. **Câu dưới danh sách `whyThoseVendors`, vế ngân sách**: `Với khoảng {ngân sách hạng mục}tr cho …` và `(≈ {ngân sách/số bàn}tr/bàn × N bàn)` theo cùng khuôn (ngân sách hạng mục 139,5 -> `139,5tr`; 139,5/30 -> `4,7tr/bàn` theo cùng phép làm tròn). Hôm nay vế này in số thô.
4. **Câu `whyThoseVendors`, vế `giá dao động {min}–{max}tr[/bàn]`**: min, max theo cùng khuôn (3,9 và 4,25 -> `giá dao động 3,9–4,3tr/bàn`). Điều kiện hiện vế này (min khác max, tính trên số thô) giữ nguyên.
5. `budgetBasis.text` đã dùng dấu phẩy: không đổi.

**Không đổi (đúng nguyên văn hôm nay):** số nguyên (`≈ 3tr/bàn × 20 bàn = 60tr`, `(≈ 5tr/bàn × 30 bàn)`, `giá dao động 4–9tr/bàn`); chip `Rẻ hơn Ntr` (N nguyên) và `Trong ngân sách`; chữ KHÔNG phải tiền giữ dấu chấm (`Đánh giá cao (4.9★)`, `Còn lịch 20.3`); điều kiện hiện chip, điểm, thứ tự; số trong JSON (`pricePerTableTr`, `totalTr`, `categoryBudgetTr`) là số đầy đủ.

### H2 · Dòng "Theo số bàn" gửi AI: GIỮ NGUYÊN (dấu chấm)
`lib/matchFormatter.js:118` (`   Theo số bàn: ≈ 4.6tr/bàn × 30 bàn`) là chữ cho AI đọc, không phải chữ cặp đôi thấy; đổi nó là đổi prompt (rủi ro với `planner/vendor/inv-006`, `eval/T-178/check_3` khoá đúng dòng này). AI tự viết câu trả lời nên không do spec này quyết. Prompt `api/vendors.js:67` (`giá {priceMin}–{priceMax}tr` cho câu AI "vì sao hợp") cũng giữ.

### H3 · Front: bỏ mã chết scoreEpoch, không đổi hành vi
Sau thay đổi, trong `tohong-front` (không tính `node_modules`, `dist`) không còn: file `src/scoreEpoch.js` và `scripts/test-score-epoch.mjs`; mọi tham chiếu `scoreEpoch`, `bumpScoreEpoch`, `useScoreEpoch`, `profilePatchTouchesScore`, `budgetScoreSig`, `knownBudgetSig`; tên lệnh npm `test:score-epoch`. Hai test sống (`scripts/test-merge-budget.mjs`, `scripts/test-saved-budget-sig.mjs`) vẫn chạy xanh bằng `node --test` (tên lệnh npm mới do Engineering chọn, gợi ý `test:budget`). Mọi hành vi người dùng thấy giữ nguyên (eval T-179/T-182 xanh): `api.getBudget`/`putBudget`/`updateProfile` vẫn gọi đúng như trước, chỉ không còn phát tín hiệu; tham số `{ track }`, `{ userView }` của hai hàm đó (hết tác dụng) bỏ được hay để lại tuỳ Engineering.

### H4 · Spec T-179: sửa chữ
`products/T-179-danh-sach-vendor-moi-giu-danh-sach-cu.md`: hai câu (câu mở đầu H1 về lối thẻ chọn hạng mục; bullet "Không làm" về thẻ chọn) trái H1 M3 (thẻ chọn áp CÙNG luật H1); sửa cho khớp, thêm dòng `v2.1` ở "Lịch sử sửa". **Đã làm** trong lượt viết spec này (sửa tài liệu, không phải việc của Engineering); Engineering không phải làm gì thêm.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` (H1) và `phungrk/tohong-front` (H3), hai PR; nhánh `t-183-don-no-nho` mỗi repo. Vùng: `planner/vendor/matching`.
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/vendor/` inv-001..006, `planner/vendor/matching/` inv-001..008, `planner/front/budget/`. **Ba bất biến khoá dấu chấm sẽ ĐỎ khi PR back merge (xem "Bất biến đề xuất"): đề nghị thay, không tự sửa.**
- Không chạm: điểm, trọng số, thứ tự, lọc, JSON, prompt AI, payment, auth, schema, dữ liệu người dùng. Không sửa `lib/matchFormatter.js`, `api/vendors.js`.
- Kiến trúc: dùng `fmtVi` có sẵn (`vendorMatcher.js:86`) cho cả năm chỗ; không thêm hàm định dạng thứ hai.
- Bậc A (đề xuất giữ): chữ hiển thị + xoá mã chết, eval tự động phủ hết tiêu chí, không chạm ranh giới cứng.

## Danh sách chỗ in số tiền lẻ cho cặp đôi (để Chief biết phạm vi, kiểm 2026-11-16 trên back `2d1a76c`, front `bb5781f`)
| Chỗ | Hôm nay | Quyết |
| --- | --- | --- |
| back `vendorMatcher.js:144` chip theo bàn | dấu chấm | ĐỔI (H1.1) |
| back `whyThisVendor` (164-176) chứa chip | dấu chấm (theo chip) | ĐỔI theo chip (H1.2) |
| back `:219` `budgetText` (ngân sách hạng mục, giá/bàn) | số thô, dấu chấm | ĐỔI (H1.3) |
| back `:254, :257` `giá dao động` | số thô, dấu chấm | ĐỔI (H1.4) |
| back `:105, 109, 114, 117` `budgetBasis.text` | dấu phẩy | giữ |
| back `:146` `Rẻ hơn Ntr` | số nguyên | giữ |
| back `matchFormatter.js:118` "Theo số bàn" (gửi AI) | dấu chấm | GIỮ (H2) |
| back `api/vendors.js:67` prompt AI giá vendor | dấu chấm | GIỮ (gửi AI) |
| back `api/budget.js:160-171`, `briefing.js:97` (prompt AI, số `amt`/`total_tr`) | chưa kiểm có số lẻ | ngoài phạm vi (gửi AI) |
| front `budget/sigLabel.js`, `Budget.jsx:498` | dấu phẩy | giữ |
| front `ui/priceText.js:3` khoảng giá vendor `4tr–4.6tr/bàn`, `Budget.jsx:221` "Bạn đã lưu lúc 3.5tr… 4.2tr/bàn", `VendorChatCards.jsx:1100` | dấu chấm | **KHÔNG đổi** (giá niêm yết của vendor, không phải chip hay dòng phép so; còn bị khoá bởi eval T-164, T-170, T-175); xem "Câu hỏi mở" |
| front `Budget.jsx:252-254, 461, 631`, `Dashboard.jsx:295-296`, `useBudget.js:43` (`{n}tr` thô) | chưa kiểm có số lẻ | ngoài phạm vi |

## Tiêu chí chấp nhận và eval
Eval back chạy từ gốc `tohong-hq`, đọc `TOHONG_BACK_REPO` (mặc định `../tohong-back`), không mạng. Eval front đọc `--repo <tohong-front>` hoặc `TOHONG_FRONT_REPO`, `PLAYWRIGHT_PATH`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Chip theo bàn dùng dấu phẩy đúng khuôn (3,9 / 128,7 / 4,3 từ 4,25 / số nguyên không đổi), ba số khớp `budgetBasis`, tổng chip = tổng trong `budgetBasis.text`, chi tiết = danh sách, JSON giữ số đầy đủ, `Đánh giá cao (4.9★)` và `Còn lịch 20.3` giữ dấu chấm, `Rẻ hơn Ntr` không đổi | `node eval/T-183/check_1_chip_dau_phay.mjs` |
| 2 | `whyThisVendor` mặc định và `whyThoseVendors` (vế ngân sách, vế giá dao động; venue và hạng mục khác) dùng dấu phẩy; số nguyên không đổi chữ; ước tính không vào "giá dao động" | `node eval/T-183/check_2_cau_tu_van_dau_phay.mjs` |
| 3 | Dòng "Theo số bàn" gửi AI giữ NGUYÊN dấu chấm, không thêm tổng (đối chiếu T-178) | `node eval/T-178/check_3_dong_theo_so_ban_gui_ai_giu_nguyen.mjs` |
| 4 | Front không còn tham chiếu scoreEpoch (file, import, lệnh bump, tên lệnh npm); hai test sống vẫn xanh | `node eval/T-183/check_4_khong_con_score_epoch.cjs` |
| 5 | Hành vi front không đổi: T-179 (check_4, 6, 8, 9 và hai bất biến matching/inv-006, inv-008) và T-182 (adv-01..06) vẫn xanh trên App thật | `bash eval/T-183/check_5_hanh_vi_front_khong_doi.sh` |
| 6 | Spec T-179 không còn hai câu trái H1 M3, còn bullet M3, "Lịch sử sửa" ghi T-183 (kiểm văn bản, không phải hành vi sản phẩm; việc duy nhất của H4, đã làm) | `bash eval/T-183/check_6_spec_t179_khop_h1.sh` |

Tự kiểm bằng bản cài giả (bản sao ở thư mục tạm, repo thật không đổi): eval 1, 2 ĐỎ trên back main `2d1a76c`, XANH trên bản giả; eval 3 xanh cả hai; eval 4 ĐỎ trên front main `bb5781f`, XANH trên bản giả; eval 5 XANH trên bản giả (đã chạy 10 eval); eval 6 XANH, và ĐỎ khi trả lại câu cũ vào bản sao spec.

## Bất biến đề xuất (tầng 2)
Chief quyết, ghi `decisions/`; spec-critic rút khi spec qua cổng. Không tự sửa file gốc.
- **Thay `planner/vendor/matching/inv-007`** (khoá "dấu chấm thập phân"): bản thay `eval/T-183/thay-the/inv-007-tong-trong-chip-ban-bang-budget-basis.mjs`, khác bản gốc đúng một dòng (`r1` thêm `.replace(".", ",")`) và chữ mô tả. XANH trên bản giả, ĐỎ trên back main.
- **Thay `planner/vendor/inv-004`** (đang chạy `eval/T-178/thay-the/inv-004-check_8.mjs`): bản thay `eval/T-183/thay-the/inv-004-check_8.mjs` (chip venue giá riêng ghi `≈ 4,6tr/bàn …` ở ba chỗ; dòng "Theo số bàn" giữ `4.6`).
- **Thay `planner/vendor/inv-005-...sh`** (đang chạy `eval/T-178/thay-the/inv-005.sh`): bản thay `eval/T-183/thay-the/inv-005.sh` (chạy `inv-005a.mjs` mới, chip dấu phẩy; dùng lại `inv-005b.mjs` của T-178, không phụ thuộc dấu).
- **Bất biến mới (đề nghị `matching/inv-009`)**: "Mọi chữ do back sinh cho cặp đôi (chip, `whyThisVendor`, `whyThoseVendors`) viết số tiền lẻ bằng dấu phẩy, không còn dạng `\d.\d+tr`" = `eval/T-183/check_2_cau_tu_van_dau_phay.mjs` (chip đã được inv-007 thay phủ).
- **Thời điểm:** cả ba bản thay XANH trên PR back và ĐỎ trên main tới khi merge (ADR-028). Tiền lệ ADR-108 đổi trước Code Gate vì bản thay xanh cả hai phía; bản này không làm được vậy (chặt dấu phẩy). Đề nghị Chief đổi trỏ ba bất biến NGAY LÚC bắt đầu Code Gate T-183 và merge PR ngay sau adversary accept (bậc A), để khoảng đỏ trên main ngắn nhất. Việc khác đang chạy cùng lúc trên main sẽ thấy ba bất biến đỏ trong khoảng đó.

### Eval cũ sẽ lỗi thời khi PR back T-183 merge (đã chạy trên bản giả: đỏ)
- `eval/T-178/check_1_chip_ghi_tong.mjs` (literal `3.9`, `128.7`), `eval/T-178/check_2_chip_dung_cho_cu_diem_thu_tu_khong_doi.mjs` (golden `golden-main.json` ghim dấu chấm).
- `eval/T-180/adv-01-gia-le-lam-tron.mjs`, `adv-02-so-lon.mjs`, `adv-04-cau-mac-dinh-va-uoc-tinh.mjs` (khuôn `r1` dấu chấm; `adv-03` vẫn xanh).
- `eval/invariants/planner/vendor/matching/inv-007-…mjs`, các bất biến inv-004, inv-005 (xem trên).
- Đã lỗi thời từ trước (ADR-108): T-164/check_9, T-165/adv-01, adv-02, adv-06; bản cũ `eval/T-172/check_8_inv004_ban_thay_the.mjs`.
- Còn đúng, giữ: `eval/T-178/check_3`, `check_4_chip_front_360.cjs` (front in nguyên chip, dữ liệu giả không phụ thuộc dấu), T-167, T-168, T-159/check_9, bất biến `planner/vendor` inv-001, 002, 003, 006 và `matching` inv-001..005 (đã chạy xanh trên bản giả). T-170, T-175, T-164/check_5 (khoảng giá vendor dấu chấm ở front): không đổi.

## Không làm
- Không đổi dòng "Theo số bàn" hay prompt AI nào; không thêm tổng vào đó.
- Không đổi khoảng giá vendor ở front (`4tr–4.6tr/bàn`), "Bạn đã lưu lúc …", tổng so sánh: giá niêm yết của vendor, ngoài chip và dòng phép so.
- Không đổi điểm, thứ tự, lọc, JSON, `budgetBasis.text`, chip `Rẻ hơn Ntr`/`Trong ngân sách`.
- Không đổi hành vi front; không đụng `mergeBudget.js`, `sigLabel.js`, `useBudget.js` ngoài những tham số hết tác dụng của `getBudget`/`putBudget`.
- Không đổi eval hay bất biến cho khớp code (Chief thay, có ghi `decisions/`).

## Câu hỏi mở
Một câu cho Capu (có mặc định, không chặn): khoảng giá vendor ở front (`4tr–4.6tr/bàn`, `Bạn đã lưu lúc 3.5tr`) cũng còn dấu chấm; có muốn đổi sang dấu phẩy ở một việc riêng không (mặc định: không, vì đó là giá niêm yết, và eval T-164/T-170/T-175 khoá dấu chấm)?
