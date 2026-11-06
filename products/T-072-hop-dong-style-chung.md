# Spec T-072: Hợp đồng style chung cho hai đường matching

## Ý định
Capu (issue #16): cặp đôi chọn style thì vendor khớp style phải lên trước, vendor thiếu tag không bị phạt, hai đường matching (JS `lib/vendorMatcher.js`, Python `matcher/stage2_scoring.py`) chấm style bằng cùng một luật, và lời giải thích nói tiếng Việt chứ không in tag thô.

## Bằng chứng
- Pool thật `tohong-back/lib/vendorPool.generated.js`: 968 vendor, 454 không tag style, 514 có tag. Tôi đếm lại bằng node: tổng vendor không tag theo 10 category = 454 (khớp con số trong issue). Tần suất tag: luxury 247, modern 198, traditional 128, minimalist 124, simple 91, soft 58, natural 27, korean 24, rustic 22, editorial 3.
- Đọc code: JS `styleScore` trả 0.5 khi thiếu tag, 0 khi tag lệch, 1 khi khớp; Python `score_style` trả 0.0 khi thiếu tag và `overlap/len(prefs)` (phân số) khi có tag. Hai đường đang chấm khác nhau cho cùng ca.
- Front `STYLE_TAG_MAP` (`phungrk/tohong-front/src/App.jsx:267`) chỉ đổi `han → korean`; không vendor nào được gắn tag `soft` được tính cho cặp đôi chọn Hàn.
- Tôi đã thử luật 1.0/0.5 cộng trọng số hiện có (không phân nhóm) trên pool thật: top 10 chỉ chứa 0/10 đến 10/10 vendor khớp tuỳ hồ sơ (vd korean × áo cưới, ngân sách 300tr: 0/10). Do đó tiêu chí 3 cần luật phân nhóm (R4), cộng điểm đơn thuần không đủ.
- Tôi đã dựng bản cài đặt tham chiếu ở thư mục tạm (không nằm trong repo) và cả 4 eval chạy PASS trên đó: luật dưới đây khả thi.

## Giả thuyết
Nếu chấm style theo R3 và xếp theo R4 thì cặp đôi chọn style thấy vendor khớp style ở đầu danh sách ở mọi category, và hai đường cho cùng điểm style. Chỉ số bảo vệ: tổng điểm của vendor không bị đổi bởi tier (tier chỉ đổi thứ tự); mọi tín hiệu khác và trọng số giữ nguyên.

## Hành vi (người dùng thấy gì)
Gọi "style cặp đôi chọn" là danh sách `preferredStyles` (JS) / `style_preferences` (Python) đúng như đã lưu. Không đổi dữ liệu đã lưu.

**R1 Chuẩn hoá.** Mọi so sánh style dùng chữ thường, cắt khoảng trắng hai đầu, ở cả style cặp đôi lẫn tag vendor. "Số style cặp đôi chọn" (`total`) đếm style khác nhau sau chuẩn hoá.

**R2 Mở rộng.** Mỗi style cặp đôi chọn chấp nhận một tập tag vendor, theo bảng `expansion` trong `eval/T-072/style-cases.json`: `korean` chấp nhận {korean, soft}; `modern` chấp nhận {modern, minimalist}. Style không có trong bảng chỉ chấp nhận chính nó (kể cả style lạ, không có danh sách trắng). Một chiều: cặp đôi chọn `soft` không chấp nhận `korean`; cặp đôi chọn `minimalist` không chấp nhận `modern`; không bắc cầu. Mở rộng áp dụng khi chấm điểm, ở cả hai đường, không áp dụng khi lưu hồ sơ.

**R3 Điểm style.** Điểm style của một vendor chỉ nhận hai giá trị:
- 1.0 khi có ít nhất một tag vendor thuộc tập chấp nhận (hợp của R2 trên mọi style đã chọn). Gọi vendor này là "khớp".
- 0.5 trong mọi trường hợp còn lại: tag lệch, vendor không tag, cặp đôi không chọn style.
Không còn giá trị 0, không dùng tỷ lệ phần trăm style. Trọng số style (JS 35%, Python 25%) giữ nguyên, nên vendor tag lệch và vendor không tag có cùng tổng điểm khi mọi thứ khác giống nhau.

**R4 Thứ tự.** Khi cặp đôi chọn ít nhất một style: mọi vendor khớp đứng trước mọi vendor không khớp trong toàn bộ danh sách; trong mỗi nhóm xếp theo tổng điểm giảm dần. Áp trước phân trang (`offset`/`limit`), nên trang 2 không bao giờ chứa vendor khớp nếu trang 1 còn vendor không khớp. Tổng điểm hiển thị không đổi vì nhóm. Python: chỉ `score_and_rank` (stage 2) đổi khoá sắp xếp theo nhóm; stage 3 (boost, MMR) giữ nguyên. Khi cặp đôi không chọn style: không có nhóm, xếp theo tổng điểm như cũ.

**R5 styleCoverage.** Mỗi vendor trong `vendors[]` của `computeMatches` (và do đó của `GET /api/vendors/match`) có `match.styleCoverage = { matched, total }`, đều là số nguyên. `total` theo R1. `matched` = số style cặp đôi chọn mà vendor thoả (có ít nhất một tag thuộc tập chấp nhận của style đó). `matched >= 1` khi và chỉ khi vendor khớp theo R3. Cặp đôi không chọn style: `{matched: 0, total: 0}`. Chỉ để giải thích và hiển thị, không tham gia chấm điểm.

**R6 Giải thích.**
- Mọi chữ hiển thị (`match.reasons[].label`, `match.whyThisVendor`, `whyThoseVendors`, và dòng "Phù hợp vì" của `formatMatchBlock`) không chứa tag thô (10 tag trong `all_tags`, hay bất kỳ chuỗi tag nào của vendor hoặc cặp đôi). Style được gọi bằng nhãn tiếng Việt trong `labels_vi` (vd korean = "Hàn Quốc"). Style không có trong `labels_vi` thì không được in.
- Nhãn luôn là nhãn của style **cặp đôi đã chọn** mà vendor thoả (vd cặp đôi chọn Hàn, vendor gắn `soft`: nói "Hàn Quốc", không nói "soft" hay "nhẹ nhàng").
- Khi `matched = 0`: không có chữ "gu", "phong cách" hay "style" trong các chuỗi trên của vendor đó (tên vendor không tính). Cấm cả ở dòng "Phù hợp vì" của `formatMatchBlock` (bỏ nhánh "phong cách <tag của vendor>" hiện có).
- Khi `matched >= 1` và ít nhất một style thoả có nhãn: `whyThisVendor` và ít nhất một `reasons[].label` nêu nhãn đó; `formatMatchBlock` nêu nhãn ở dòng "Phù hợp vì".
- `whyThoseVendors`: không tag thô; không có "gu"/"phong cách"/"style" khi không vendor nào trong danh sách trả về có `matched >= 1`.

**R7 Điểm nối cho kiểm thử (bắt buộc, không đổi hành vi mặc định).**
- `computeMatches(profile, opts)` nhận thêm `opts.pool` (mảng vendor, mặc định `VENDOR_POOL`) thay cho pool bundle trong lời gọi đó. Ba bước lọc cứng (city, `isVerified`, rating) vẫn áp dụng.
- Python giữ nguyên tên `compute_score(vendor, profile)`, `score_and_rank(vendors, profile, top_n)`, `breakdown.components["style"][0]` (giá trị thô 0-1).
- Engineering chép nguyên văn `eval/T-072/style-cases.json` vào `tohong-back/test/fixtures/style-cases.json`; test Node và test Python của repo đó đọc chung file này (đây chính là "file ca chạy chung").
- Được phép cập nhật ba test cũ vì chúng khẳng định hành vi mà spec này thay thế: `test/test_vendor_matching.js` ca `formatMatchBlock: translates real matcher output` (dòng `/style korean/` đổi thành nhãn "Hàn Quốc"); `matcher/test_matcher.py` ca "Partial style match = 0.5" và "No tags = 0.0" (đổi theo R3). Hai ca đã đỏ sẵn từ trước ("Non-verified rejected", "Only 1 passes") không thuộc việc này.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-072-style-chung` · Vùng (`area`): `planner/vendor/matching`
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret, INV-002 số cái đọc được) và `planner/`, `planner/vendor/` (hiện chỉ có `images/`); vùng `planner/vendor/matching` chưa có bất biến riêng. Spec không vi phạm INV nào.
- Kiến trúc: JS và Python phải chấm cùng luật nhưng được cài riêng; bảng `expansion` và `labels_vi` nên đọc từ một nguồn trong mỗi ngôn ngữ, bằng với `style-cases.json` (eval kiểm hành vi, không kiểm cách cài).
- Không chạm: front (`STYLE_TAG_MAP` giữ nguyên), schema dữ liệu lưu, prompt/LLM, `profileBuilder.js`, pool vendor, trọng số các tín hiệu khác. Câu LLM per-vendor trong `api/vendors.js` (hàm sinh `sentence`) không thuộc phạm vi này.
- Bậc đề xuất: B (đổi logic xếp hạng, không chạm tiền/auth/schema/dữ liệu người dùng).

## Tiêu chí chấp nhận và eval
Biến môi trường chung: `TOHONG_BACK_REPO` (đường dẫn repo `tohong-back`); không đặt thì thử cwd rồi `../tohong-back`. Cần node >= 18 và python3; chạy từ gốc `tohong-hq`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | File ca JSON chạy chung cho Node và Python; 18 ca cho cùng điểm style ở hai đường, đúng giá trị kỳ vọng, và `styleCoverage` đúng; bản chép trong repo giống file gốc từng byte | `python3 -I eval/T-072/check_1_ca_chung.py` |
| 2 | Hai vendor giống hệt, một tag lệch, một không tag: cùng tổng điểm (JS trên vendor thật của pool, Python); vendor khớp cao hơn cả hai | `python3 -I eval/T-072/check_2_khong_phat_thieu_tag.py` |
| 3 | 6 style × ảnh cưới, makeup, áo cưới, nhà hàng × 4 hồ sơ trên pool thật: top 10 có min(10, số vendor khớp) vendor khớp; không vendor khớp nào đứng sau vendor không khớp; Python stage 2 giữ vendor khớp trong top_n | `python3 -I eval/T-072/check_3_top10_pool_that.py` |
| 4 | Không tag thô trong reasons/whyThisVendor/whyThoseVendors/formatMatchBlock; không "gu" khi matched=0; có nhãn tiếng Việt khi matched>=1; `styleCoverage {matched,total}` đúng | `python3 -I eval/T-072/check_4_giai_thich_va_coverage.py` |

Tình trạng hiện tại (trước khi cài): cả 4 đỏ bằng FAIL, không ERROR. Trên bản cài tham chiếu cả 4 PASS. Ghi chú về tiêu chí 3: "khớp" do eval tự tính từ tag trong pool và bảng `expansion`, không tin `styleCoverage`; "vendor đủ điều kiện" = cùng category, `isVerified`, city HCMC, rating = 0 hoặc >= 3.5.

## Bất biến đề xuất (tầng 2)
Vùng `planner/vendor/matching`:
1. Thiếu tag không bị phạt: hai vendor chỉ khác tag (lệch so với không tag) luôn cùng tổng điểm ở cả hai đường, và vendor khớp luôn cao hơn. Bản chạy được: `eval/T-072/inv-proposed-khong-phat-thieu-tag.py`.
2. Vendor khớp style luôn đứng trước vendor không khớp trên pool thật (phần "tier_violated" của check_3). Đề xuất tách thành bất biến sau khi spec qua cổng nếu critic thấy cần; tôi không viết bản riêng để tránh trùng eval.

## Không làm
Thêm style mới; đổi trọng số tín hiệu khác; dùng phần trăm style để chấm; làm sạch tag (issue #17); sửa front; sửa câu LLM per-vendor; đổi `profileBuilder.js`; sửa hai ca đỏ sẵn của `test_matcher.py`.

## Câu hỏi mở
R4 (khớp luôn đứng trước) là cái giá của tiêu chí 3: một vendor không tag chất lượng rất cao sẽ nằm sau mọi vendor khớp, dù khớp kém chất lượng; trong 454 vendor không tag có cả vendor tốt. Capu có chấp nhận đánh đổi này không, hay muốn giới hạn (vd chỉ tier cho top 10)? Mặc định spec: chấp nhận, vì tiêu chí 3 do Capu nêu không đạt được bằng cách khác với trọng số hiện có.
