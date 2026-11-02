# Spec T-045: Chi phí Nhà hàng tiệc cưới tính theo số bàn

## Ý định
Capu (2026-11-03): "trong phần Ngân sách, khi khách chốt vendor 'Nhà hàng tiệc cưới', hãy tính tiền chi cho hạng mục này theo công thức sau: (số lượng khách : 10) x giá vendor. Lý do: giá vendor của nhà hàng tiệc cưới thường tính theo bàn, mà mỗi bàn thường 10 khách. Và, riêng hạng mục 'Nhà hàng tiệc cưới' thêm 1 line nhỏ kiểu ghi chú là: Số bàn: số lượng khách chia 10".

## Bằng chứng
- Mã hiện tại ĐÃ có quy đổi theo bàn một phần: `tohong-front/src/journey.js` (`GUESTS_PER_TABLE = 10`, `scaleToCategoryTotal`, `confirmedAmount`) dùng ở `src/screens/VendorCtx.jsx` khi chốt vendor. Hành vi hiện tại: lấy trung điểm (priceTotal+priceMax)/2, nhân số khách chia 10 (không làm tròn bàn), làm tròn kết quả; thiếu số khách thì lấy nguyên giá một bàn làm tiền chi. Đã chạy lại bằng harness của T-045: 205 khách, 6tr/bàn cho khoản 123 (đúng ra 126 theo spec này).
- Giá vendor hiện là tính theo bàn, đơn vị triệu đồng: `tohong-back/lib/vendorPool.generated.js` có 96 vendor `venue`, giá như 3.9, 5.7, 8.5 (triệu mỗi bàn); 51/96 là khoảng giá (`priceMin` khác `priceMax`, vd 5-15), 0/96 thiếu `priceMin`. Thẻ vendor ghi "10 người/bàn".
- Chỗ chưa nhất quán hiện tại (sẽ sửa bởi spec này): `src/screens/Budget.jsx` dòng hạng mục (≈dòng 656) và chi tiết hạng mục (≈dòng 289) hiện giá MỘT BÀN như tiền chi và so "Vượt/Còn dư" với giá một bàn; khoản vendor lưu đóng băng số khách lúc chốt (không tự tính lại khi số khách đổi), trong khi tổng "Đã chốt" (`getBudgetConfirmed`) dùng số khách hiện tại.
- Số khách ở Ngân sách là `guests` của tài liệu ngân sách (`tohong-back/api/budget.js`, mặc định lấy `guest_count` của hồ sơ lần đầu), hiện ở tiêu đề màn Ngân sách "N khách".
- Nhu cầu của người dùng: chưa có dữ liệu người dùng; ý định của Capu là bằng chứng duy nhất. Mức tự tin về công thức: cao (~90%); về chi tiết làm tròn: trung bình.

## Giả thuyết
Nếu số tiền chi của Nhà hàng tiệc cưới phản ánh đủ số bàn thì số "Đã chốt" và "Còn dư/Vượt dự toán" đúng thực tế hơn, cặp đôi không bị bất ngờ khi tiệc vượt ngân sách. Chỉ số bảo vệ: các hạng mục khác không đổi số; không có hạng mục nào hiện NaN hay số do đoán.

## Hành vi (người dùng thấy gì)
Quy ước dùng cho cả spec: "giá vendor" là giá một bàn, đơn vị triệu đồng, đúng số thẻ vendor đang hiện (vd "6tr · 10 người/bàn"). "Số khách" là số khách của tài liệu ngân sách, đúng số màn Ngân sách ghi ở tiêu đề ("205 khách"). "Hạng mục Nhà hàng tiệc cưới" là hạng mục ngân sách có mã `venue`, không xét tên hiển thị.

