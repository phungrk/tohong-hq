# Spec T-074: Bộ eval top 5 trên pool thật, nhãn do người ngoài chấm mù

## Ý định
Capu (issue #21): đo xem top 5 vendor mà matching trả về có thực sự "phù hợp" hay không, bằng nhãn của người ngoài chấm mù, vì review độc lập chỉ ra eval do chính người đặt trọng số tự chấm là tuần hoàn. Gắn với NSM "số cặp đôi mỗi tháng liên hệ được ít nhất 1 vendor phù hợp" (`/home/claude/tohong/docs/product/nsm.md`) và ưu tiên #1 "cặp đôi tin được lời khuyên" (`vision.md`).

## Bằng chứng
- Pool thật: 968 vendor, 10 hạng mục, 100% TP.HCM, 100% `isVerified` (chạy `computeMatches`/`VENDOR_POOL` trong `tohong-back/lib/vendorMatcher.js`, 2026-11-06). 4 hạng mục chính: photography 90, makeup 98, attire 85, venue 96.
- Tag style của pool thưa ở vài ô: venue có 0 vendor gắn `korean`; attire 0 vendor `natural`; makeup 0 vendor `rustic`; photography chỉ 1 vendor `natural`. Chạy 30 hồ sơ ở dưới: số vendor khác nhau xuất hiện trong top 5 mỗi hạng mục chỉ 27–35 (photography 35, makeup 27, attire 27, venue 33).
- Giá nghi là giá mặc định (chưa xác nhận): photography 57/90 vendor có `priceMax`=30; makeup 83/98 =8; attire 65/85 =25; venue 44/96 =15. Sức chứa venue: 96/96 vendor cùng `100–300`, nên thẻ chấm không hiện sức chứa.
- Trong 30 hồ sơ mẫu, số vị trí top 5 trượt luật máy (A hoặc B ở dưới) chỉ 6/150 photography, 11/150 makeup, 0/150 attire, 4/150 venue (tính bằng `eval/T-074`, không phải nhãn người). Nghĩa là phần quyết định "phù hợp" nằm ở người chấm, không ở luật máy.
- Mọi con số ngưỡng (80, 20) là phỏng đoán có lập luận, xem mục Ngưỡng. Tự tin ~50%.

## Giả thuyết
Nếu có đo độc lập này thì ta biết matching hiện tại có đưa được ít nhất 1 vendor cặp đôi muốn liên hệ vào top 3 hay không, trước khi dồn công vào chỉnh trọng số. Chỉ số bảo vệ: không ai chỉnh matching cho khớp nhãn (nhãn gắn với hồ sơ và thẻ vendor, không gắn với thứ hạng; đổi hồ sơ thì nhãn vô hiệu).

## Hành vi

### Định nghĩa "vendor phù hợp" (ĐỀ XUẤT, chờ Capu chốt)
Một vendor V là phù hợp với hồ sơ cặp đôi P ở hạng mục C khi cả ba điều đúng:
- (A) qua tầng lọc với dữ liệu thật: V thuộc hạng mục C, cùng thành phố với P, `isVerified` đúng, và (chưa có rating hoặc rating >= 3.5). Máy kiểm từ dữ liệu thô của pool.
- (B) giá trong ngân sách hạng mục: giá thấp nhất V công bố (`priceMin`) <= ngân sách của P cho hạng mục C. Bằng nhau thì đạt. Thiếu giá thì không đạt. Máy kiểm.
- (C) cặp đôi thấy đủ lý do để liên hệ: đa số tuyệt đối trong các người chấm của ô đó trả lời "có" cho câu hỏi cố định: "Nếu bạn là cặp đôi này, thông tin trên thẻ này có đủ để bạn muốn nhắn hoặc gọi vendor này không?" (co/khong). Hoà (vd 2/4) là "không". Dưới 3 người chấm là "chưa chấm", không phải "không".

Khác matcher có chủ ý: luật máy (A, B) viết lại độc lập từ dữ liệu thô, không dùng trọng số hay điểm của matcher; (B) lỏng hơn matcher (matcher dùng `priceMax` và dung sai 20%).

### Chỉ số
Với mỗi hạng mục C trong {photography, makeup, attire, venue} và mỗi hồ sơ P: lấy top 5 mà matcher thật trả về (`computeMatches(P, {category: C, limit: 5})`, lớp ghi đè admin để rỗng, pool gốc). **Tỉ lệ trùng top 5 của C** = số vị trí top 5 phù hợp (theo định nghĩa trên) / (30 hồ sơ x 5). Mẫu số luôn 5 mỗi ô: hệ thống trả ít hơn 5 thì phần thiếu tính là không phù hợp. Đây là precision@5, không phải recall: eval này không bắt được việc "vendor tốt không bao giờ được hiện".

**Đối chứng**: mỗi ô còn có 3 vendor ngẫu nhiên (seed cố định) cùng qua luật máy A và B nhưng ngoài top 5, trộn lẫn với top 5 trong gói chấm. **Hơn đối chứng** = tỉ lệ top 5 trừ tỉ lệ phù hợp của vendor đối chứng cùng hạng mục (điểm phần trăm). Mục đích: chặn trường hợp người chấm khen tất cả.

Lệnh in thêm khoảng ±95% theo hồ sơ (độ lệch chuẩn của tỉ lệ từng hồ sơ / căn 30) để Capu thấy độ nhiễu; PASS/FAIL dựa trên giá trị điểm.

### Một lệnh
`node eval/T-074/match_eval.mjs [--labels <file>]` (chạy tại gốc sổ cái; tìm matcher ở `../tohong-back`, đổi bằng biến `TOHONG_BACK`). In bảng mỗi hạng mục: số ô, trùng/top 5, tỉ lệ, ±95%, tỉ lệ đối chứng, hơn đối chứng, đạt hay chưa kèm lý do. Dòng cuối luôn là `PASS ...` hoặc `FAIL <lý do>`; mã thoát 0 chỉ khi PASS (cả 4 hạng mục đạt cả hai ngưỡng, không còn vendor top 5 chưa đủ nhãn).
- Chưa có `eval/T-074/labels.json` (nhãn thật): in `FAIL chưa có nhãn thật: ...`, mã thoát 1.
- Nhãn mẫu (`is_sample: true`): in số liệu (chỉ trên hồ sơ có nhãn) nhưng dòng cuối luôn là `FAIL nhãn mẫu ...`. Nhãn mẫu không bao giờ cho PASS.
- Vendor vào top 5 sau khi matcher đổi mà chưa có nhãn (hoặc thẻ vendor đã đổi từ lúc chấm): tính là "chưa chấm", hạng mục không đạt, lệnh ghi danh sách cặp (hồ sơ, vendor) cần chấm thêm vào `t074-unlabeled.json`.

### 30 hồ sơ mẫu (`eval/T-074/profiles.json`)
Sinh bằng luật cố định (`lib/gen_profiles.py`), không nhìn kết quả matcher. 6 style x 5 hồ sơ; 3 mức ngân sách L/M/H, mỗi mức đúng 10 hồ sơ, mỗi style đủ cả 3 mức; mọi hồ sơ ở TP.HCM, cưới tháng 5–11/2027, 80–400 khách. Hồ sơ thứ 3 của mỗi style thêm một style phụ để có hồ sơ pha trộn. Ngân sách hạng mục (triệu đồng, cùng đơn vị với giá hiển thị trên thẻ vendor):

| Mức | photography | makeup | attire | venue |
| --- | --- | --- | --- | --- |
| L | 8 | 4 | 8 | 4 |
| M | 20 | 8 | 15 | 8 |
| H | 35 | 15 | 30 | 15 |

Các mức chọn để cắt qua các cụm giá phổ biến của pool (30 / 8 / 25 / 15) nên ngân sách có tác dụng loại vendor. 6 style x 3 mức x 4 hạng mục = 72 tổ hợp, 30 hồ sơ x 4 hạng mục = 120 ô chấm; phủ mỗi (style, mức) ít nhất 1 hồ sơ, KHÔNG phủ đủ từng tổ hợp ba chiều (chi phí chấm). Ô thiếu hàng (vd korean x venue không vendor nào gắn tag) vẫn tính: cặp đôi thật cũng nhìn thấy kết quả đó.

### Định dạng file nhãn (`eval/T-074/labels.json`, `schema: t074-labels/v1`)
```
{ "schema": "t074-labels/v1", "is_sample": false, "profiles_sha": "<băm profiles.json>",
  "graders": [ { "id": "G1", "relationship": "external",
                 "declaration": { "saw_system_scores": false, "touched_matching_weights": false } }, ... 3 đến 5 ],
  "labels": [ { "profile": "P01", "category": "photography", "vendor": "marry_xxx", "grader": "G1",
                "fit": true, "role": "system|filler", "card": "<băm thẻ vendor lúc chấm>" }, ... ] }
```
Hợp lệ khi: 3–5 người chấm id khác nhau, mỗi người `external` và khai `saw_system_scores=false`, `touched_matching_weights=false`; mỗi nhãn ghi một người chấm có trong `graders`; không có nhãn trùng (hồ sơ, hạng mục, vendor, người chấm); `fit` là true/false; hạng mục thuộc 4 hạng mục chính; `profiles_sha` khớp `profiles.json` hiện tại; không có trường lạ (không tên, email, số điện thoại: người chấm chỉ có mã G1..G5, bảng mã-người nằm ngoài repo, do Capu giữ).

### Quy trình chấm mù (người thực hiện ghi trong ngoặc)
1. (Capu) mời 3–5 người ngoài. "Ngoài" nghĩa là không phải Capu, không phải agent, không từng sửa trọng số matching. Giai đoạn A chưa thu nhãn từ cặp đôi thật (ngoài phạm vi).
2. (Capu hoặc Chief of Staff) `node eval/T-074/packets.mjs make --graders N --out <thư mục NGOÀI repo>`. Lệnh ghi `G1.csv`..`GN.csv` cho từng người và thư mục `_private/` (khoá vai trò, mẫu khai báo) giữ lại, không gửi.
3. Mỗi ô (hồ sơ x hạng mục) giao đúng 3 người, xoay vòng; mỗi ô gồm top 5 hiện tại cộng 3 đối chứng, đã trộn thứ tự. Người chấm thấy: mô tả cặp đôi (style bằng tiếng Việt, tháng cưới, số khách, ngân sách bốn hạng mục), tên, mô tả, giá hiển thị, rating và số đánh giá nếu có, tối đa 3 ảnh. KHÔNG thấy: điểm, hạng, lý do hệ thống, tag/style của vendor, vai trò system/filler, `priceMax` thô ngoài khoảng giá hiển thị, mọi thứ về trọng số. Người chấm điền cột `phu_hop` bằng `co` hoặc `khong` cho từng dòng, không để trống, không trao đổi với nhau. Khối lượng: khoảng 560–700 dòng mỗi người (5 người ~560, 4 người ~700; 3 người ~940). Thời gian ước tính vài giờ, là phỏng đoán chưa đo; nên chia hai buổi.
4. (Capu) mỗi người chấm điền khai báo vào `_private/declarations.json` (mẫu `declarations.template.json`, giá trị để null cho tới khi người đó xác nhận).
5. (Capu hoặc Chief of Staff) `node eval/T-074/packets.mjs import --dir <thư mục> --out eval/T-074/labels.json`, rồi `node eval/T-074/match_eval.mjs --validate eval/T-074/labels.json` và `node eval/T-074/match_eval.mjs`.
6. Agent không được chấm, không được sửa nhãn, không được sửa `profiles.json` sau khi có nhãn (đổi là nhãn vô hiệu qua `profiles_sha`).

### Ngưỡng
NGUONG_TI_LE_TOP5: 80
NGUONG_LIFT: 20

Mỗi hạng mục trong 4 hạng mục phải đạt cả hai: tỉ lệ trùng top 5 >= 80% và hơn đối chứng >= 20 điểm. Đây là ĐỀ XUẤT của Capu (>= 80%) cộng một chốt chặn do Spec Writer thêm (20 điểm, phỏng đoán).

**Vì sao 80:** top 5 nghĩa là cặp đôi nhìn vài thẻ đầu rồi quyết định liên hệ. Nếu mỗi vị trí phù hợp với xác suất 0,8 và các vị trí độc lập (giả định, không đúng hoàn toàn), xác suất cả 3 thẻ đầu đều không phù hợp là 0,2^3 = 0,8%; ở 60% là 6,4%; ở 50% là 12,5%. NSM chỉ cần 1 vendor phù hợp, và ưu tiên #1 là cặp đôi tin được lời khuyên, nên ngưỡng phải đủ cao để thẻ đầu hiếm khi sai.
**Vì sao 20 điểm hơn đối chứng:** nếu pool đã toàn vendor tốt hoặc người chấm dễ tính, 80% có thể đạt mà không cần matching. 20 điểm là con số tự đặt để buộc matching phải hơn chọn ngẫu nhiên trong tập vendor đã qua luật máy một khoảng đáng kể; không có dữ liệu nền để suy ra, tự tin ~40%.
**Đánh đổi:** với 30 hồ sơ mỗi hạng mục, giá trị tỉ lệ nhiễu tới khoảng ±14 điểm (95%) nếu các hồ sơ chênh nhau nhiều, nên kết quả sát ngưỡng (75–85%) không kết luận được; lệnh in ±95% để thấy điều đó. Ngưỡng cao cũng có thể FAIL vì ô thiếu hàng của pool (tag style thưa) chứ không vì matching kém; khi đó sửa pool, không sửa nhãn.
**Điều kiện khiến sai:** nếu nhãn của 3–5 người lệch nhau nhiều (đa số 2/3 thường xuyên), hoặc nếu giá trong pool là giá mặc định (xem Bằng chứng) khiến người chấm khen/chê theo giá giả. Khi đó số 80 phải đặt lại sau vòng chấm đầu, ghi vào `decisions/`, không đổi lặng lẽ.

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
| 2 | Mỗi nhãn ghi người chấm; người chấm là người ngoài 3–5, khai không thấy điểm và không sửa trọng số; file nhãn không có dữ liệu cá nhân; validator từ chối mọi biến thể hỏng | `python3 eval/T-074/check_2_nhan.py` |
| 3 | Ngưỡng 80% (và 20 điểm) ghi trong spec kèm vì sao, đánh đổi, điều kiện sai; lệnh eval dùng đúng số đó | `python3 eval/T-074/check_3_nguong.py` |
| 4 | 30 hồ sơ mẫu phủ 6 style (mỗi style 5), 3 mức ngân sách (10/10/10), đủ ngân sách 4 hạng mục, đều ở TP.HCM, không chứa kết quả matcher | `python3 eval/T-074/check_4_ho_so.py` |
| 5 | Gói chấm mù: không lộ điểm/hạng/style/tag/vai trò; 120 ô, mỗi ô đúng 3 người; tải đều; thứ tự đã trộn; import chặn khi thiếu khai báo | `python3 eval/T-074/check_5_cham_mu.py` |
| 6 | Chưa có nhãn thật thì FAIL rõ "chưa có nhãn thật" (mã thoát 1); nhãn mẫu không bao giờ cho PASS | `bash eval/T-074/check_6_thieu_nhan.sh` |
| 7 | Cách tính đúng định nghĩa: đa số tuyệt đối, hoà là không, luật máy A/B loại đúng, thiếu nhãn hoặc thẻ đổi = chưa chấm, ngưỡng biên 80%, đối chứng chặn người chấm khen cả | `node eval/T-074/check_7_cach_tinh.mjs` |

Ghi chú về nhóm eval: các eval này kiểm bộ máy đo. Chúng xanh khi bộ máy đúng, KHÔNG phải khi matching đạt 80%. Việc "matching đạt 80%" là lệnh ở mục Một lệnh với nhãn thật, và đỏ cho tới khi có nhãn thật (xem Bất biến đề xuất). Phần máy (`match_eval.mjs`, `packets.mjs`, `lib/`) do Spec Writer viết cùng eval vì chính bộ máy đo là sản phẩm của việc này; Engineering rà và mở rộng, xem handoff.

## Bất biến đề xuất (tầng 2)
Đề xuất cho Spec critic rút vào `eval/invariants/planner/vendor/matching/`:
1. **Nhãn toàn vẹn** (luôn chạy): nếu `eval/T-074/labels.json` tồn tại thì phải qua `node eval/T-074/match_eval.mjs --validate` (người chấm ngoài 3–5, khai báo đủ, không dữ liệu cá nhân, `profiles_sha` khớp). Không có nhãn thì thoát 0 (chưa có gì để hỏng).
2. **Top 5 phù hợp** (chỉ bật khi `labels.json` thật tồn tại và `is_sample=false`): `node eval/T-074/match_eval.mjs` phải PASS. CẢNH BÁO: bất biến này đỏ sẽ buộc spec rework cho mọi việc ở vùng matching theo hiến pháp (tầng 2 đỏ), nên chỉ bật sau khi Capu chốt định nghĩa và ngưỡng, và khi đỏ cần Capu phân xử chứ không để việc kế tiếp bị kẹt. Nhãn không được nằm trong thư mục mà agent code có quyền ghi (Capu giữ bản gốc ngoài repo, so băm).

## Không làm
- Sửa matching, trọng số hay pool để khớp nhãn. Không agent nào chấm nhãn hay sinh nhãn thật; `labels.sample.json` là nhãn giả lập chẵn/lẻ của băm, chỉ để chạy thử đường.
- Thu nhãn từ cặp đôi thật; liên hệ vendor; thanh toán.
- Đo recall (vendor tốt không được hiện), đo thứ hạng bên trong top 5, đo hạng mục ngoài 4 hạng mục chính, đo tầng 2 và 3 của matching.
- Xác nhận giá hay đơn vị giá của pool (xem Rủi ro trong handoff).

## Câu hỏi mở
Capu chốt định nghĩa "vendor phù hợp" ở trên (ba điều kiện A, B, C với B là `priceMin` <= ngân sách) và ngưỡng 80% kèm chốt chặn 20 điểm: đồng ý, hay đổi điều nào (đặc biệt B: giữ `priceMin`, hay đổi sang `priceMax` như matcher)? Bộ nhãn chỉ giá trị sau khi định nghĩa này được chốt, vì đổi định nghĩa sau khi chấm làm phải chấm lại.
