# Spec T-074: Bộ eval top 5 trên pool thật, nhãn do người ngoài chấm mù

Phiên bản v2 (sau Spec Gate vòng 1 và quyết định của Capu 2026-11-06, `inbox/capu/T-074-dinh-nghia-phu-hop-va-cach-do.md`). Xem mục Lịch sử sửa ở cuối.

## Ý định
Capu (issue #21): đo xem top 5 vendor mà matching trả về có thực sự "phù hợp" hay không, bằng nhãn của người ngoài chấm mù, vì review độc lập chỉ ra eval do chính người đặt trọng số tự chấm là tuần hoàn. Gắn với NSM "số cặp đôi mỗi tháng liên hệ được ít nhất 1 vendor phù hợp" (`/home/claude/tohong/docs/product/nsm.md`) và ưu tiên #1 "cặp đôi tin được lời khuyên" (`vision.md`).

## Bằng chứng
- Pool thật: 968 vendor, 10 hạng mục, 100% TP.HCM, 100% `isVerified` (chạy `computeMatches`/`VENDOR_POOL` trong `tohong-back/lib/vendorMatcher.js`, 2026-11-06). 4 hạng mục chính: photography 90, makeup 98, attire 85, venue 96.
- Tag style của pool thưa ở vài ô: venue có 0 vendor gắn `korean`; attire 0 vendor `natural`; makeup 0 vendor `rustic`; photography chỉ 1 vendor `natural`. Chạy 30 hồ sơ ở dưới: số vendor khác nhau xuất hiện trong top 5 mỗi hạng mục chỉ 27–35 (photography 35, makeup 27, attire 27, venue 33).
- Giá nghi là giá mặc định (chưa xác nhận): photography 57/90 vendor có `priceMax`=30; makeup 83/98 =8; attire 65/85 =25; venue 44/96 =15. Sức chứa venue: 96/96 vendor cùng `100–300`, nên thẻ chấm không hiện sức chứa.
- Trong 30 hồ sơ mẫu, số vị trí top 5 trượt luật máy (A hoặc B ở dưới) chỉ 6/150 photography, 11/150 makeup, 0/150 attire, 4/150 venue (tính bằng `eval/T-074`, không phải nhãn người). Nghĩa là phần quyết định "phù hợp" nằm ở người chấm, không ở luật máy.
- Hai con số còn lại (10 điểm là quyết định của Capu; phủ nhãn 80% là đề xuất của Spec Writer) xem mục Luật so với baseline. Tự tin ~50% cho con số phủ nhãn.

## Giả thuyết
Nếu nhãn người gắn với (hồ sơ, vendor) chứ không gắn với thứ hạng, thì mỗi lần đổi trọng số ta chạy lại một lệnh và biết matching tốt lên hay xấu đi so với bản trước, không phải chấm lại. Chỉ số bảo vệ: không ai chỉnh matching cho khớp nhãn (đổi hồ sơ hoặc thẻ vendor thì nhãn vô hiệu).

## Hành vi

### Định nghĩa "vendor phù hợp" (Capu đã chốt)
Một vendor V là phù hợp với hồ sơ cặp đôi P ở hạng mục C khi cả ba điều đúng:
- (A) qua tầng lọc với dữ liệu thật: V thuộc hạng mục C, cùng thành phố với P, `isVerified` đúng, và (chưa có rating hoặc rating >= 3.5). Máy kiểm từ dữ liệu thô của pool.
- (B) giá vừa ngân sách hạng mục: giá thấp nhất V công bố (`priceMin`) <= ngân sách của P cho hạng mục C ("có ít nhất một gói vừa túi"). Bằng nhau thì đạt. Thiếu giá thì không đạt. Máy kiểm. Không dùng `priceMax`; hướng dẫn chấm nói rõ luật này để người chấm không tự áp `priceMax`.
- (C) đa số trong 3 người chấm của ô đó (>= 2 trên 3) trả lời "co" cho câu hỏi cố định, nguyên văn: **"Với cặp đôi này, anh/chị có khuyên họ liên hệ vendor này không?"** (co/khong). Dưới 3 nhãn hợp lệ (kể cả nhãn gắn với thẻ vendor đã đổi) là "chưa chấm", không phải "không". Mỗi ô đúng 3 người nên không có hoà.

Gói chấm gửi người chấm có `HUONG_DAN.md` gồm: câu hỏi nguyên văn; cách xét (đặt mình vào vị trí tư vấn cho đúng cặp đôi, dựa vào thẻ, không tra ngoài); luật giá (mọi vendor trên gói đã có ít nhất một gói trong ngân sách, đừng trừ điểm vì giá cao nhất vượt ngân sách); đơn vị giá địa điểm tiệc (triệu đồng mỗi bàn); ba ví dụ minh hoạ (hai "co"/"khong" rõ và một "khong" vì thẻ sơ sài không cho thấy hợp), vendor và cặp đôi giả.

Khác matcher có chủ ý: luật máy (A, B) viết lại độc lập từ dữ liệu thô của pool, không dùng trọng số hay điểm của matcher; (B) lỏng hơn matcher (matcher dùng `priceMax` và dung sai 20%).

### Cách đo (Capu chọn phương án C)
Mỗi ô (hồ sơ x hạng mục) người chấm chấm một **tập ứng viên** gồm: top 15 của matcher hiện tại (`computeMatches(P, {category: C, limit: 15})`, lớp ghi đè admin để rỗng, pool gốc) giữ lại những vendor qua luật máy A và B (trượt A/B thì không cần chấm vì đã là "không phù hợp"), cộng đúng 5 vendor ngẫu nhiên (seed cố định) cũng qua A và B nhưng ngoài top 15. Ứng viên được trộn thứ tự; người chấm không biết vendor nào do máy chọn, vendor nào ngẫu nhiên.

Vì nhãn gắn với (hồ sơ, vendor), khi trọng số đổi thì top 5 mới phần lớn vẫn nằm trong 15 vendor đã chấm, nên đo lại không cần chấm lại.

**Tỉ lệ trùng top 5 của C** = số vị trí top 5 phù hợp / số vị trí top 5 đã được chấm, gộp 30 hồ sơ (tối đa 30 x 5 = 150 vị trí). Quy tắc từng vị trí trong top 5 hiện tại:
- trượt luật máy A hoặc B: không phù hợp, tính vào mẫu số (không cần nhãn).
- hệ thống trả ít hơn 5: phần thiếu là không phù hợp, tính vào mẫu số.
- có đủ 3 nhãn: phù hợp theo đa số, tính vào mẫu số.
- thiếu nhãn (vendor mới ngoài tập đã chấm, hoặc thẻ vendor đã đổi): **chưa chấm** — không vào mẫu số, không vào tử số, được liệt kê vào `t074-unlabeled.json`. Làm vậy để vendor mới vào top 5 không làm tỉ lệ tụt giả.
**Phủ nhãn của C** = số vị trí đã chấm hoặc đã quyết bằng luật máy / 150. Phủ nhãn dưới 80% ở bất kỳ hạng mục nào thì lệnh FAIL "phủ nhãn" (xem Luật so với baseline), vì tỉ lệ tính trên quá ít vị trí không so được.

Đây là precision@5 trên vị trí đã chấm, không phải recall: eval không bắt được việc "vendor tốt không bao giờ được hiện". Vendor ngẫu nhiên chỉ để tham khảo: lệnh in tỉ lệ "phù hợp" của chúng (cùng định nghĩa) bên cạnh để thấy người chấm có khen tất cả không; không có ngưỡng và không quyết PASS/FAIL. Lệnh in thêm khoảng ±95% theo hồ sơ (độ lệch chuẩn của tỉ lệ từng hồ sơ / căn 30).

### Một lệnh
`node eval/T-074/match_eval.mjs [--labels <file>] [--baseline <file>] [--save-baseline]` (chạy tại gốc sổ cái; tìm matcher ở `../tohong-back`, đổi bằng biến `TOHONG_BACK`). In bảng mỗi hạng mục: số ô, phù hợp/đã chấm, tỉ lệ, ±95%, phủ nhãn, tỉ lệ vendor ngẫu nhiên, độ lệch so với baseline. Dòng cuối luôn bắt đầu bằng `PASS` hoặc `FAIL <lý do>`; mã thoát 0 chỉ khi PASS.
- Chưa có `eval/T-074/labels.json` (nhãn thật): `FAIL chưa có nhãn thật: ...`, mã thoát 1.
- Nhãn mẫu (`is_sample: true`): in số liệu (chỉ trên hồ sơ có nhãn) nhưng dòng cuối luôn là `FAIL nhãn mẫu ...`. Nhãn mẫu không bao giờ cho PASS và không ghi được baseline.
- Có nhãn thật, chưa có `eval/T-074/baseline.json`: **lần đầu chỉ đo**. In bảng, dòng cuối `PASS baseline lần đầu, không có ngưỡng đạt/rớt (...)` (mã 0) nếu phủ nhãn >= 80%. `--save-baseline` ghi `baseline.json` (tỉ lệ 4 hạng mục, băm nhãn, băm hồ sơ, băm pool, ngày). Ghi đè baseline đã có bị từ chối; đặt baseline mới là quyết định của Capu, ghi vào `decisions/`.
- Đã có baseline: hạng mục nào tụt **nhiều hơn 10 điểm** so với baseline thì `FAIL tụt quá 10 điểm so với baseline: ...`; tụt đúng 10 điểm hoặc ít hơn, hoặc tốt lên, là đạt. Nếu băm nhãn hoặc hồ sơ khác với lúc ghi baseline: `FAIL ... baseline vô hiệu`.

### 30 hồ sơ mẫu (`eval/T-074/profiles.json`)
Sinh bằng luật cố định (`lib/gen_profiles.py`), không nhìn kết quả matcher. 6 style x 5 hồ sơ; 3 mức ngân sách L/M/H, mỗi mức đúng 10 hồ sơ, mỗi style đủ cả 3 mức; mọi hồ sơ ở TP.HCM, cưới tháng 5–11/2027, 80–400 khách. Hồ sơ thứ 3 của mỗi style thêm một style phụ để có hồ sơ pha trộn. Ngân sách tối đa mỗi hạng mục (triệu đồng; riêng venue là triệu đồng **mỗi bàn**, cùng đơn vị với giá hiển thị trên thẻ địa điểm tiệc):

| Mức | photography | makeup | attire | venue (mỗi bàn) |
| --- | --- | --- | --- | --- |
| L | 8 | 4 | 8 | 4 |
| M | 20 | 8 | 15 | 8 |
| H | 35 | 15 | 30 | 15 |

Các mức chọn để cắt qua các cụm giá phổ biến của pool (30 / 8 / 25 / 15) nên ngân sách có tác dụng loại vendor. 6 style x 3 mức x 4 hạng mục = 72 tổ hợp, 30 hồ sơ x 4 hạng mục = 120 ô chấm; phủ mỗi (style, mức) ít nhất 1 hồ sơ, KHÔNG phủ đủ từng tổ hợp ba chiều (chi phí chấm). Ô thiếu hàng (vd korean x venue không vendor nào gắn tag) vẫn tính: cặp đôi thật cũng nhìn thấy kết quả đó.

### Định dạng file nhãn (`eval/T-074/labels.json`, `schema: t074-labels/v1`)
```
{ "schema": "t074-labels/v1", "is_sample": false, "profiles_sha": "<băm profiles.json>",
  "graders": [ { "id": "G1", "relationship": "external",
                 "declaration": { "saw_system_scores": false, "touched_matching_weights": false } }, ... 3 đến 5 ],  // relationship lấy từ khai báo is_external của người chấm
  "labels": [ { "profile": "P01", "category": "photography", "vendor": "marry_xxx", "grader": "G1",
                "fit": true, "role": "system|filler", "card": "<băm thẻ vendor lúc chấm>" }, ... ] }
```
Hợp lệ khi: 3–5 người chấm id khác nhau, mỗi người `external` và khai `saw_system_scores=false`, `touched_matching_weights=false`; mỗi nhãn ghi một người chấm có trong `graders`; không có nhãn trùng (hồ sơ, hạng mục, vendor, người chấm); `fit` là true/false; hạng mục thuộc 4 hạng mục chính; `profiles_sha` (16 ký tự đầu của sha256 nội dung `profiles.json`) khớp `profiles.json` hiện tại; không có trường lạ (không tên, email, số điện thoại: người chấm chỉ có mã G1..G5, bảng mã-người nằm ngoài repo, do Capu giữ).

### Quy trình chấm mù (người thực hiện ghi trong ngoặc)
1. (Capu) mời 3–5 người ngoài. "Ngoài" nghĩa là không phải Capu, không phải agent, không từng sửa trọng số matching. Giai đoạn A chưa thu nhãn từ cặp đôi thật (ngoài phạm vi).
2. (Capu hoặc Chief of Staff) `node eval/T-074/packets.mjs make --graders N --out <thư mục NGOÀI repo>`. Lệnh ghi `G1.csv`..`GN.csv` cho từng người và thư mục `_private/` (khoá vai trò, mẫu khai báo) giữ lại, không gửi.
3. Mỗi ô (hồ sơ x hạng mục) giao đúng 3 người, xoay vòng; mỗi ô gồm tối đa 15 vendor top của máy (đã qua luật A và B) cộng 5 vendor ngẫu nhiên, đã trộn thứ tự. Gói có `HUONG_DAN.md`. Người chấm thấy: mô tả cặp đôi (style bằng tiếng Việt, tháng cưới, số khách, ngân sách bốn hạng mục), tên, mô tả, giá hiển thị, rating và số đánh giá nếu có, tối đa 3 ảnh. KHÔNG thấy: điểm, hạng, lý do hệ thống, tag/style của vendor, vai trò (máy chọn hay ngẫu nhiên), mọi thứ về trọng số. Thẻ địa điểm tiệc ghi giá theo "triệu/bàn". Người chấm điền cột `phu_hop` bằng `co` hoặc `khong` cho từng dòng, không để trống, không trao đổi với nhau. Khối lượng: tối đa 120 ô x 20 ứng viên x 3 người = 7200 dòng, chia đều: 5 người ~1440 dòng mỗi người, 4 người ~1800, 3 người ~2400 (ít hơn nếu vài vendor trượt luật máy). Gấp khoảng hai đến ba lần bản v1 (560–940) vì tập ứng viên rộng hơn; thời gian chấm chưa đo, nên chia nhiều buổi và nên mời 5 người.
4. (Capu) mỗi người chấm điền khai báo vào `_private/declarations.json` (mẫu `declarations.template.json`, giá trị để null cho tới khi người đó xác nhận): `is_external` (không phải Capu, không phải agent), `saw_system_scores`, `touched_matching_weights`. Tiêu chí "người ngoài" vì thế là lời khai của chính người chấm, Capu chịu trách nhiệm mời đúng người; máy không tự kiểm được hơn.
5. (Capu hoặc Chief of Staff) `node eval/T-074/packets.mjs import --dir <thư mục> --out eval/T-074/labels.json`, rồi `node eval/T-074/match_eval.mjs --validate eval/T-074/labels.json` và `node eval/T-074/match_eval.mjs`.
6. Agent không được chấm, không được sửa nhãn, không được sửa `profiles.json` sau khi có nhãn (đổi là nhãn vô hiệu qua `profiles_sha`).

### Luật so với baseline
NGUONG_TUT_TOI_DA: 10
NGUONG_PHU_NHAN: 80

Capu chốt (2026-11-06): **lần đầu chỉ đo baseline, không có ngưỡng đạt/rớt**; từ lần hai, mỗi hạng mục không được tụt quá 10 điểm so với baseline (tỉ lệ trùng top 5 theo định nghĩa ở trên). Ngưỡng 80% tuyệt đối ở bản v1 và chốt chặn "hơn đối chứng 20 điểm" đã bỏ. Tiêu chí 3 của brief ("ngưỡng đạt đề xuất >= 80% ghi rõ trong spec kèm lý do") vì thế được thay bằng luật này theo quyết định của Capu.

Con số thứ hai, `NGUONG_PHU_NHAN: 80`, do Spec Writer thêm (không nằm trong quyết định của Capu): cần phủ nhãn >= 80% vị trí top 5 mỗi hạng mục để một lần đo có giá trị so sánh.

**Vì sao 10 điểm:** Capu chọn; với 30 hồ sơ mỗi hạng mục, dao động ngẫu nhiên của tỉ lệ khoảng ±14 điểm (95%), nên 10 điểm là mức chặn các tụt rõ rệt chứ không phải mức đo chính xác.
**Vì sao phủ nhãn 80:** nếu hơn 20% vị trí top 5 chưa có nhãn thì tỉ lệ đang tính trên một mẫu khác với baseline; thà FAIL "cần chấm thêm" còn hơn so hai con số không cùng mẫu. Đoán, tự tin ~40%.
**Đánh đổi:** luật tương đối chỉ nói "không xấu đi", không nói baseline có tốt không; một baseline thấp được coi là chuẩn. Baseline cố định nên mỗi lần đo so với mốc ban đầu, không so với lần trước: nhiều bước nhỏ cộng lại vẫn bị chặn khi tổng tụt quá 10 điểm. Phủ nhãn 80% có thể làm việc đổi trọng số mạnh FAIL tới khi chấm thêm.
**Điều kiện khiến sai:** (1) đơn vị giá địa điểm tiệc là giả định "triệu/bàn" (xem Rủi ro); nếu issue #22 cho đơn vị khác thì nhãn venue vô hiệu và phải chấm lại venue. (2) giá trong pool nghi là giá mặc định; nhãn theo giá giả lệch. (3) nhãn của 3 người lệch nhau nhiều (đa số 2/3 thường xuyên) thì baseline nhiễu hơn ±14. Khi đó đặt lại baseline, ghi vào `decisions/`, không đổi lặng lẽ.

## Ràng buộc (vòi)
- Repo: sổ cái `phungrk/tohong-hq`; không đổi code `tohong-back` · Nhánh: `claude/matching-intent` · Vùng: `planner/vendor/matching`
- Bất biến đã đọc: `eval/invariants/_shared/` (không secret trong repo, sổ cái đọc được), `eval/invariants/planner/` và `planner/vendor/` (chỉ có `images`; không có `planner/vendor/matching`). Spec này không vi phạm INV nào; nhãn không chứa dữ liệu cá nhân nên giữ được inv-001 `_shared`.
- Kiến trúc: eval chạy bằng Node (đã có trong sổ cái cho các eval front) và Python 3; chỉ đọc `tohong-back/lib/vendorMatcher.js`, không ghi.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng thật, vendor thật (không liên hệ vendor), dịch vụ trả phí. Người chấm là người thật do Capu mời: mọi liên hệ với họ do Capu làm; không agent nào gửi gì ra ngoài.
- Bậc đề xuất: A (như board) — là eval và tài liệu, không chạm ranh giới cứng. Lưu ý nâng lên B nếu sau này đưa ngưỡng vào bất biến chạy cho mọi việc ở vùng matching.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Một lệnh in tỉ lệ trùng top 5 (số %) cho từng hạng mục photography, makeup, attire, venue và dòng cuối bắt đầu bằng PASS hoặc FAIL | `bash eval/T-074/check_1_mot_lenh.sh` |
| 2 | Mỗi nhãn ghi người chấm; người chấm là người ngoài 3–5, khai (is_external) không thấy điểm và không sửa trọng số; file nhãn không có dữ liệu cá nhân; validator từ chối mọi biến thể hỏng | `python3 eval/T-074/check_2_nhan.py` |
| 3 | Luật "lần đầu chỉ đo baseline, từ lần hai không tụt quá 10 điểm" và ngưỡng phủ nhãn 80% ghi trong spec kèm vì sao, đánh đổi, điều kiện sai; lệnh eval dùng đúng số đó | `python3 eval/T-074/check_3_nguong.py` |
| 4 | 30 hồ sơ mẫu phủ 6 style (mỗi style 5), 3 mức ngân sách (10/10/10), đủ ngân sách 4 hạng mục, đều ở TP.HCM, không chứa kết quả matcher | `python3 eval/T-074/check_4_ho_so.py` |
| 5 | Gói chấm mù: không lộ điểm/hạng/style/tag/vai trò; 120 ô, mỗi ô đúng 3 người; mỗi ô tối đa 15 vendor top của máy + đúng 5 ngẫu nhiên, trộn thứ tự; tải đều; có `HUONG_DAN.md` với câu hỏi nguyên văn, luật giá priceMin, đơn vị triệu/bàn của địa điểm tiệc, ví dụ co/khong; import chặn khi thiếu khai báo | `python3 eval/T-074/check_5_cham_mu.py` |
| 6 | Chưa có nhãn thật thì FAIL rõ "chưa có nhãn thật" (mã thoát 1); nhãn mẫu không bao giờ cho PASS | `bash eval/T-074/check_6_thieu_nhan.sh` |
| 7 | Cách tính qua lệnh (matcher giả, người chấm giả có đáp án): đa số 2/3; luật máy loại vendor giá thấp nhất vượt ngân sách; vị trí chưa chấm ra khỏi mẫu số và báo phủ nhãn; lần đầu chỉ đo; tụt đúng 10 điểm đạt, 10,7 FAIL; tốt lên đạt; không ghi đè baseline; nhãn đổi làm baseline vô hiệu | `python3 eval/T-074/check_7_cach_tinh.py` |

Ghi chú về nhóm eval: các eval này kiểm bộ máy đo. Chúng xanh khi bộ máy đúng, KHÔNG phải khi matching tốt. Việc "matching không tụt so với baseline" là lệnh ở mục Một lệnh với nhãn thật, và đỏ cho tới khi có nhãn thật (xem Bất biến đề xuất). Phần máy (`match_eval.mjs`, `packets.mjs`, `lib/`) do Spec Writer viết cùng eval vì chính bộ máy đo là sản phẩm của việc này; Engineering rà và mở rộng, xem handoff.

## Bất biến đề xuất (tầng 2)
Đề xuất cho Spec critic rút vào `eval/invariants/planner/vendor/matching/`:
1. **Nhãn toàn vẹn** (luôn chạy): nếu `eval/T-074/labels.json` tồn tại thì phải qua `node eval/T-074/match_eval.mjs --validate` (người chấm ngoài 3–5, khai báo đủ, không dữ liệu cá nhân, `profiles_sha` khớp). Không có nhãn thì thoát 0 (chưa có gì để hỏng).
2. **Không tụt so với baseline** (chỉ bật khi `eval/T-074/baseline.json` tồn tại, tức Capu đã ghi baseline): `node eval/T-074/match_eval.mjs` phải PASS, nghĩa là không hạng mục nào tụt quá 10 điểm và phủ nhãn >= 80%. CẢNH BÁO: đỏ ở tầng 2 buộc spec rework theo hiến pháp; đổi pool (T-073) có thể làm phủ nhãn tụt dưới 80% và đỏ vì thiếu nhãn người chứ không vì matching kém. Spec critic cân nhắc, và nếu rút thì Chief of Staff ghi `decisions/` cách xử lý khi đỏ vì phủ nhãn (chấm thêm, không sửa spec). Nhãn và baseline không được nằm ở nơi agent code có quyền ghi một mình (Capu giữ bản gốc ngoài repo, so băm).

## Không làm
- Sửa matching, trọng số hay pool để khớp nhãn. Không agent nào chấm nhãn hay sinh nhãn thật; `labels.sample.json` là nhãn giả lập chẵn/lẻ của băm, chỉ để chạy thử đường.
- Thu nhãn từ cặp đôi thật; liên hệ vendor; thanh toán.
- Đo recall (vendor tốt không được hiện), đo thứ hạng bên trong top 5, đo hạng mục ngoài 4 hạng mục chính, đo tầng 2 và 3 của matching.
- Xác nhận giá hay đơn vị giá của pool (xem Rủi ro trong handoff).

## Câu hỏi mở
Một câu, cho người biết scraper (hoặc issue #22): giá trong pool của địa điểm tiệc (venue) là triệu đồng mỗi bàn hay trọn gói? Spec v2 giả định mỗi bàn (thẻ ghi "triệu/bàn", ngân sách venue 4/8/15 mỗi bàn). Nếu sai, nhãn venue phải chấm lại. Không chặn việc: Capu có thể mời người chấm cho 3 hạng mục còn lại trước.

## Lịch sử sửa
v2 (2026-11-06), sửa theo `handoffs/T-074-D1.md` và quyết định của Capu:
- Câu "Tỉ lệ trùng top 5 của C = số vị trí top 5 phù hợp / (30 x 5)" (D1 lỗi 1, hiểu lại thành precision@5): sửa thành mục Cách đo — người chấm chấm top 15 của máy + 5 ngẫu nhiên mỗi ô; mẫu số là vị trí đã chấm; vị trí chưa chấm ra khỏi mẫu số (v1 đếm vào mẫu số nên tụt giả).
- Câu (C) (D1 lỗi 2, ba cách hiểu: "đủ thông tin", "hợp", "thích gu"): thay bằng câu hỏi của Capu "Với cặp đôi này, anh/chị có khuyên họ liên hệ vendor này không?", đưa vào `HUONG_DAN.md` trong gói chấm với luật giá và ví dụ co/khong; check_5 kiểm gói có hướng dẫn đó.
- Mốc giá (B): giữ `priceMin` theo Capu, hướng dẫn chấm nói rõ để người chấm không tự áp `priceMax`; ứng viên đã được lọc theo (B) trước khi tới tay người chấm.
- Đơn vị giá venue (D1 lỗi 3): ghi "triệu/bàn" trên thẻ và trong mô tả cặp đôi và hướng dẫn, kèm giả định chưa xác minh (Câu hỏi mở).
- Ngưỡng 80% và chốt chặn "hơn đối chứng 20 điểm": bỏ theo Capu; thay bằng "lần đầu chỉ đo, từ lần hai không tụt quá 10 điểm". Thêm ngưỡng phủ nhãn 80% (Spec Writer đề xuất, có thể bỏ).
- D1 M1: check_7 viết lại, đo qua lệnh `packets.mjs` và `match_eval.mjs` với matcher giả (`TOHONG_BACK`) và người chấm giả; không còn import hàm nội bộ. check_5 bỏ cố định "đủ 12 cột".
- D1 M2: `relationship` không còn ghi cứng `external`; lấy từ khai báo `is_external` của người chấm; ghi rõ đây là lời khai.
- D1 M3 (người viết bộ máy cũng viết eval): giữ nguyên, báo Chief of Staff; Code Gate và adversary rà bộ máy.
- Bất biến đề xuất "Top 5 phù hợp" (>= 80%) đổi thành "Không tụt so với baseline", đúng như D1 gợi ý.
