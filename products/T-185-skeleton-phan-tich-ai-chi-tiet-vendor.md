# Spec T-185: Khối "Phân tích AI" ở chi tiết vendor hiện skeleton khi chưa tính xong

## Ý định
Capu, 2026-11-16 (ảnh chi tiết Asiana Plaza Bình Thạnh): ở thẻ chi tiết vendor trong chat, khối "Phân tích AI" lúc chưa tính xong phải hiện dạng skeleton, không số tạm, không chữ chờ, không câu mẫu mờ.

## Bằng chứng
- Đọc tohong-front main `1bc6b54`, `src/screens/chat/VendorChatCards.jsx` (VDetailChatCard, ~585-725): lúc chờ `GET /api/vendors/:id?coupleId=…` khối hiện tiêu đề "Phân tích AI" + một dòng `Đang cập nhật điểm…` (T-171 H2, thay cho %/thanh/phép so); câu AI hiện câu mẫu của hàng ở `opacity 0.6` + caret `▌` (`whyLoading`) rồi Typewriter. Đây là hiện trạng cần đổi. Tự tin cao (~95%, đọc code + chạy bản sao).
- Khung sẵn có: `src/ui/Skel.jsx` (`useShowAfter` 150ms, `SkelRegion`, `Bar`), skeleton dùng token `--line-100` (`.db-skel`, `src/index.css`), tắt animation khi reduced-motion; đã dùng ở danh sách (T-061).
- Một phản hồi chi tiết mang CẢ điểm lẫn câu AI (`match` + `match.whyThisVendor`); hiện không có đường để điểm về trước câu AI. Front không có chế độ tối (không có theme nào trong `src/`), chỉ có token màu.
- Dev có StrictMode: một lần mở chi tiết gọi API 2 lần liền (lần đầu bị bỏ); không ảnh hưởng spec, eval đếm theo cụm yêu cầu.

## Giả thuyết
Nếu khối Phân tích AI hiện skeleton thay vì số của hàng danh sách và chữ chờ thì cặp đôi không còn thấy một con số tạm rồi đổi (nhìn như điểm sai), và bố cục không giật. Chỉ số bảo vệ: T-171 H2/H6 (lỗi, không điểm), T-179 (danh sách cũ đóng băng; chi tiết chấm theo số hiện tại), T-167 (dòng phép so), không thêm lần gọi API.

## Hành vi (người dùng thấy gì)
Phạm vi: CHỈ khối "Phân tích AI" của thẻ chi tiết vendor (VDetailChatCard). Danh sách, so sánh, trang khác không đổi.

**H1. Chờ điểm (phản hồi chi tiết chưa về).** Khối giữ tiêu đề tĩnh "Phân tích AI" và ba nhãn tĩnh "Ngân sách", "Phong cách", "Lịch trống"; mọi thứ còn lại là skeleton, đủ bốn phần:
- (a) tiêu đề: một khối skeleton ngay sau chữ "Phân tích AI" thay cho "· N% phù hợp";
- (b) ba hàng thanh: mỗi hàng một khối skeleton thay số % bên phải nhãn và một khối skeleton thay thanh;
- (c) dòng phép so: một khối skeleton ngay dưới thanh Ngân sách (chỗ của "≈ … so với …tr tiệc cưới");
- (d) câu AI: khung câu (ảnh đại diện + hộp) giữ nguyên, bên trong hai dòng skeleton.
Trong khối, chữ nhìn thấy chỉ còn đúng: tiêu đề + ba nhãn. Không chữ số, không "%", không `Đang cập nhật điểm…` (bỏ hẳn ở thẻ chi tiết; dòng này vẫn dùng ở thẻ danh sách theo T-171 H2), không câu mẫu của hàng (mờ hay rõ), không caret `▌`. Không dùng điểm/phép so của hàng danh sách, kể cả điểm cũ hơn bản đã lưu. Khi skeleton hiện, vùng chờ có `aria-busy="true"` và `role=status` tên "Đang tải…" (quy ước T-061 §2: cả hai chỉ xuất hiện CÙNG LÚC với skeleton, sau mốc ~150ms; trước mốc không có); skeleton không focus được. "Khối Phân tích AI" trong spec và eval = phần chứa tiêu đề, ba nhãn, thanh, phép so và khung câu AI (hoặc câu lỗi/câu không điểm); cách bọc DOM không quan trọng, eval xác định khối bằng nội dung và hình học. Không đệm tối thiểu: điểm về là skeleton mất ngay trong cùng lần vẽ.

**H2. Không nháy.** Skeleton chỉ hiện khi đã chờ quá ~150ms kể từ lúc khối hiện (`useShowAfter` mặc định). Trước mốc (chưa có `aria-busy`, chưa có `role=status`), khối chỉ có chữ tĩnh của H1 (tiêu đề + ba nhãn), không vẽ khối nào, và GIỮ NGUYÊN chiều cao như khi skeleton hiện (bố cục không nhảy lúc skeleton xuất hiện). Phản hồi về trước mốc thì không có skeleton nào được vẽ. Con số kiểm: skeleton hiện sau 100-450ms kể từ lúc khối hiện.

