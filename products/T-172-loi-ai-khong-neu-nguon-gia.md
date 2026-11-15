# Spec T-172: Lời AI trong chat cặp đôi không nêu nguồn giá

> v1 · Spec Writer (product) · 2026-11-15 · bậc B · vùng `planner/vendor/matching` · chỉ chạm `tohong-back` (mốc main `1519d44`) · thi hành ADR-099 + ADR-100 cho phần chữ do AI nói. Nối tiếp T-164 (H5), T-170 (front), T-167.

## Ý định
Capu (ADR-099): "hãy bỏ hiển thị nguồn giá. Ví dụ: Giá marry.vn · 06/2026", phạm vi "Mọi màn app cặp đôi". Chief phân xử (ADR-100): phạm vi gồm cả chữ trong bong bóng chat AI; T-170 lo front, T-172 lo prompt/khối ứng viên của back để lời AI không nêu nguồn giá, vẫn trung thực (không khẳng định ngân sách cho giá ước tính, inv-003).

## Bằng chứng
Đọc từ `tohong-back` main `1519d44` (đã chạy thật bằng LLM giả, không mạng):
- Khối ứng viên chat hiện ghi nhãn: dòng thật "Giá: 4-4tr (giá marry.vn · 06/2026)", "Giá: 4-15tr (ước tính theo hạng mục)", "(giá đã xác minh)", "(giá do Tơ Hồng cập nhật)", và pool cũ không nguồn "(giá ước tính)". Một LLM giả chỉ trích lại dòng giá của prompt đã nói ra đúng các chữ đó (đã dựng lại bằng `eval/T-172/check_2`).
- Prompt BẮT AI nêu nhãn: `lib/matchFormatter.js:143`. Đây là sự thật đã kiểm, không phải giả định.
- Cache câu AI ở chi tiết vendor KHÔNG đổi khi prompt đổi: hash chỉ theo hồ sơ (`api/vendors.js:25-37`, so khớp `:50`). Đã dựng lại: câu cũ chứa "(Ước tính theo hạng mục)" nằm trong cache được trả nguyên, 0 lượt LLM.
- Chưa kiểm được (cần mạng): một mô hình thật có tự nói "giá ước tính" bằng văn của nó khi prompt không có chữ đó hay không. Tự tin ~70% là hiếm; spec chỉ kiểm được prompt và lời của LLM giả (xem "Giới hạn của eval").

### Mọi chỗ nhãn nguồn giá đi vào prompt/câu AI (main `1519d44`)
| # | file:dòng | Gì | Làm gì sau T-172 |
| --- | --- | --- | --- |
| 1 | `lib/matchFormatter.js:21-27` (`formatPrice`; nhãn chọn ở `:26`, ghép "(nhãn)" ở `:27`) | dòng "Giá:" của mỗi ứng viên: `4-15tr (ước tính theo hạng mục)`; pool cũ `(giá ước tính)` / `(giá đã xác minh)` | bỏ "(…)"; giữ số, đơn vị, "/bàn" |
| 2 | `matchFormatter.js:18-20` | chú thích mã nói về nhãn | cập nhật cho khớp (không đo) |
| 3 | `matchFormatter.js:109,112` | `info = {price_label}` đưa nhãn vào `formatPrice` | không đưa nữa; vẫn dùng `basis` để biết "/bàn" và biết ước tính |
| 4 | `matchFormatter.js:60-62` (`explainReason`) | "Phù hợp vì: phù hợp với nhu cầu của anh chị (giá ước tính theo hạng mục)" | còn "phù hợp với nhu cầu của anh chị" |
| 5 | `matchFormatter.js:139` | "rõ giá (kèm nhãn giá) và style" | "rõ giá và style" |
| 6 | `matchFormatter.js:143` | "Khi nhắc đến giá … luôn kèm nhãn giá trong ngoặc" | xoá dòng |
| 7 | `matchFormatter.js:144` | 'Vendor có nhãn giá "ước tính theo hạng mục": không khẳng định … ngân sách' | thay bằng dòng không nhãn (H4) |
| 8 | `api/vendors.js:60` (`getOrGenerateWhy`, prompt user của câu "vì sao hợp") | `giá 6–8tr (Ước tính theo hạng mục)`; "/bàn" của venue chỉ được in kèm nhãn (`price_label ? "/bàn" …`) | bỏ "(…)"; giữ "/bàn" của venue có nguồn giá |
| 9 | `api/vendors.js:25-37,43,50,73` | hash cache câu AI chỉ theo hồ sơ | câu cache cũ chứa chữ nguồn giá không được trả (H6) |

