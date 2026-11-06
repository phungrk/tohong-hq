# Spec T-072: Hợp đồng style chung cho hai đường matching

## Ý định
Capu (issue #16): cặp đôi chọn style thì vendor khớp style phải lên trước, vendor thiếu tag không bị phạt, hai đường matching (JS `lib/vendorMatcher.js`, Python `matcher/stage2_scoring.py`) chấm style bằng cùng một luật, và lời giải thích nói tiếng Việt chứ không in tag thô.

## Bằng chứng
- Pool thật `tohong-back/lib/vendorPool.generated.js`: 968 vendor, 454 không tag style, 514 có tag. Tôi đếm lại bằng node: tổng vendor không tag theo 10 category = 454 (khớp con số trong issue). Tần suất tag: luxury 247, modern 198, traditional 128, minimalist 124, simple 91, soft 58, natural 27, korean 24, rustic 22, editorial 3.
- Đọc code: JS `styleScore` trả 0.5 khi thiếu tag, 0 khi tag lệch, 1 khi khớp; Python `score_style` trả 0.0 khi thiếu tag và `overlap/len(prefs)` (phân số) khi có tag. Hai đường đang chấm khác nhau cho cùng ca.
- Front `STYLE_TAG_MAP` (`phungrk/tohong-front/src/App.jsx:267`) chỉ đổi `han → korean`; không vendor nào được gắn tag `soft` được tính cho cặp đôi chọn Hàn.
- Luật cộng điểm 1.0/0.5 giữ trọng số hiện có (JS 0,35 style) chỉ hơn vendor không khớp 17,5 điểm, ít hơn biên độ lịch + ngân sách (45 điểm); nên khớp gu không bao giờ là ưu tiên tuyệt đối. ADR-026 (`decisions/2026-11-06-adr-026-t072-gu-la-tin-hieu-cong-diem.md`, Chief of Staff chọn cách B thay Capu, Capu có thể đảo) chốt đây là thiết kế: gu là một tín hiệu cộng điểm, không đẩy vendor vượt ngân sách lên trước vendor đúng ngân sách. Defect: `handoffs/T-072-D1.md`.
- Số đo thật cho tiêu chí 3b (tôi chạy lại ở vòng này). Lưới 96 tổ hợp = 6 style × 4 hạng mục (ảnh cưới, makeup, áo cưới, nhà hàng) × 4 hồ sơ của `style-cases.json`; "khớp" tính theo R2 từ tag trong pool thật (968 vendor, sha256 `a8df3e21…6546ad7`); đo ở top 10 của `computeMatches` (JS).
  - Bản hiện tại (tohong-back commit 6a9a9c7): tổng 561 vendor khớp trong top 10 trên 96 tổ hợp. Lưu ở `eval/T-072/baseline-top10.json`.
  - Bản tham chiếu R3 + R2 (bản cài tạm của tôi, ngoài repo): tổng 615 (+54). 17/96 tổ hợp tăng, 67 bằng, **12/96 tụt** (tụt nhiều nhất: traditional × ảnh cưới × 80tr, 8→4; luxury × ảnh cưới × 80tr, 8→5; korean × áo cưới, 3→0 ở hai hồ sơ). Gộp 4 hồ sơ theo từng cặp style × hạng mục thì 7/24 cặp vẫn tụt.
  - Nguyên nhân: hiện tại tag lệch bị 0 điểm style nên vendor khớp hơn vendor lệch tới 35 điểm; R3 đưa vendor lệch về 0,5 (đúng mục đích "không phạt") nên khoảng cách còn 17,5 và vendor lệch đúng ngân sách/lịch vượt lên. Tụt là hệ quả trực tiếp của ý định, không phải lỗi cài đặt.
  - Kết luận: câu 3b nguyên văn của ADR ("ở mỗi tổ hợp, không ít hơn bản hiện tại") KHÔNG đạt được bằng R3 ở 12/96 tổ hợp. Tôi đo **tổng** trên 96 tổ hợp (561 → 615) và in danh sách tổ hợp tụt; xem "Câu hỏi mở".
- Python: đường chat đầy đủ (stage 1-3) hiện đã đảo thứ tự gu: pool 4 vendor khớp cùng tag + 4 không khớp, top_k 6 trả `m0, u0, u1, u2, u3, m1` (MMR phạt vendor trùng tag với vendor đã chọn, mạnh hơn 12,5 điểm chênh gu). Chỉ sửa `score_style` thì vẫn đảo (đã thử: cùng kết quả). Do đó R8.
- Tôi đã dựng bản cài đặt tham chiếu ở thư mục tạm (không nằm trong repo): `check_2` và `check_3` PASS trên đó, FAIL (không ERROR) trên code hiện tại ở `check_2`; `check_3` là phép chống thoái lui nên PASS ở bản hiện tại (561→561). `check_1` và `check_4` không đổi logic ở vòng này nên tôi không chạy lại trên bản tham chiếu.

## Giả thuyết
Nếu chấm style theo R3 (khớp 1,0, còn lại 0,5), mở rộng tag theo R2 và giữ thứ tự gu nhất quán theo R8, thì ở cùng điều kiện khác vendor khớp style luôn xếp trên vendor không khớp ở cả hai đường, vendor thiếu tag không bị phạt, và số vendor khớp trong top 10 không giảm tổng thể. Chỉ số bảo vệ: mọi tín hiệu khác và trọng số giữ nguyên; vendor đúng ngân sách không bị gu đẩy ra khỏi top 10 (không có luật dành chỗ).

## Hành vi (người dùng thấy gì)
Gọi "style cặp đôi chọn" là danh sách `preferredStyles` (JS) / `style_preferences` (Python) đúng như đã lưu. Không đổi dữ liệu đã lưu.

**R1 Chuẩn hoá.** Mọi so sánh style dùng chữ thường, cắt khoảng trắng hai đầu, ở cả style cặp đôi lẫn tag vendor. "Số style cặp đôi chọn" (`total`) đếm style khác nhau sau chuẩn hoá.

**R2 Mở rộng.** Mỗi style cặp đôi chọn chấp nhận một tập tag vendor, theo bảng `expansion` trong `eval/T-072/style-cases.json`: `korean` chấp nhận {korean, soft}; `modern` chấp nhận {modern, minimalist}. Style không có trong bảng chỉ chấp nhận chính nó (kể cả style lạ, không có danh sách trắng). Một chiều: cặp đôi chọn `soft` không chấp nhận `korean`; cặp đôi chọn `minimalist` không chấp nhận `modern`; không bắc cầu. Mở rộng áp dụng khi chấm điểm, ở cả hai đường, không áp dụng khi lưu hồ sơ.

**R3 Điểm style.** Điểm style của một vendor chỉ nhận hai giá trị:
- 1.0 khi có ít nhất một tag vendor thuộc tập chấp nhận (hợp của R2 trên mọi style đã chọn). Gọi vendor này là "khớp".
- 0.5 trong mọi trường hợp còn lại: tag lệch, vendor không tag, cặp đôi không chọn style.
Không còn giá trị 0, không dùng tỷ lệ phần trăm style. Trọng số style (JS 35%, Python 25%) giữ nguyên, nên vendor tag lệch và vendor không tag có cùng tổng điểm khi mọi thứ khác giống nhau.

**R4 (đã bỏ, ADR-026).** Không có luật "vendor khớp luôn đứng trước" và không có luật dành chỗ trong top 10. Thứ tự toàn danh sách là thứ tự theo tổng điểm như hiện nay; gu chỉ tác động qua điểm style của R3. Ở mọi chỗ khác trong spec, "R4" nghĩa là dòng bỏ này.

**R5 styleCoverage.** Mỗi vendor trong `vendors[]` của `computeMatches` (và do đó của `GET /api/vendors/match`) có `match.styleCoverage = { matched, total }`, đều là số nguyên. `total` theo R1. `matched` = số style cặp đôi chọn mà vendor thoả (có ít nhất một tag thuộc tập chấp nhận của style đó). `matched >= 1` khi và chỉ khi vendor khớp theo R3. Cặp đôi không chọn style: `{matched: 0, total: 0}`. Chỉ để giải thích và hiển thị, không tham gia chấm điểm.

**R6 Giải thích.**
- Mọi chữ hiển thị (`match.reasons[].label`, `match.whyThisVendor`, `whyThoseVendors`, và dòng "Phù hợp vì" của `formatMatchBlock`) không chứa tag thô (10 tag trong `all_tags`, hay bất kỳ chuỗi tag nào của vendor hoặc cặp đôi). Style được gọi bằng nhãn tiếng Việt trong `labels_vi` (vd korean = "Hàn Quốc"). Style không có trong `labels_vi` thì không được in.
- Nhãn luôn là nhãn của style **cặp đôi đã chọn** mà vendor thoả (vd cặp đôi chọn Hàn, vendor gắn `soft`: nói "Hàn Quốc", không nói "soft" hay "nhẹ nhàng").
- Khi `matched = 0`: không có chữ "gu", "phong cách" hay "style" trong các chuỗi trên của vendor đó (tên vendor không tính). Cấm cả ở dòng "Phù hợp vì" của `formatMatchBlock` (bỏ nhánh "phong cách <tag của vendor>" hiện có).
- Khi `matched >= 1` và ít nhất một style thoả có nhãn: `whyThisVendor` và ít nhất một `reasons[].label` nêu nhãn đó; `formatMatchBlock` nêu nhãn ở dòng "Phù hợp vì".
- `whyThoseVendors`: không tag thô; không có "gu"/"phong cách"/"style" khi không vendor nào trong danh sách trả về có `matched >= 1`.

**R7 Điểm nối cho kiểm thử (bắt buộc, không đổi hành vi mặc định).**
- `computeMatches(profile, opts)` nhận thêm `opts.pool` (mảng vendor, mặc định `VENDOR_POOL`) thay cho pool bundle trong lời gọi đó. Ba bước lọc cứng (city, `isVerified`, rating) vẫn áp dụng.
- Python giữ nguyên tên `compute_score(vendor, profile)`, `score_and_rank(vendors, profile, top_n)`, `breakdown.components["style"][0]` (giá trị thô 0-1). Giữ nguyên cả `WeddingMatcher(pool).match(profile, top_k, enable_relaxation, diversity_weight)` và thuộc tính `.matches[i].vendor` (eval R8 gọi đường chat đầy đủ qua đó). Các điểm nối này là cố ý và R7 phải giữ nguyên khi sửa.
- Engineering chép nguyên văn `eval/T-072/style-cases.json` vào `tohong-back/test/fixtures/style-cases.json`; test Node và test Python của repo đó đọc chung file này (đây chính là "file ca chạy chung").
- Được phép cập nhật ba test cũ vì chúng khẳng định hành vi mà spec này thay thế: `test/test_vendor_matching.js` ca `formatMatchBlock: translates real matcher output` (dòng `/style korean/` đổi thành nhãn "Hàn Quốc"); `matcher/test_matcher.py` ca "Partial style match = 0.5" và "No tags = 0.0" (đổi theo R3). Hai ca đã đỏ sẵn từ trước ("Non-verified rejected", "Only 1 passes") không thuộc việc này.

**R8 Thứ tự gu nhất quán giữa hai đường.** Với cùng hồ sơ cặp đôi, hai vendor mà mọi thứ khác bằng nhau (giá, rating, lịch, sức chứa, cùng category, và không khác nhau ở bất kỳ tín hiệu nào ngoài chỗ khớp/không khớp gu) thì vendor khớp xếp trên vendor không khớp (tag lệch hoặc không tag), ở:
- JS: danh sách đầy đủ trả về của `computeMatches` (không chỉ khi so tổng điểm).
- Python stage 2: kết quả `score_and_rank`.
- Python đường chat đầy đủ: kết quả cuối `WeddingMatcher.match` sau boost và MMR (stage 3). Stage 3 không được đặt vendor không khớp trên vendor khớp khi hai bên chỉ khác ở chỗ khớp gu, kể cả khi nhiều vendor khớp có cùng tag (đa dạng hoá MMR vẫn được xáo trong nhóm khớp với nhau và trong nhóm không khớp với nhau, không xuyên nhóm).
Phạm vi của R8 là **quan hệ thứ tự giữa vendor khớp và không khớp**, không phải thứ tự đầy đủ giống hệt giữa hai đường: trọng số các tín hiệu khác nhau giữa JS (35/25/20/10/10) và Python (style 25), và spec này không đổi trọng số (xem "Câu hỏi mở").

## Lý do mở rộng tag ở bước chấm điểm (lệch gợi ý của issue #16)
Issue #16 gợi ý "mở rộng khi dựng profile" (`profileBuilder.js`); spec này mở rộng ở bước chấm điểm (R2) vì:
1. Điểm chung duy nhất của mọi đường vào: JS thẻ vendor dựng `preferredStyles` trực tiếp trong `api/vendors.js:91` (từ `preferences.style_tags`, không qua `profileBuilder.js`); `matcher-service/server.py:154` nhận `style_preferences` thô từ request; chỉ đường chat mới qua `profileBuilder.js:140`. Mở rộng ở profileBuilder chỉ phủ một trong ba đường, và hai đường còn lại vẫn bỏ sót vendor `soft`/`minimalist`.
2. Không ghi `soft`, `minimalist` vào hồ sơ cặp đôi: R5 đếm `total` theo style cặp đôi đã chọn và R6 gọi nhãn của style họ đã chọn; hồ sơ mở rộng sẽ hiện cho cặp đôi những style họ không chọn và làm `total` sai.
Về hành vi người dùng thấy, hai cách tương đương ở đường chat; khác biệt chỉ ở diff code (không đụng `profileBuilder.js`). Nếu Capu vẫn muốn mở rộng ở profile thì ghi vào `decisions/`; eval không đổi vì chỉ kiểm hành vi.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-072-style-chung` · Vùng (`area`): `planner/vendor/matching`
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret, INV-002 số cái đọc được) và `planner/`, `planner/vendor/` (hiện chỉ có `images/`); vùng `planner/vendor/matching` chưa có bất biến riêng. Spec không vi phạm INV nào. Đã đọc lại ở vòng rework: không có bất biến mới nào được thêm cho vùng.
- Kiến trúc: JS và Python phải chấm cùng luật nhưng được cài riêng; bảng `expansion` và `labels_vi` nên đọc từ một nguồn trong mỗi ngôn ngữ, bằng với `style-cases.json` (eval kiểm hành vi, không kiểm cách cài).
- Không chạm: front (`STYLE_TAG_MAP` giữ nguyên), schema dữ liệu lưu, prompt/LLM, `profileBuilder.js`, pool vendor, trọng số các tín hiệu khác. Câu LLM per-vendor trong `api/vendors.js` (hàm sinh `sentence`) không thuộc phạm vi này.
- Bậc đề xuất: B (đổi logic xếp hạng, không chạm tiền/auth/schema/dữ liệu người dùng).

## Tiêu chí chấp nhận và eval
Biến môi trường chung: `TOHONG_BACK_REPO` (đường dẫn repo `tohong-back`); không đặt thì thử cwd rồi `../tohong-back`. Cần node >= 18 và python3; chạy từ gốc `tohong-hq`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | File ca JSON chạy chung cho Node và Python; 18 ca cho cùng điểm style ở hai đường, đúng giá trị kỳ vọng, và `styleCoverage` đúng; bản chép trong repo giống file gốc từng byte | `python3 -I eval/T-072/check_1_ca_chung.py` |
| 2 | Hai vendor giống hệt, một tag lệch, một không tag: cùng tổng điểm (JS trên vendor thật của pool, Python); vendor khớp cao hơn cả hai | `python3 -I eval/T-072/check_2_khong_phat_thieu_tag.py` (cùng lệnh với 3a: một file, hai nhóm kiểm) |
| 3a | Hai vendor chỉ khác ở chỗ khớp gu: vendor khớp xếp trên (đo thứ tự): JS danh sách đầy đủ của hạng mục trên vendor thật của pool; Python stage 2; Python đường chat đầy đủ qua MMR (R8). (Cùng file với tiêu chí 2, vì cùng cặp vendor sinh đôi.) | `python3 -I eval/T-072/check_2_khong_phat_thieu_tag.py` |
| 3b | 6 style × ảnh cưới, makeup, áo cưới, nhà hàng × 4 hồ sơ trên pool thật: tổng số vendor khớp trong top 10 trên 96 tổ hợp không ít hơn bản hiện tại (baseline 561) | `python3 -I eval/T-072/check_3_top10_pool_that.py` |
Tình trạng hiện tại (trước khi cài): `check_1`, `check_2`, `check_4` đỏ bằng FAIL, không ERROR. `check_3` PASS ở bản hiện tại (561 → 561) vì 3b là phép chống thoái lui, không phải phép đo tính năng mới; trên bản tham chiếu `check_2` và `check_3` PASS (3b: 561 → 615). Ghi chú về 3b: "khớp" do eval tự tính từ tag trong pool và bảng `expansion`, không tin `styleCoverage`; `baseline-top10.json` đo một lần trên commit 6a9a9c7 và gắn với sha của pool (pool đổi thì `check_3` FAIL với lý do "baseline đo trên pool khác": Product đo lại trên bản trước thay đổi, không sửa tay); "vendor đủ điều kiện" = cùng category, `isVerified`, city HCMC, rating = 0 hoặc >= 3.5. Về tiêu chí 1 và 4: không đổi so với v1.

## Bất biến đề xuất (tầng 2)
Vùng `planner/vendor/matching`:
1. Thiếu tag không bị phạt: hai vendor chỉ khác tag (lệch so với không tag) luôn cùng tổng điểm ở cả hai đường, và vendor khớp luôn cao hơn. Bản chạy được: `eval/T-072/inv-proposed-khong-phat-thieu-tag.py`.
2. (Thay đề xuất cũ "khớp luôn đứng trước", đã bỏ theo ADR-026.) Thứ tự gu nhất quán: hai vendor chỉ khác ở chỗ khớp gu thì vendor khớp xếp trên ở danh sách JS, Python stage 2 và đường chat Python sau MMR (R8). Bản chạy được: phần 3a trong `check_2_khong_phat_thieu_tag.py`. Không đề xuất bất biến nào nói "khớp luôn đứng trước mọi vendor không khớp".

## Không làm
Thêm style mới; đổi trọng số tín hiệu khác; dùng phần trăm style để chấm; làm sạch tag (issue #17); sửa front; sửa câu LLM per-vendor; đổi `profileBuilder.js`; sửa hai ca đỏ sẵn của `test_matcher.py`.

## Câu hỏi mở
(Một câu, cần Chief of Staff/Capu.) Tiêu chí 3b nguyên văn ADR-026 ("mỗi tổ hợp style × hạng mục, số vendor khớp trong top 10 không ít hơn bản hiện tại") không đạt được bằng R3: 12/96 tổ hợp tụt (7/24 nếu gộp 4 hồ sơ), vì tag lệch hết bị phạt 0 nên cạnh tranh được hơn, đúng ý "không phạt". Tôi dùng **tổng 96 tổ hợp không ít hơn baseline (561 → 615)** làm phép đo, kèm danh sách tụt. Capu có chấp nhận việc một số tổ hợp (chủ yếu hồ sơ ngân sách 80tr; luxury, traditional, rustic × ảnh cưới hoặc áo cưới) có ít vendor khớp trong top 10 hơn hiện nay không? Nếu không, cách duy nhất giữ "mỗi tổ hợp" là dành chỗ cho vendor khớp (cách C) hoặc ưu tiên tuyệt đối (cách A), tức là đảo ADR-026.

Ghi chú cho người đọc: phạm vi R8 là quan hệ thứ tự gu chứ không phải thứ tự đầy đủ giống hệt giữa hai đường; ADR-026 mục 3 viết "cùng thứ tự với cùng hồ sơ", tôi hiểu theo nghĩa hẹp này vì trọng số hai đường khác nhau và việc này không đổi trọng số. Nếu hiểu rộng hơn thì cần việc riêng thống nhất trọng số.