**H3. Có điểm mà câu AI chưa có.** (i) Phản hồi 2xx có điểm nhưng không có `whyThisVendor`: ba thanh, %, dòng phép so hiện thật ngay; khối câu AI hiện câu mẫu của hàng ở độ đậm thường nếu hàng có câu, không thì không có khung câu; không skeleton, không caret, không gõ chữ. (ii) Nếu sau này điểm về TRƯỚC câu AI (hiện không xảy ra, back trả chung một phản hồi): thanh, %, phép so hiện thật, CHỈ khung câu AI còn hai dòng skeleton cho tới khi câu về. Eval chỉ đo (i); (ii) là quy tắc cho tương lai.

**H4. Có điểm và câu AI.** Như hôm nay: "Phân tích AI · N% phù hợp", ba thanh với số thật, dòng phép so nguyên văn từ back (T-167), câu AI về và khác câu mẫu của hàng thì được gõ dần bằng Typewriter, chỉ ở lần mở đầu (lấy lại điểm bằng Thử lại không gõ lại câu). Câu mẫu mờ + caret bị bỏ ở mọi trạng thái.

**H5. Lỗi (không 2xx hoặc mạng đứt).** Giữ T-171 H2: khối chỉ còn tiêu đề tĩnh + `Chưa cập nhật được điểm. Thử lại` (nút Thử lại), không skeleton, không số. Bấm Thử lại: vào lại H1/H2 (câu lỗi mất; sau mốc ~150ms hiện skeleton); về thành công thì H4. Chữ nhìn thấy sau tiêu đề chỉ có câu lỗi.

**H6. Không điểm (2xx, `match` null).** Giữ T-171 H6: khi chờ là H1/H2; khi về, khối chỉ còn tiêu đề + `Chưa có điểm cho vendor này`, không skeleton, không nút Thử lại, không %.

**H7. Danh sách cũ đóng băng, chi tiết theo số hiện tại.** Giữ T-179 H4: lúc chi tiết chờ, danh sách vendor đã in không đổi chữ nào và không có skeleton; khi chi tiết về, nó hiện điểm/phép so theo số hiện tại do phản hồi chi tiết mang (không theo số in ở danh sách) và danh sách vẫn giữ số cũ.

