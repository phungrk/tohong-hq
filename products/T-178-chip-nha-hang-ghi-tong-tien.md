# Spec T-178: Chip "≈ Xtr/bàn × N bàn" của nhà hàng ghi kèm tổng tiền

> v1 · Spec Writer (product) · 2026-11-15 · bậc A · vùng `planner/vendor/matching` · chỉ đổi `tohong-back` (một chuỗi chip); `tohong-front` không phải sửa (đã đo, xem eval 4) · nối tiếp T-164 (H7), T-167 (`budgetBasis`), INV matching-005.

## Ý định
Capu 2026-11-15 (ảnh chip "≈ 3tr/bàn × 20 bàn"): cặp đôi phải thấy ngay tổng tiền tiệc ước tính ngay trên chip lý do của nhà hàng, không phải tự nhẩm: "≈ 3tr/bàn × 20 bàn = 60tr".

## Bằng chứng
- Chip hôm nay do `tohong-back` main `c2445db` `lib/vendorMatcher.js:144` tạo, chỉ khi `scores.budget >= 1` và giá không ước tính (`:141`), venue theo bàn (`isPerTableVendor`) và có số bàn; nhãn `≈ ${fmtTr(priceMax)}tr/bàn × ${tables} bàn`. `fmtTr` (`:71`) = làm tròn 1 chữ số, dấu chấm, bỏ `.0`, không phân cách nghìn.
- Tổng cần ghi đã có sẵn một nguồn: `budgetBasis.totalTr = priceMax × tables` ở `:114` (số chưa làm tròn; điểm Ngân sách suy ra từ chính nó, matching inv-005). Dòng `budgetBasis.text` đã ghi `= {tổng}tr so với …` (dấu phẩy, T-167 H2).
- Front: chip vẽ ở `tohong-front/src/screens/chat/VendorChatCards.jsx:431-440` (`reasons.slice(0, 2)`, `flexWrap`, nền pill, không cắt chữ); tab Vendor không có chip này (T-167 H3). Đo chip dài nhất có thể ở 360px (`≈ 12.5tr/bàn × 360 bàn = 4500tr` đứng sau chip `Hợp gu Hiện đại tối giản`): không tràn, không bị cắt, một dòng, trên **main hiện tại** (eval 4 xanh sẵn), nên front không cần đổi. Tự tin cao (đo bằng Playwright, có thử âm tính: chip 80 ký tự thì đỏ).
- Dòng gửi AI `lib/matchFormatter.js:118` (`Theo số bàn: ≈ {giá}tr/bàn × {N} bàn`) do T-164 H7.4(c) quy định, và bốn eval hiện có khớp nguyên dòng đó (T-164 check_9, T-172 check_8, inv-005a/b).
- Chip còn được dùng ở hai nơi khác của back (tự động, không sửa riêng): `api/vendors.js:59` ghép nhãn các chip vào câu lệnh gửi LLM "vì sao hợp" (`Lý do khớp: …`); `whyThisVendor` (`vendorMatcher.js:164-173`) khi không có chip gu/lịch có thể chèn nhãn chip đầu vào câu mặc định.

## Giả thuyết
Nếu chip ghi luôn tổng thì cặp đôi hiểu số tiền tiệc mà không phải mở chi tiết hay nhẩm. Chỉ số bảo vệ: điểm, tổng điểm, thứ tự, tập vendor có chip, các chip khác, dòng gửi AI KHÔNG đổi so với main; chip vẫn vừa khung 360px.

## Hành vi (người dùng thấy gì)

### H1 · Khuôn chip
Khi chip theo bàn hiện, nhãn là đúng chuỗi `≈ {giá}tr/bàn × {N} bàn = {tổng}tr`:
- `{giá}` và `{N}` giữ nguyên như hôm nay (`{giá}` = `priceMax` qua `fmtTr`; `{N}` = số bàn đã tính điểm).
- `{tổng}` = `match.budgetBasis.totalTr` của chính vendor đó làm tròn **cùng khuôn với `{giá}`**: một chữ số thập phân, dấu **chấm**, bỏ `.0`, KHÔNG dấu phân cách hàng nghìn, KHÔNG đổi sang tỷ, không dấu phẩy (3.9 × 33 = 128.7 → `128.7tr`; 3.9 × 360 = 1404 → `1404tr`). Khuôn chip là khuôn chấm, giữ như hôm nay; dòng `budgetBasis.text` giữ khuôn phẩy (T-167). Hai khuôn khác nhau đúng ở dấu thập phân, chấp nhận như T-167; không phải lỗi.
- Tổng lấy từ số **chưa làm tròn** `priceMax × N`, không phải `{giá}` đã làm tròn nhân `N`. Vd `priceMax` 4,25, 20 bàn: chip `≈ 4.3tr/bàn × 20 bàn = 85tr` (không phải 86). Phép nhân nhìn bằng mắt có thể lệch 0,1 × N do làm tròn `{giá}`; chấp nhận, vì `85` là số điểm Ngân sách đã dùng.
- Cùng một vendor, chip ở `GET /api/vendors/match` và ở `GET /api/vendors/:id` (`match.reasons`) giống hệt; tổng trong chip bằng tổng trong `budgetBasis.text` (sau khi bỏ khác biệt dấu thập phân).