Không phải chỗ đi vào prompt/câu AI (đã rà, giữ nguyên): `lib/vendorMatcher.js:164-175` (`whyThisVendor` mẫu) và `:197-…` (`whyThoseVendors`) không có chữ nguồn giá; chúng chỉ nói "tầm giá"/"giá dao động" (đã đo bằng `check_4`, giữ). `vendorMatcher.js:94` ("Giá ước tính: " của phép so T-167, `budgetBasis.text`) là chữ API/app, không đi vào prompt (prompt `api/vendors.js:56` chỉ dùng nhãn `reasons`); ADR-099 giữ. `lib/chatMatcher.js:103-105`, `vendorOverlay.js:144-147`, `api/admin.js:503`, `lib/vendorPrice.js` (tạo nhãn) là dữ liệu/API/admin, giữ. `lib/prompts.js` và `agents/*.md` không có chữ nguồn giá (đã grep). Repo `tohong` (`edge/agents`) không có chữ nguồn giá (đã grep).

## Giả thuyết
Nếu bỏ nhãn khỏi prompt thì lời AI hết nêu "giá marry.vn · 06/2026", đúng ý Capu. Chỉ số bảo vệ: AI vẫn không khẳng định vendor giá ước tính "hợp/nằm trong ngân sách" (inv-003); giá, số, "/bàn" vẫn đúng; API vẫn trả `price_label`.

## Hành vi (người dùng thấy gì / AI được dặn gì)
H1. Khối ứng viên chat (`## Vendor matching candidates`) và mọi phần prompt gửi AI trừ "## Hồ sơ cặp đôi" không chứa chữ nguồn giá. "Chữ nguồn giá" nghĩa là khớp một trong: `marry`, `ước tính`, `xác minh`, `nhãn giá`, `nguồn giá`, `do Tơ Hồng cập nhật`, `giá cũ`, hoặc `· MM/YYYY` (không phân biệt hoa thường). Áp dụng cho mọi loại nguồn (giá riêng marry, ước tính, admin đã xác minh, admin tự nhập, pool cũ không nguồn).
H2. Dòng "Giá:" của ứng viên đứng ngay sau dòng tên, và chỉ còn đúng dạng `   Giá: <a>-<b>tr` hoặc `   Giá: <a>-<b>tr/bàn` (venue có nguồn giá), hoặc `   Giá: Liên hệ để hỏi báo giá` (không giá). Cách làm tròn số không đổi. Không có chữ nào sau đơn vị.
H3. "Hướng dẫn trả lời" không chứa chữ "nhãn" hay "nguồn", không có "(kèm …)". Khi có ứng viên có nguồn giá: "- Trình bày 3–5 vendor trên theo hướng thực tế, rõ giá và style." Khi không ứng viên nào có nguồn giá (pool cũ): giữ nguyên "rõ ngân sách và style" như hôm nay. Hướng dẫn "Khi nhắc đến giá … kèm nhãn giá" không còn.
H4. (Giữ inv-003 bằng cờ nội bộ, không mang chữ nguồn.) Với mỗi ứng viên có `price_basis` là `estimate_category` hoặc `estimate_default` (và chỉ họ): ngay sau dòng "Giá:" (và sau "Theo số bàn" nếu có; ước tính vốn không có dòng đó) có đúng một dòng `   Ngân sách: chưa đủ cơ sở để khẳng định vendor này hợp hoặc nằm trong ngân sách`; dòng "Phù hợp vì" của họ khi không có lý do khác là `phù hợp với nhu cầu của anh chị` (không "ngân sách", không ngoặc). Vendor giá riêng/admin/pool cũ: không có dòng cờ; "Phù hợp vì" giữ "phù hợp với ngân sách và nhu cầu của anh chị". Khối có ít nhất một ứng viên ước tính thì "Hướng dẫn trả lời" có đúng một dòng `- Vendor có dòng "Ngân sách: chưa đủ cơ sở": không khẳng định vendor hợp hoặc nằm trong ngân sách của anh chị.`; không có ứng viên ước tính thì không có dòng đó. Cờ này chỉ nói "chưa đủ cơ sở", không nêu vì sao (không nói ước tính, không nói nguồn).
H5. Câu AI "vì sao hợp" (chi tiết vendor): prompt gửi LLM (system + user) không chứa chữ nguồn giá; dòng "Nhà cung cấp: … giá A–Btr, đánh giá …" vẫn có giá (venue có nguồn giá: `A–Btr/bàn`; số giữ nguyên định dạng hiện tại, vd `4–4.6tr/bàn`). Với vendor ước tính, prompt user có đúng một dòng `Ngân sách: chưa đủ cơ sở để khẳng định vendor này hợp hoặc nằm trong ngân sách` và prompt (system hoặc user) có câu chứa "không khẳng định vendor hợp hoặc nằm trong ngân sách"; vendor khác không có dòng cờ. Lý do: hôm nay nhãn trong prompt này là tín hiệu duy nhất cho LLM biết giá là giá đoán; bỏ nhãn mà không thay thì inv-003 yếu đi.
H6. Câu "vì sao hợp" đã lưu cache trước thay đổi mà chứa chữ nguồn giá không bao giờ được trả cho cặp đôi, kể cả khi LLM lỗi (khi đó trả câu mẫu của matcher, không chữ nguồn). Khi LLM chạy được: mở vendor đó sinh lại đúng một lượt, lưu bản sạch; mở lại: 0 lượt LLM. Cách làm (đổi khoá hash, bỏ entry có chữ nguồn, …) Engineering tự chọn; spec KHÔNG đòi sinh lại câu cũ không có chữ nguồn.
H7. Lời AI trong chat (qua luồng chat thật) khi LLM làm theo prompt: không chứa chữ nguồn giá nhưng vẫn có số giá của từng ứng viên đã được nhắc.
H8. Không đổi: `price_label`/`price_basis`/`price_source` ở API (tab, chi tiết, `/status`, admin) và `matchMetadata` nội bộ; thứ tự, điểm, lọc, chip; "Theo số bàn" của venue giá riêng; admin.