1. Công thức. Khi hạng mục `venue` có vendor đã chốt, số bàn = làm tròn LÊN của (số khách chia 10). Tiền chi = số bàn x giá vendor, rồi làm tròn về triệu nguyên (0,5 trở lên làm tròn lên); chỉ làm tròn MỘT lần, ở bước cuối, không làm tròn giá hay số bàn trung gian ngoài việc làm tròn lên số bàn. Ví dụ: 205 khách, 6tr/bàn: 21 bàn, 126tr. 201 khách: cũng 21 bàn. 200 khách, 3,9tr/bàn: 20 bàn, 78tr. 205 khách, 3,9tr/bàn: 21 x 3,9 = 81,9 thành 82tr.
2. Giá là khoảng. Vendor có khoảng giá (thấp–cao, vd 5–15tr/bàn) thì giá vendor dùng trong công thức là điểm giữa khoảng: (thấp+cao)/2 (vd 10tr). Đây là giữ nguyên cách tính hiện tại của ứng dụng, không đổi.
3. Tiền chi này là con số duy nhất cho hạng mục ở mọi nơi hiển thị khoản vendor đã chốt của nhà hàng: khoản vendor trong "Mục con" của hạng mục, dòng hạng mục ở danh sách Ngân sách, tổng "Đã chốt", và số lưu ở máy chủ (khoản vendor trong ngân sách, trường `amt`). Không còn nơi nào hiện giá một bàn như tiền chi. Chênh lệch "Vượt/Còn dư so với dự toán" của vendor nhà hàng so sánh tiền chi này (không phải giá một bàn) với dự toán. Số tiền của khoản vendor này không sửa tay được (nó luôn là kết quả công thức); các khoản khác của hạng mục vẫn sửa tay như cũ.
4. Dòng ghi chú. Dưới hạng mục Nhà hàng tiệc cưới, ngay khi có vendor đã chốt, có đúng một dòng chữ nhỏ riêng: `Số bàn: N` (N = số bàn theo mục 1, số nguyên, không dấu phân cách hàng nghìn). Dòng này hiện ở hai nơi: dưới dòng hạng mục trong danh sách Ngân sách, và trong màn chi tiết hạng mục. Chưa chốt vendor nào, hoặc đã hủy chốt: không có dòng này. Hạng mục khác: không bao giờ có dòng này. Chữ nhỏ hơn chữ thường của dòng, không làm tràn khung hay cuộn ngang ở 390px.
5. Thiếu số khách. Số khách thiếu, bằng 0, âm hoặc không phải số nguyên: không đoán. Khoản vendor lưu `amt` = 0, chỗ lẽ ra hiện tiền chi hiện chữ `Chưa tính được: thiếu số khách` (không hiện số tiền, không hiện giá một bàn thay thế), dòng ghi chú hiện `Số bàn: chưa có số khách`. Hạng mục không đóng góp gì vào tổng "Đã chốt".
6. Thiếu giá vendor. Giá thiếu hoặc bằng 0 (hoặc không phải số): không đoán. `amt` = 0, chỗ hiện tiền chi hiện `Chưa tính được: vendor chưa có giá`, dòng ghi chú vẫn hiện `Số bàn: N` nếu có số khách. Nếu thiếu cả hai, hiện lý do thiếu số khách (mục 5) và `Số bàn: chưa có số khách`.
7. Đổi số khách sau khi chốt. Có tính lại, không cần chốt lại: mỗi lần mở màn Ngân sách, tiền chi và Số bàn hiện theo số khách hiện tại, và khoản vendor lưu ở máy chủ được cập nhật theo trong vòng 2,5 giây sau khi màn tải xong, để số lưu luôn bằng số hiện. Đổi số khách về thiếu/0 thì chuyển sang trạng thái mục 5. Các khoản khác của hạng mục không bị đụng.
8. Đổi tên. Hạng mục nhận diện theo mã `venue`, không theo tên: người dùng đổi tên "Nhà hàng tiệc cưới" thành tên khác thì công thức và dòng Số bàn vẫn áp dụng; một hạng mục do người dùng tự thêm mà đặt tên "Nhà hàng tiệc cưới" (mã khác `venue`) thì KHÔNG áp dụng, không có dòng Số bàn, các khoản giữ nguyên. Chữ "Số bàn" cố định, không đổi theo tên hạng mục.
9. Các hạng mục khác giữ nguyên. Chốt vendor ở hạng mục khác (vd chụp ảnh 12tr) vẫn ghi đúng giá vendor, không nhân số bàn; dự toán (`allocated_tr`) của mọi hạng mục, tổng ngân sách, số khách, các khoản thủ công (kể cả khoản thủ công trong hạng mục nhà hàng, vd "Bánh cưới" 3tr) không đổi.
10. Hủy chốt vendor nhà hàng: khoản vendor biến mất khỏi hạng mục, dòng Số bàn biến mất, các khoản thủ công còn nguyên.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` (chính: `src/journey.js`, `src/screens/VendorCtx.jsx`, `src/screens/Budget.jsx`); `phungrk/tohong-back` chỉ khi thật cần (không đổi schema, không đổi `lib/prompts.js`, không đổi dữ liệu vendor). Nhánh: `t-045-nha-hang-theo-ban`. Vùng: `planner/budget`.
- Bất biến của vùng đã đọc: `eval/invariants/_shared/` (INV-001, INV-002) và `eval/invariants/planner/` (chỉ có `admin/members`, `front/layout`, `front/navigation`; chưa có thư mục `budget`). Spec này không vi phạm INV nào; riêng `front/layout` yêu cầu không cuộn ngang và khung hợp lệ, spec này thêm một dòng chữ nhỏ nên phải giữ (kiểm ở tiêu chí 2 ở 390px).
- Design system: theo `tohong-front/DESIGN.md` (dòng chữ nhỏ dùng kiểu chữ phụ có sẵn như dòng "Đang xem N vendor").
- Không chạm: payment, auth, schema DB, dữ liệu cá nhân, đặt cọc, liên hệ vendor. Khoản `amt` vẫn là số nguyên triệu như cũ nên không đổi định dạng lưu.
- Bậc lưới lọc: B (logic nghiệp vụ, không chạm ranh giới cứng). Lưu ý để Capu đọc Diff hành vi: ba chỗ đổi so với hiện tại (làm tròn lên bàn; thiếu số khách thành "chưa tính được"; tự tính lại khi đổi số khách).

## Tiêu chí chấp nhận và eval
Chạy từ `/home/user/tohong-hq`. `<front>` = `/home/user/tohong-front`, `<back>` = `/home/user/tohong-back`. Dữ liệu giả, không mạng thật.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Chốt vendor nhà hàng thì tiền chi = làm tròn một lần (làm tròn lên số bàn x giá, khoảng giá lấy điểm giữa) và là số duy nhất ở khoản lưu, màn chi tiết, dòng hạng mục; hủy chốt gỡ khoản (mục 1,2,3,10) | `bash eval/T-045/run.sh /home/user/tohong-front --only 1` |
| 2 | Dòng `Số bàn: N` đúng chữ, đúng một dòng ở danh sách và chi tiết, không có khi chưa chốt/đã hủy/hạng mục khác, nhỏ và không tràn ở 390px (mục 4) | `bash eval/T-045/run.sh /home/user/tohong-front --only 2` |
| 3 | Hạng mục khác, dự toán, tổng, số khách, khoản thủ công giữ nguyên (mục 9) | `bash eval/T-045/run.sh /home/user/tohong-front --only 3` |
| 4 | Thiếu số khách hoặc giá: `amt` = 0, hiện đúng lý do, không đoán, không NaN (mục 5,6) | `bash eval/T-045/run.sh /home/user/tohong-front --only 4` |
| 5 | Đổi số khách sau khi chốt thì tự tính lại, số lưu khớp số hiện, về 0 khách thì thành chưa tính được (mục 7) | `bash eval/T-045/run.sh /home/user/tohong-front --only 5` |
| 6 | Nhận diện theo mã `venue`, không theo tên (mục 8) | `bash eval/T-045/run.sh /home/user/tohong-front --only 6` |
| 7 | Cổng: back `npm test` xanh, front `test:journey` và `vite build` xanh, lint không tăng so với base | `python3 eval/T-045/check_7_gates.py --back /home/user/tohong-back --front /home/user/tohong-front` |
| 8 | PR có ảnh 390px dữ liệu giả, có Diff hành vi đủ ba điều, đúng phạm vi. Dùng checklist vì nội dung PR máy không kiểm được | `eval/T-045/checklist.md` |

Ghi chú cho Engineering: `scripts/test-journey.mjs` đang khóa công thức cũ ("kết quả giống công thức cũ"); phải đổi test này theo spec (đó là đổi hành vi có chủ đích), không giữ công thức cũ cho venue.

## Bất biến đề xuất (tầng 2)
Vùng `planner/budget` chưa có bất biến nào. Đề xuất hai, viết được thành eval chạy được (dùng lại harness ở `eval/T-045/check_ui.cjs`; Spec critic rút vào `eval/invariants/planner/budget/` khi spec qua cổng):
- INV-budget-001 "Số tiền chi của khoản vendor đã chốt hiện một con số duy nhất ở mọi nơi trong Ngân sách và bằng số lưu": số trên dòng hạng mục, màn chi tiết và khoản lưu của một vendor đã chốt phải bằng nhau, với mọi hạng mục. (T-045 vừa sửa đúng một lệch kiểu này.)
- INV-budget-002 "Không hiện số do đoán khi thiếu dữ liệu": hạng mục có vendor chốt mà thiếu một đầu vào của công thức thì không hiện số tiền chi suy diễn và không có NaN/undefined/Infinity trên màn Ngân sách.

## Không làm
- Không đổi dữ liệu giá vendor, không đổi lại giá một bàn thành giá khác; không đổi `lib/prompts.js` (lời khuyên của Budget agent). Hạng mục `ceremony`, `decor` v.v. không đổi cách tính dù có thể cũng tính theo đơn vị khác.
- Không cho sửa số người mỗi bàn (cố định 10), không cho sửa số bàn bằng tay.
- Không đổi "dự toán" (`allocated_tr`) tự động theo chi tiêu; không tự đổi số khách của hồ sơ.
- Không thêm sự kiện analytics.
- Không đổi màn Vendor (thẻ vendor, so sánh, lọc theo ngân sách T-001) ngoài việc số "Vượt/Còn dư" trong màn Ngân sách.

## Câu hỏi mở
Một câu cho Capu: "(số lượng khách : 10)" Capu viết có làm tròn lên không? Spec này chọn làm tròn LÊN theo đề xuất của Chief of Staff (205 khách = 21 bàn, 126tr với giá 6tr/bàn), vì không có nửa bàn; cách đọc theo đúng chữ là 20,5 bàn = 123tr và dòng ghi chú "Số bàn: 20,5". Nếu Capu muốn đúng chữ thì đổi mục 1 và 4 (hai eval tiêu chí 1, 2 phải đổi theo).
