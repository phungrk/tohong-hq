# Spec T-072: Hợp đồng style chung cho hai đường matching

## Ý định
Capu (issue #16): cặp đôi chọn style thì vendor khớp style phải lên trước, vendor thiếu tag không bị phạt, hai đường matching (JS `lib/vendorMatcher.js`, Python `matcher/stage2_scoring.py`) chấm style bằng cùng một luật, và lời giải thích nói tiếng Việt chứ không in tag thô.

## Bằng chứng
- Pool thật `tohong-back/lib/vendorPool.generated.js`: 968 vendor, 454 không tag style, 514 có tag. Tôi đếm lại bằng node: tổng vendor không tag theo 10 category = 454 (khớp con số trong issue). Tần suất tag: luxury 247, modern 198, traditional 128, minimalist 124, simple 91, soft 58, natural 27, korean 24, rustic 22, editorial 3.
- Đọc code: JS `styleScore` trả 0.5 khi thiếu tag, 0 khi tag lệch, 1 khi khớp; Python `score_style` trả 0.0 khi thiếu tag và `overlap/len(prefs)` (phân số) khi có tag. Hai đường đang chấm khác nhau cho cùng ca.
- Front `STYLE_TAG_MAP` (`phungrk/tohong-front/src/App.jsx:267`) chỉ đổi `han → korean`; không vendor nào được gắn tag `soft` được tính cho cặp đôi chọn Hàn.
- Luật cộng điểm 1.0/0.5 giữ trọng số hiện có (JS 0,35 style) chỉ hơn vendor không khớp 17,5 điểm, ít hơn biên độ lịch + ngân sách (45 điểm); nên khớp gu không bao giờ là ưu tiên tuyệt đối. ADR-026 (`decisions/2026-11-06-adr-026-t072-gu-la-tin-hieu-cong-diem.md`, Chief of Staff chọn cách B thay Capu, Capu có thể đảo) chốt đây là thiết kế: gu là một tín hiệu cộng điểm, không đẩy vendor vượt ngân sách lên trước vendor đúng ngân sách. Defect: `handoffs/T-072-D1.md`.
- Số đo thật cho tiêu chí 3b. Lưới 96 tổ hợp = 6 style × 4 hạng mục (ảnh cưới, makeup, áo cưới, nhà hàng) × 4 hồ sơ của `style-cases.json`; "khớp" tính theo R2 từ tag trong pool thật; đo ở top 10 của `computeMatches` (JS).
  - Đo ở vòng 2 trên pool @6a9a9c7 (968 vendor): code hiện tại 561 vendor khớp trong top 10 trên 96 tổ hợp; bản tham chiếu R3 + R2 (bản cài tạm của tôi, ngoài repo) 615 (+54). 17/96 tổ hợp tăng, 67 bằng, **12/96 tụt** (tụt nhiều nhất: traditional × ảnh cưới × 80tr, 8→4; luxury × ảnh cưới × 80tr, 8→5; korean × áo cưới, 3→0 ở hai hồ sơ). Gộp 4 hồ sơ theo từng cặp style × hạng mục thì 7/24 cặp vẫn tụt. Không cần so lại con số này: baseline không còn là số lưu cứng (xem dưới).
  - Nguyên nhân tụt: hiện tại tag lệch bị 0 điểm style nên vendor khớp hơn vendor lệch tới 35 điểm; R3 đưa vendor lệch về 0,5 (đúng mục đích "không phạt") nên khoảng cách còn 17,5 và vendor lệch đúng ngân sách/lịch vượt lên. Tụt là hệ quả trực tiếp của ý định, không phải lỗi cài đặt.
  - Quyết định về phép đo: tiêu chí 3b là **tổng** trên 96 tổ hợp, không phải từng tổ hợp (Chief of Staff chấp nhận, ghi ở `handoffs/T-072-D2.md`; ADR-026 `decisions/2026-11-06-adr-026-t072-gu-la-tin-hieu-cong-diem.md`; comment cập nhật 3b ở issue #16, comment 6674849336). Danh sách tổ hợp tụt in kèm khi chạy `check_3`, và đưa vào Diff hành vi của bàn giao.
  - Pool đang đổi dưới chân (việc T-073 đã `done`, T-075 đang hiện thực tạo lại pool: `minimalist` 124 → khoảng 6 tag, vendor lệch theo R2 vì `minimalist` thuộc phần mở rộng của `modern`). Baseline vì vậy **không được lưu cứng**: `check_3` tự tính lại mỗi lần chạy (R9). Đã chạy thử trên working tree hiện tại của `tohong-back` (pool đã đổi so với @6a9a9c7, chưa commit): code ở merge-base chạy trên pool đó cho 559; bản tham chiếu R3 + R2 của tôi trên cùng pool cho 692, PASS. Con số 692 không phải cam kết, chỉ chứng tỏ phép đo vẫn có nghĩa khi pool đổi; pool cuối cùng của T-075 chưa có, **chưa xác nhận** 3b đạt trên pool cuối (xem R9 về ai quyết nếu không đạt).
- Python: đường chat đầy đủ (stage 1-3) hiện đã đảo thứ tự gu: pool 4 vendor khớp cùng tag + 4 không khớp, top_k 6 trả `m0, u0, u1, u2, u3, m1` (MMR phạt vendor trùng tag với vendor đã chọn, mạnh hơn 12,5 điểm chênh gu). Chỉ sửa `score_style` thì vẫn đảo (đã thử: cùng kết quả). Do đó R8.
- Tôi đã dựng bản cài đặt tham chiếu ở thư mục tạm (không nằm trong repo). Vòng 3 (rework D2): thêm vào đó một cài đặt stage 3 theo luật R8 mới (chỉ để thử eval): `check_2` PASS cả ca sinh đôi lẫn ca ngược; `check_3` PASS. Trên code hiện tại `check_2` FAIL (không ERROR) và `check_3` PASS (chống thoái lui, ref trùng HEAD). `check_1` và `check_4` không đổi logic nên không chạy lại trên bản tham chiếu.

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

**R8 Thứ tự gu nhất quán giữa hai đường.**
- Với cùng hồ sơ cặp đôi, hai vendor mà mọi thứ khác bằng nhau (giá, rating, lịch, sức chứa, cùng category, và không khác nhau ở bất kỳ tín hiệu nào ngoài chỗ khớp/không khớp gu) thì vendor khớp xếp trên vendor không khớp (tag lệch hoặc không tag), ở: danh sách đầy đủ trả về của `computeMatches` (JS, không chỉ khi so tổng điểm); kết quả `score_and_rank` (Python stage 2).
- Đường chat Python (kết quả cuối `WeddingMatcher.match` sau boost và MMR): giữa một vendor khớp và một vendor không khớp, vendor có điểm sau boost cao hơn đứng trên (bằng điểm thì vendor khớp đứng trên), và MMR không được tạo ra thứ tự trái điều đó. **Luật này áp cả cho vendor bị loại khỏi `top_k`**: tập ứng viên là mọi vendor sau boost (stage 1, stage 2 top 20, boost); không vendor nào trong kết quả có điểm sau boost thấp hơn một vendor khác nhóm (khớp/không khớp) bị loại khỏi kết quả, kể cả khi kết quả chỉ gồm một nhóm. Bằng điểm thì vendor khớp được ưu tiên. Nói cách khác: nếu coi vendor bị loại là đứng dưới toàn bộ kết quả, thì thứ tự nối "kết quả rồi vendor bị loại" không được có cặp khớp/không khớp nào đảo theo điểm.
Hệ quả của dòng chat, nói rõ để không đọc sai (cài "chia nhóm, vendor khớp lên trước rồi mới lấy vendor không khớp" vi phạm R8 vì bỏ vendor không khớp điểm cao ra ngoài kết quả; eval có ca bắt đúng cách này): khớp gu không phải khoá chia nhóm; vendor khớp gu có điểm sau boost thấp hơn rõ (vượt ngân sách, rating thấp) đứng dưới vendor không khớp có điểm cao hơn, như ở thẻ vendor JS (ADR-026 mục 1 và 3). Phạm vi của R8 là **quan hệ thứ tự giữa vendor khớp và không khớp**, không phải thứ tự đầy đủ giống hệt giữa hai đường: trọng số các tín hiệu khác nhau giữa JS (35/25/20/10/10) và Python (style 25), và spec này không đổi trọng số.

**R9 Baseline của 3b tự tính, không lưu cứng.** `check_3` tính baseline mỗi lần chạy: lấy code chấm điểm của ref (mặc định merge-base của HEAD với `origin/main` trong repo `tohong-back`; đặt `TOHONG_BASE_REF=<ref>` hoặc đối số thứ nhất để ghi đè) bằng `git archive` ra thư mục tạm, thay pool trong đó bằng đúng file `lib/vendorPool.generated.js` đang có trong repo, rồi đo cùng 96 tổ hợp ở hai phía. Hệ quả:
- Không có `baseline-top10.json` và không có sha pool; không ai phải đo lại tay, kể cả khi pool đổi, nên không có việc nào cần "ai chạy, khi nào" và không có chỗ nào trông giống sửa eval cho khớp code (Engineering và Product không đụng vào baseline).
- T-075 (tạo lại pool) merge trước hay sau T-072 đều được: Engineering rebase T-072 lên `main` mới nhất trước khi chạy gate; hai phía luôn đo trên cùng một pool, nên đổi `minimalist` 124 → 6 chỉ làm đổi cả hai con số, không làm gate đỏ vì lý do ngoài code.
- Nếu merge-base trùng HEAD (T-072 chưa có commit, hoặc đã merge) thì hai lần đo cùng code, PASS tầm thường.
- Nếu 3b FAIL sau khi T-075 đã vào `main` và code T-072 không đổi: đó là kết quả đo thật trên pool mới (R2 làm `minimalist` mất 118 vendor khớp `modern`), không phải lỗi của eval. Chief of Staff quyết (không phải Engineering): hoặc chấp nhận kèm danh sách tụt trong Diff hành vi, hoặc đổi tiêu chí 3b bằng `decisions/`.

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
| 3a | Hai vendor chỉ khác ở chỗ khớp gu: vendor khớp xếp trên (đo thứ tự): JS danh sách đầy đủ của hạng mục trên vendor thật của pool; Python stage 2; Python đường chat đầy đủ qua MMR (R8), tính cả vendor bị loại khỏi top_k (eval tự dựng danh sách ứng viên sau boost, không phụ thuộc cách cài). (Cùng file với tiêu chí 2, vì cùng cặp vendor sinh đôi.) | `python3 -I eval/T-072/check_2_khong_phat_thieu_tag.py` |
| 3b | 6 style × ảnh cưới, makeup, áo cưới, nhà hàng × 4 hồ sơ trên pool thật: tổng số vendor khớp trong top 10 trên 96 tổ hợp, với code mới, không ít hơn với code ở merge-base `origin/main`, cả hai đo trên pool hiện tại (R9) | `python3 -I eval/T-072/check_3_top10_pool_that.py` |
| 4 | Không tag thô trong `reasons[].label`, `whyThisVendor`, `whyThoseVendors`, dòng "Phù hợp vì" của `formatMatchBlock`; không nói gu/phong cách/style khi `matched = 0`; nhãn tiếng Việt của style cặp đôi đã chọn khi `matched >= 1`; API trả `styleCoverage {matched,total}` (R5, R6) | `python3 -I eval/T-072/check_4_giai_thich_va_coverage.py` |
Tình trạng hiện tại (trước khi cài): `check_1`, `check_2`, `check_4` đỏ bằng FAIL, không ERROR. `check_3` PASS ở bản hiện tại vì 3b là phép chống thoái lui, không phải phép đo tính năng mới; trên bản tham chiếu `check_2` và `check_3` PASS. Ghi chú về 3a: ca đường chat có hai ca, **sinh đôi** (4 vendor khớp cùng tag + 4 không khớp, mọi thứ khác bằng nhau, top 6: mọi vendor khớp đứng trên) và **ngược** (6 vendor khớp rating 3,6, 10 đánh giá, giá 30–90tr tức trần giá gấp 3 lần ngân sách 30tr; 6 vendor không khớp rating 4,9, 300 đánh giá, giá 18–21tr đúng ngân sách; top 5: vendor không khớp phải đứng trên, vì điểm sau boost khoảng 61,3–62,2 so với khoảng 55,9). Ca ngược dựng theo ca của Spec critic (`handoffs/T-072-D2.md`); tôi chỉnh số đánh giá (10 so với 300) vì không dựng lại được đúng điểm 72,5/62,7 từ mô tả, nhưng giữ đúng cấu trúc (khớp: rating thấp, giá tới 3 lần ngân sách; không khớp: rating cao, đúng ngân sách) và đúng kết quả cần loại: cách chia nhóm cho top 5 toàn vendor khớp điểm thấp hơn, FAIL. Hai ca dùng chung một phép kiểm duy nhất: trên danh sách nối "kết quả cuối, rồi ứng viên sau boost bị loại khỏi top_k (điểm giảm dần)", với mọi cặp (vendor khớp, vendor không khớp) vendor điểm cao hơn đứng trên, bằng điểm thì vendor khớp đứng trên. Số điểm ở ca ngược: dưới code hiện tại vendor không khớp ~61,3–62,2 (tag lệch bị chấm 0); dưới R3 chúng là ~74 vì style 0,5 (vendor khớp ~55,9). Kết luận không đổi: vendor không khớp đúng ngân sách đứng trên. Kiểm chéo đã chạy (scratchpad, không nằm trong repo): bản đúng PASS; bản "chia nhóm" FAIL (ca ngược: m0 55,85 đứng trên u2 74,66); bản "MMR chọn tập rồi sắp lại theo điểm" FAIL (ca sinh đôi: u0 70,19 đứng trên m2 82,69 bị loại); code hiện tại FAIL. Ghi chú về 3b: "khớp" do eval tự tính từ tag trong pool và bảng `expansion`, không tin `styleCoverage`; "vendor đủ điều kiện" = cùng category, `isVerified`, city HCMC, rating = 0 hoặc >= 3.5. Về tiêu chí 1 và 4: không đổi logic so với v1.

## Bất biến đề xuất (tầng 2)
Vùng `planner/vendor/matching`:
1. Thiếu tag không bị phạt: hai vendor chỉ khác tag (lệch so với không tag) luôn cùng tổng điểm ở cả hai đường, và vendor khớp luôn cao hơn. Bản chạy được: `eval/T-072/inv-proposed-khong-phat-thieu-tag.py`.
2. (Thay đề xuất cũ "khớp luôn đứng trước", đã bỏ theo ADR-026.) Thứ tự gu nhất quán: hai vendor chỉ khác ở chỗ khớp gu thì vendor khớp xếp trên ở danh sách JS và Python stage 2; ở đường chat Python sau MMR, giữa vendor khớp và không khớp thì vendor điểm cao hơn đứng trên (R8). Bản chạy được: phần 3a trong `check_2_khong_phat_thieu_tag.py`. Không đề xuất bất biến nào nói "khớp luôn đứng trước mọi vendor không khớp".

## Không làm
Thêm style mới; đổi trọng số tín hiệu khác; dùng phần trăm style để chấm; làm sạch tag (issue #17); sửa front; sửa câu LLM per-vendor; đổi `profileBuilder.js`; sửa hai ca đỏ sẵn của `test_matcher.py`.

## Câu hỏi mở
Không còn câu hỏi mở. Câu cũ về 3b (12/96 tổ hợp tụt nếu đo từng tổ hợp) đã đóng: Chief of Staff chấp nhận phép đo **tổng** trên 96 tổ hợp (ghi ở `handoffs/T-072-D2.md`), theo ADR-026 (`decisions/2026-11-06-adr-026-t072-gu-la-tin-hieu-cong-diem.md`) và comment cập nhật 3b ở issue #16 (comment 6674849336). Danh sách tổ hợp tụt vẫn in khi chạy `check_3` và nằm trong Diff hành vi. Việc còn treo ngoài spec (không phải câu hỏi cho Capu): 3b trên pool cuối của T-075 chưa đo được; nếu đỏ thì Chief of Staff quyết theo R9.

Ghi chú cho người đọc: phạm vi R8 là quan hệ thứ tự gu chứ không phải thứ tự đầy đủ giống hệt giữa hai đường; ADR-026 mục 3 viết "cùng thứ tự với cùng hồ sơ", tôi hiểu theo nghĩa hẹp này vì trọng số hai đường khác nhau và việc này không đổi trọng số. Nếu hiểu rộng hơn thì cần việc riêng thống nhất trọng số.

## Đã sửa ở vòng rework D2
- R8 gạch 3: bỏ câu "đa dạng hoá MMR vẫn được xáo trong nhóm khớp... không xuyên nhóm" (cho phép chia nhóm, tức R4 quay lại ở chat). Thay bằng một luật theo điểm sau boost (luật theo điểm; không phải "cách C dành chỗ" của ADR-026). Eval 3a thêm ca ngược.
- Ghi chú 3b "đo lại trên bản trước thay đổi" (ba cách hiểu): bỏ; thay bằng R9, baseline tự tính từ merge-base trên pool hiện tại, xoá `baseline-top10.json`.
- Minor: thêm dòng tiêu chí 4 vào bảng; đóng câu hỏi mở 3b.

## Đã sửa ở vòng rework D3 (v4)
- R8 gạch 2: thêm vế "kể cả vendor bị loại khỏi `top_k`" (câu cũ chỉ so cặp trong kết quả cuối nên cách chia nhóm, top 5 toàn vendor khớp, không có cặp nào để so). Đổi tên "cách C" trong chú thích R8 để không trùng "cách C" của ADR-026 (minor D3).
- `check_2` nhận danh sách ứng viên sau boost: `lib/run_py.py rank` trả `{top, ung_vien}` cho mỗi ca chat, `ung_vien` do eval tự dựng bằng `apply_hard_filters` + `score_and_rank` + `apply_boosts` (không đi qua `WeddingMatcher.match`); `check_2` nối kết quả với ứng viên bị loại rồi chạy cùng `cross_violations`. Giữ nguyên ADR-026 (Capu chọn phương án 1, `inbox/capu/T-072-r8-khoa-eval.md`).
- Kiểm chéo ba bản cài (scratchpad): đúng PASS; chia nhóm FAIL; sắp lại sau MMR FAIL; code hiện tại FAIL.