### Hệ quả cần biết (đã đo)
- Ở chat, ước tính chỉ còn một tín hiệu "chưa đủ cơ sở … ngân sách" trong prompt, không còn nói "giá ước tính". Cặp đôi không nhận dấu nào từ AI rằng giá là giá đoán (đúng ADR-099, Chief đã nêu rủi ro).
- Cache: trên main, hash không phụ thuộc prompt nên đổi prompt KHÔNG làm câu AI cũ sinh lại. Sau T-172 chỉ các vendor có câu cũ chứa chữ nguồn giá sinh lại (mỗi vendor × mỗi cặp đôi, một lượt Haiku tối đa 120 token khi họ mở chi tiết); chi phí nhỏ, không đo được số lượng thật ở đây (GIẢ ĐỊNH: ít hơn vài trăm câu).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-172-loi-ai-khong-nguon-gia` · Vùng: `planner/vendor/matching`.
- Bất biến đã đọc: `_shared/`, `planner/`, `planner/vendor/` (inv-001..005b), `planner/vendor/matching/` (inv-001..005). Tầng 2 chạy XANH trên main (đã chạy `gate.py T-172`). Spec không vi phạm: inv-002 (API giữ nhãn; `check_6`), inv-003 (giữ ý bằng H4/H5; nhưng xem dưới: file đo hiện tại lỗi thời), inv-004 (giữ ý; file đo lỗi thời), `matching/inv-005` (điểm không đổi).
- **Phải làm trước Code Gate (Chief):** `planner/vendor/inv-003` chạy `eval/T-164/check_6_ghep_vendor.mjs` phần C và E đo ĐÚNG những câu ADR-100 đảo; `planner/vendor/inv-004` chạy `check_9_venue_theo_ban.mjs` đo "Giá: a-btr/bàn (nhãn)". Bản cài đúng spec sẽ làm tầng 2 ĐỎ ở hai bất biến này (đã dựng bản cài giả và chạy: inv-003 đỏ 5 lỗi, inv-004 đỏ) — adversary sẽ phải trả `--kind spec` oan. Spec kèm bản thay thế chạy được: `eval/T-172/check_7_inv003_ban_thay_the.mjs` và `check_8_inv004_ban_thay_the.mjs` (giữ nguyên mọi nội dung đo, chỉ bỏ/đổi các câu về nhãn). Chief ghi ADR rồi trỏ `inv-003`/`inv-004` sang hai file này khi T-172 merge. Spec Writer không tự sửa bất biến.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, API, admin, front, pool, overlay.
- Bậc đề xuất: **B** — sửa prompt/LLM path (logic nghiệp vụ), eval tự động phủ đủ, không chạm ranh giới cứng; đổi hành vi nói của AI nên Capu đọc diff hành vi.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (mặc định `../tohong-back`, đặt `TOHONG_BACK_REPO` nếu khác). Không mạng: LLM là hàm giả (chặn `fetch`, chỉ nhận URL Anthropic giả). Trên main `1519d44`: 1-5, 8, 9 ĐỎ; 6, 7 XANH và phải giữ xanh. Mỗi eval đo trên hành vi (prompt gửi LLM, lời LLM giả trả, response API), không nhắc tên hàm.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | H1+H2: khối ứng viên chat và prompt (trừ hồ sơ) không chứa chữ nguồn giá; dòng "Giá:" chỉ còn số + đơn vị (venue "/bàn"); đủ 5 loại nguồn + venue + pool cũ | `node eval/T-172/check_1_khoi_ung_vien_khong_nhan.mjs` |
| 2 | H3+H7: hướng dẫn trả lời không dặn nêu nhãn/nguồn; lời AI chat (qua `handleCoupleChat`, LLM giả làm theo prompt) không chứa chữ nguồn giá nhưng còn số giá | `node eval/T-172/check_2_huong_dan_va_cau_chat.mjs` |
| 3 | H4: cờ nội bộ "chưa đủ cơ sở" cho đúng và chỉ vendor ước tính; "Phù hợp vì" không ngân sách; dòng hướng dẫn có/không đúng lúc; quét 5 hạng mục × 3 ngân sách | `node eval/T-172/check_3_giu_inv003_trong_prompt_chat.mjs` |
| 4 | H5: câu AI "vì sao hợp": prompt + câu sinh không chứa chữ nguồn; giá và "/bàn" giữ; cờ cho vendor ước tính; câu mẫu của tab vẫn sạch | `node eval/T-172/check_4_cau_ai_vi_sao_hop.mjs` |
| 5 | H6: câu cache cũ có nhãn không được trả (LLM chạy được: sinh lại đúng 1 lượt rồi cache sạch; LLM lỗi: câu mẫu) | `node eval/T-172/check_5_cache_cau_ai_cu.mjs` |
| 6 | H8: API vẫn trả `price_label` + `price_basis` đúng chữ ở tab, chi tiết; inv-002 xanh | `node eval/T-172/check_6_api_van_tra_nhan.mjs` |
| 7 | inv-003 giữ ý (thay cho phần A, B, D của check_6 cũ; bỏ C, E): ước tính dùng như giá cũ, không chip/không "tầm giá"/"giá dao động" cho ước tính | `node eval/T-172/check_7_inv003_ban_thay_the.mjs` |
| 8 | inv-004 giữ ý (venue theo bàn so với tổng, lọc, nới, điểm 0,5…); dòng giá venue không nhãn | `node eval/T-172/check_8_inv004_ban_thay_the.mjs` |
| 9 | Bản thay inv-038 (ứng viên chat đúng pool + overlay): dòng giá admin "7-9tr" không nhãn | `python3 -I eval/T-172/check_9_inv038_ban_thay_the.py` |

Kiểm chứng của Spec Writer: dựng một bản cài giả của back (bản sao tạm, KHÔNG nộp, không phải code của việc) làm đúng H1-H8: cả 9 eval XANH; trên main: 1-5, 8, 9 ĐỎ, 6, 7 XANH. Thử đột biến: bỏ "/bàn" ở prompt câu AI → `check_4` ĐỎ; bỏ dòng cờ ở chat → `check_3` ĐỎ; giữ dòng "luôn kèm nhãn giá" → `check_2` ĐỎ. Chạy lại bản cài giả với các eval cũ để lập bảng lỗi thời bên dưới.

### Giới hạn của eval
LLM giả là "học trò ngoan" (trích lại dòng giá và dòng hướng dẫn nhắc giá). Nó chứng minh prompt không dặn và không cung cấp chữ nguồn giá; không chứng minh một mô hình thật không tự nói "giá ước tính". Cũng không chứng minh mô hình thật tuân thủ dòng cờ inv-003 (T-164 cùng giới hạn). `check_3`/`check_4` ghim chữ cố định của cờ và câu hướng dẫn (hợp đồng prompt); đổi chữ phải đổi spec.

## Eval cũ lỗi thời khi T-172 merge (để Chief ghi ADR; KHÔNG sửa)
Chạy từng file trên bản cài giả (và trên main) để xác nhận.

| Eval | Trên main | Sau T-172 | Phần lỗi thời | Xử lý đề nghị |
| --- | --- | --- | --- | --- |
| `eval/T-164/check_6_ghep_vendor.mjs` (bất biến `planner/vendor/inv-003` chạy file này) | xanh | ĐỎ | C (prompt câu AI phải chứa nhãn), E (chat: "(giá ước tính theo hạng mục)", "rõ giá (kèm nhãn giá)", dòng 'Vendor có nhãn giá "ước tính…"'); A, B, D còn đúng | trỏ inv-003 sang `eval/T-172/check_7_inv003_ban_thay_the.mjs` |
| `eval/T-164/check_9_venue_theo_ban.mjs` (`planner/vendor/inv-004`) | xanh | ĐỎ | dòng giá venue "(giá marry.vn · 06/2026)" và "(ước tính theo hạng mục)" (dòng 63, 65) | trỏ inv-004 sang `eval/T-172/check_8_inv004_ban_thay_the.mjs` |
| `eval/invariants/planner/vendor/images/inv-038-ung-vien-chat-dung-pool-overlay.py` và bản trong `eval/T-140/bat-bien-cho-merge/inv-B-thay-inv-034-…py` | xanh | ĐỎ | vế (iv): dòng giá admin "7-9tr (giá đã xác minh)" | thay bằng `eval/T-172/check_9_inv038_ban_thay_the.py` (vùng images: ảnh hưởng mọi việc chạm images, vd T-170 nếu chưa merge) |
| `eval/T-164/check_4_nhan_moi_be_mat_back.mjs` | xanh | ĐỎ | mục (d): dòng giá chat phải có "(nhãn)" và hướng dẫn phải có "kèm nhãn giá"; các mục a, b, c, e (API/admin) còn đúng | không chạy lại phần (d); API/admin đã được `check_6` của T-172 + inv-002 giữ |
| `eval/T-140/check_1_chat_tu_pool_khong_mang.mjs` | xanh | ĐỎ | dòng giá admin "7-9tr" + "giá đã xác minh" | eval của T-140 đã xong; không chạy lại |
| `eval/T-143/lib/adv-03-overlay-bien.mjs` | xanh | ĐỎ | "hạ giá một": dòng giá prompt phải có nhãn | eval đối kháng của T-143; không chạy lại phần dòng giá |
| `eval/T-136/check_a2_hien_thi_theo_pool.mjs` | **ĐỎ ngay từ main** (đã đỏ từ khi T-164 đổi nhãn: kỳ vọng "(giá ước tính)"/"(giá đã xác minh)") | đỏ | toàn bộ phần giá | đã lỗi thời từ T-164; Chief ghi vào ADR để khỏi bị tính là hồi quy |
| `eval/T-164/check_3_thu_tu_nguon_va_nhan.mjs`, `eval/T-165/adv-03-…mjs`, `eval/T-156/check_7_hoi_quy.sh`, `eval/T-164/bat-bien-cho-merge/inv-xxx-gia-hien-ra-luon-co-nhan.py`, `planner/vendor/inv-002` | xanh | xanh | không | giữ |

Front: `eval/T-164/check_5a` đã được ADR-099 đánh dấu lỗi thời, không thuộc việc này.

## Bất biến đề xuất (tầng 2)
Không đề xuất bất biến mới ở tầng chạy mãi: "AI không nêu nguồn giá" là quyết định của Capu và có thể đảo (cùng lý do T-170). Tính chất "AI không khẳng định ngân sách cho giá ước tính" đã là inv-003; spec chỉ đề nghị đổi file đo của inv-003, inv-004 và inv-038 (mục trên) bằng các bản thay thế đã chạy được. Việc đó thuộc Chief/ADR, không tự làm.

## Không làm
- Không đổi API, `price_label`/`price_basis`/`price_source`, `matchMetadata`, admin, front, pool, overlay, điểm, lọc, thứ tự, chip, "Theo số bàn".
- Không bỏ tiền tố "Giá ước tính: " của dòng phép so T-167 (chữ API/app; cần quyết định riêng của Capu).
- Không thêm chữ thay thế nhãn ("~", "khoảng", "tham khảo", …) vào dòng "Giá:" hay lời hướng dẫn; cờ H4/H5 là chữ về ngân sách, không phải chữ nguồn giá.
- Không bắt buộc sinh lại các câu cache cũ không có chữ nguồn giá.
- Không sửa hay xoá eval/bất biến cũ.
- Không gọi mạng; không đổi cấu hình LLM, mô hình, ngân sách token.

## Câu hỏi mở
Không có câu cho Capu. Việc cho Chief (không phải Capu): ghi ADR đổi file đo của `inv-003`, `inv-004`, `inv-038` như bảng trên trước khi vào Code Gate.