### H2 · Chip hiện đúng ở các trường hợp hôm nay, không hơn
Chip theo bàn có khi và chỉ khi: hạng mục venue, vendor có giá riêng (không phải `estimate_*`), có số bàn (có số khách hiệu lực), điểm Ngân sách = 1, và chip còn nằm trong ba lý do đầu (`reasons.slice(0, 3)`). Không có chip khi giá ước tính, thiếu số khách, điểm < 1, hạng mục khác venue. Hạng mục khác vẫn `Rẻ hơn Ntr` / `Trong ngân sách` như cũ. Vị trí chip trong `reasons`, các chip khác, `totalScore`, `scoreBreakdown`, thứ tự danh sách: không đổi.

### H3 · Dòng "Theo số bàn" gửi AI: KHÔNG thêm tổng (quyết định)
Dòng chat `Theo số bàn: ≈ {giá}tr/bàn × {N} bàn` (`matchFormatter.js:118`) giữ nguyên từng ký tự; vendor ước tính vẫn không có dòng này. Lý do: (1) Capu chỉ yêu cầu chip; (2) chat chưa có `budgetBasis` trong tay, thêm tổng là thêm một nguồn số thứ hai ngoài matching inv-005; (3) cho AI thêm một con số tiền tiệc dễ bị AI nhắc lại như lời khẳng định về ngân sách (T-164 H4/H5); (4) bốn eval đang khớp nguyên dòng. Ảnh hưởng hash câu AI: **không có**: `whyProfileHash` (`api/vendors.js:23-45`) chỉ băm các trường hồ sơ; chip không nằm trong hash nên câu AI đã cache giữ nguyên, không phát sinh thêm lượt gọi LLM. Hệ quả phụ chấp nhận (không có eval riêng): câu LLM "vì sao hợp" được sinh MỚI sau thay đổi sẽ thấy chip có tổng trong `Lý do khớp:`, và câu mặc định `whyThisVendor` khi chip tổng đứng đầu có thể chứa `= {tổng}tr`.

### H4 · Front
Thẻ chat danh sách vendor hiện nguyên văn chip mới (không tính lại số), trọn vẹn, một dòng, không tràn ở 360px, kể cả chip dài nhất (`≈ 12.5tr/bàn × 360 bàn = 4500tr`). Front không đổi.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · nhánh `t-178-chip-ghi-tong` · sửa một chuỗi ở `lib/vendorMatcher.js` (chip, `:144`); không repo khác. Vùng `planner/vendor/matching`.
- Bất biến đã đọc: `_shared/`, `planner/vendor/` (inv-001..006), `matching/` (inv-001..005). Spec giữ matching inv-005 (tổng = `budgetBasis.totalTr`, một nguồn số), inv-001..004 (không đổi điểm/thứ tự), inv-002/003 (nhãn giá, ước tính không chip).
- **Đề nghị đổi bất biến (ghi cho Chief, không tự đổi):** `planner/vendor/inv-004` (chạy `T-172/check_8`), `planner/vendor/inv-005` (`inv-005a`, `inv-005b`) so nhãn chip bằng đúng chuỗi cũ `≈ 4.6tr/bàn × 30 bàn`, nên **đỏ ngay khi T-178 ship** (đã thử trên bản cài giả). Bản thay thế đã viết, chỉ khác đúng một điểm (bỏ ` = {tổng}tr` khỏi nhãn trước khi so), xanh cả trên main lẫn bản cài giả: `eval/T-178/thay-the/inv-004-check_8.mjs`, `eval/T-178/thay-the/inv-005.sh` (+ `inv-005a.mjs`, `inv-005b.mjs`). Cần Chief ghi `decisions/` và trỏ inv-004/inv-005 sang chúng (kiểu ADR-101) **trước hoặc cùng lúc** merge, nếu không Code Gate báo tầng 2 đỏ và trả `--kind spec`. Eval cũ của việc đã xong (`T-164/check_9`, `T-165/adv-01,02,06`) cũng đỏ vì cùng lý do; chúng không chạy ở tầng 2, không sửa.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, LLM (hash và cache không đổi), dịch vụ trả phí, điểm, thứ tự.
- Bậc đề xuất: **A** (một chuỗi hiển thị, eval tự động phủ hết tiêu chí, không chạm ranh giới cứng). Điều kiện: Chief xử lý bốn bất biến ở trên trước merge.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (`TOHONG_BACK_REPO` mặc định `../tohong-back`; eval 4 cần `TOHONG_FRONT_REPO`, Playwright). Pool đóng dấu giá (fixture T-164), R2 giả, không mạng.