**H8. Giao diện.** Mọi màu skeleton lấy từ token (`--line-100`), không màu cứng, nên theo bất kỳ bảng token sáng/tối nào; skeleton luôn khác nền khối (`--kim-50`) để nhìn thấy; reduced-motion thì không pulse (đã có trong `.db-skel`). Ở 360px khối không tràn ngang, mọi skeleton nằm trong khối.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-185-skeleton-phan-tich-ai` · Vùng (`area`): `planner/vendor/matching`
- Bất biến đã đọc: `_shared/`, `planner/vendor/matching/` inv-001..009 (đặc biệt inv-005 điểm ngân sách suy từ `budget_basis`, inv-006/008: danh sách theo dự toán đã lưu, không in theo số đoán; inv-007/009 chữ ghép tiền), `planner/front/budget/` inv-001..007. Spec này không đổi nguồn số, không thêm lần gọi API (H1-H8 chỉ đổi cách vẽ lúc chờ): không vi phạm. Ba câu bị spec này THAY THẾ cho thẻ chi tiết: T-171 H2 ("thẻ chi tiết thay khối Phân tích AI bằng dòng `Đang cập nhật điểm…`"), T-179 H4 (`products/T-179-danh-sach-vendor-moi-giu-danh-sach-cu.md:48`, "trong lúc chờ điểm của thẻ chi tiết hiện đúng MỘT dòng `Đang cập nhật điểm…` thay cho khối đó"; phần còn lại của T-179 H4, chấm theo số hiện tại rồi đóng băng, giữ nguyên) và T-061 §1 ("chữ AI đang viết trong thẻ chi tiết vendor không có skeleton"); thẻ danh sách vẫn giữ dòng đó. Không đề nghị đổi bất biến nào.
- Kiến trúc / design system: `src/ui/Skel.jsx` (`useShowAfter`, `SkelRegion`, `Bar`, mốc 150ms), `.db-skel`. Không thêm token, không màu cứng.
- Không chạm: payment, auth, schema, dữ liệu người dùng, back-end, API.
- Bậc lưới lọc: A (UI thuần, eval tự động phủ hết, không chạm ranh giới cứng; Capu giao bậc A).

## Tiêu chí chấp nhận và eval
Eval xác định "khối" bằng nội dung/hình học (tổ tiên nhỏ nhất chứa tiêu đề và đủ ba nhãn, hoặc câu báo), nhận ra skeleton bằng khối rỗng nền `--line-100` nhìn thấy; không đo cha trực tiếp. Đã kiểm trên các bản bọc `<span>` khác nhau (Spec Gate dựng): xanh 8/8.
Khung chung `eval/T-185/_lib.cjs` (App thật, vite dev + Playwright, API giả có độ trễ/lỗi/không điểm). Chạy từ gốc `tohong-hq`, thêm `--repo <tohong-front>` để chạy trên bản sao; `T171_ALL=1` in đủ lỗi.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | H1: chờ điểm (trễ 1,8s) khối hiện skeleton đủ 4 phần (tiêu đề, ba thanh, dòng phép so, câu AI), vùng aria-busy + status "Đang tải…"; ở mọi mẫu trước khi có điểm chữ trong khối chỉ còn tiêu đề + ba nhãn; điểm về thì hết skeleton, hiện 80% phù hợp | `node eval/T-185/check_1_cho_diem_hien_skeleton.cjs` |
| 2 | H2: phản hồi 40ms không có skeleton ở mẫu nào; phản hồi 1,2s: skeleton hiện sau 100-450ms, trước đó chỉ chữ tĩnh và cùng chiều cao, không mẫu rỗng khi điểm về | `node eval/T-185/check_2_khong_nhay_khi_nhanh.cjs` |
| 3 | H3(i): có điểm không có câu AI: thanh/%/phép so thật, không skeleton, không caret/chữ chờ, ổn định | `node eval/T-185/check_3_co_diem_khong_co_cau_ai.cjs` |
| 4 | H4: có điểm + câu AI: 80%, 100/50/100, "so với 90tr", câu AI được gõ dần rồi đủ câu, không skeleton khi đã có điểm | `node eval/T-185/check_4_co_diem_va_cau_ai_nhu_cu.cjs` |
| 5 | H5: lỗi 500 hiện đúng "Chưa cập nhật được điểm. Thử lại" không skeleton; Thử lại vào lại chờ có skeleton rồi 80%; đúng 2 lần thử gọi | `node eval/T-185/check_5_loi_va_thu_lai.cjs` |
| 6 | H6: 200 match null: khi chờ có skeleton, khi về đúng "Chưa có điểm cho vendor này", không Thử lại, không % | `node eval/T-185/check_6_khong_co_diem.cjs` |
| 7 | H7: server đổi dự toán 90 -> 40 sau khi in danh sách; bấm Alpha: lúc chờ không số, danh sách giữ Alpha 100%; về thì "70% phù hợp" + "so với 40tr"; danh sách vẫn 100% | `node eval/T-185/check_7_chi_tiet_theo_so_hien_tai_danh_sach_giu_nguyen.cjs` |
| 8 | H8: 360px không tràn ngang; skeleton khác nền khối; đổi token `--line-100`/`--kim-50` sang bảng tối thì màu skeleton và nền khối đổi theo | `node eval/T-185/check_8_theme_va_360.cjs` |

Kết quả đo bản cài giả (v2: thêm hai bản bọc `<span>` của Spec Gate, `span` và `span2`, đều xanh 8/8; đột biến cũ vẫn đỏ) (bản sao main `1bc6b54` + thay đổi nhỏ ở khối này): trên main bản gốc check 1, 2, 5, 6, 7, 8 ĐỎ (3 và 4 xanh: chúng là lưới giữ hành vi cũ, phải xanh cả trước và sau); trên bản cài giả cả 8 XANH; bản đột biến (bỏ mốc 150ms; thiếu một hàng thanh) làm check 2 và 1 đỏ. T-171 check 1/2/7 đã đỏ sẵn trên main (cùng lỗi ở bản cài giả; T-179 check 2/7/9 xanh ở cả hai), không do T-185.

Việc cho Engineering: giữ T-179 `check_7`, `check_9` và `check_2` xanh (chúng đo chữ "Đang cập nhật điểm" chỉ ở danh sách / chi tiết không điểm).

## Bất biến đề xuất (tầng 2)
Đề xuất cho vùng `planner/vendor/matching` (Spec critic rút nếu spec qua): "Thẻ chi tiết vendor KHÔNG hiện trong khối Phân tích AI điểm, thanh hay dòng phép so nào trước khi phản hồi chi tiết về (lúc chờ chỉ có chữ tĩnh + skeleton), và điểm hiện ra là của phản hồi chi tiết, không phải của hàng đã bấm." Nội dung chạy được = tiêu chí 1 + 7.

## Không làm
- Không đổi thẻ danh sách (vẫn dòng `Đang cập nhật điểm…` theo T-171 H2), thẻ so sánh, trang khác; không đổi API, back-end, nguồn điểm.
- Không thêm chế độ tối (chỉ đảm bảo skeleton theo token).
- Không đổi Typewriter, thời điểm gọi API, số lần gọi.
- Không giữ chữ "Đang cập nhật điểm…" ở thẻ chi tiết (xem Câu hỏi mở).

## Câu hỏi mở
Không có câu cần chặn việc; mặc định đã chọn: bỏ hẳn chữ "Đang cập nhật điểm…" ở thẻ chi tiết (Capu muốn giữ một dòng chữ nhỏ bên cạnh skeleton thì nói, đổi H1 và check_1 là xong).