| # | Tiêu chí (có/không) | Eval | Trạng thái trên main `c2445db` |
| --- | --- | --- | --- |
| 1 | Chip có dạng `≈ {giá}tr/bàn × {N} bàn = {tổng}tr`; `{tổng}` = `budgetBasis.totalTr` làm tròn khuôn chấm, tính từ số chưa làm tròn; ở cả match và chi tiết; số lớn không phân cách nghìn; trùng tổng trong `budgetBasis.text` (8 tình huống: 3×20=60; 3,9×20=78; 3,9×33=128.7; 4,25×20=85 chứ không 86; 201 khách=21 bàn; bảng 300 khách thắng hồ sơ; không bảng; 3,9×360=1404) | `node eval/T-178/check_1_chip_ghi_tong.mjs` | ĐỎ |
| 2 | Chip chỉ hiện đúng các trường hợp hôm nay; điểm, tổng điểm, thứ tự, chip khác y hệt main (6 kịch bản, so với `golden-main.json` chụp trên main) | `node eval/T-178/check_2_chip_dung_cho_cu_diem_thu_tu_khong_doi.mjs` | XANH (hàng rào) |
| 3 | Dòng `Theo số bàn` gửi AI giữ nguyên từng ký tự, không `= tổng` ở bất kỳ dòng ứng viên nào; ước tính vẫn không có dòng | `node eval/T-178/check_3_dong_theo_so_ban_gui_ai_giu_nguyen.mjs` | XANH (hàng rào) |
| 4 | Thẻ chat hiện chip mới trọn vẹn, một dòng, không tràn/cắt ở 360px (chip dài nhất `= 4500tr`), không tính lại số | `node eval/T-178/check_4_chip_front_360.cjs` | XANH (hàng rào; front không đổi) |

Nói thẳng: chỉ eval 1 đỏ trên main (đúng, vì hành vi mới chỉ nằm ở chip); eval 2, 3, 4 là hàng rào chống hồi quy và phải xanh trước lẫn sau. Mỗi tiêu chí đúng một eval. `T178_GOLDEN=1 node eval/T-178/check_2_*.mjs` in lại golden, chỉ chạy trên back chưa có T-178.

## Bất biến đề xuất (tầng 2)
INV (vùng `planner/vendor/matching`): với mọi vendor có chip theo bàn, tổng trong chip = `budgetBasis.totalTr` làm tròn cùng khuôn (một nguồn số, mở rộng matching inv-005 sang chip). Nội dung = vòng so tổng của `check_1`; spec-critic rút khi spec qua cổng. Kèm đề nghị thay hàng ở mục Ràng buộc (inv-004, inv-005).

## Không làm
- Không đổi dấu thập phân của chip sang phẩy, không thêm phân cách nghìn, không đổi sang tỷ.
- Không thêm tổng vào dòng chat gửi AI; không đổi `whyProfileHash`, cache, hay prompt LLM trực tiếp.
- Không đổi điểm, trọng số, thứ tự, điều kiện hiện chip, `budgetBasis`, câu `whyThoseVendors`.
- Không sửa front, không sửa bất biến/eval cũ (chỉ đề nghị thay thế).

## Câu hỏi mở
Không có câu hỏi cho Capu. Việc cho Chief: ghi `decisions/` trỏ inv-004 và inv-005 sang bản thay thế ở `eval/T-178/thay-the/` (xem Ràng buộc).
