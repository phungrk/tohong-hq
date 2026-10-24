# PRD T-001: Lọc vendor theo ngân sách

## Vấn đề
- Người gặp: cặp đôi Việt Nam đang chọn vendor cưới (chụp ảnh, trang trí, tiệc, trang phục...), đã có tổng ngân sách và đang chia theo hạng mục.
- Gặp khi: duyệt danh sách vendor mà không biết vendor nào nằm trong tầm tiền, phải mở từng hồ sơ hoặc nhắn hỏi giá.
- Bằng chứng: GIẢ ĐỊNH, chưa có dữ liệu người dùng hay giá trong repo. Mức tự tin: trung bình (~60%), dựa trên sứ mệnh "minh bạch về giá" ở CLAUDE.md. Cần kiểm chứng bằng phỏng vấn cặp đôi (việc riêng, chưa làm).

## Giả thuyết
Nếu thêm bộ lọc ngân sách theo hạng mục thì:
- Chỉ số thành công: tỷ lệ phiên có lọc dẫn tới "xem hồ sơ vendor" tăng; mục tiêu đề xuất +20% so với phiên không lọc (con số khởi điểm là ĐOÁN, chốt lại sau 2 tuần có baseline).
- Chỉ số bảo vệ: tỷ lệ phiên lọc ra 0 kết quả <= 10%; và tỷ lệ vendor có giá công khai không giảm (vendor không bị đẩy ẩn hay bỏ giá chỉ vì bộ lọc).

## Cách nhập và khớp ngân sách
- Đơn vị: VND, số nguyên. Hiển thị dạng "15.000.000 đ"; chấp nhận nhập "15tr", "15 triệu".
- Nhập: khoảng [tối thiểu, tối đa] theo hạng mục; tối thiểu có thể để trống (= 0). Tối đa bắt buộc.
- Vendor có giá dạng khoảng [giá thấp, giá cao]: khớp khi hai khoảng giao nhau (thấp <= tối đa của cặp đôi VÀ cao >= tối thiểu).
- Vendor có một giá cố định: coi như khoảng [giá, giá].
- Vendor "từ X": khoảng [X, không giới hạn trên]; khớp khi X <= tối đa.
- Vendor thiếu hoặc không công khai giá: không bị loại; nằm nhóm riêng "Chưa có giá, liên hệ để biết" xếp sau các vendor khớp, có nhãn rõ. Có công tắc "Ẩn vendor chưa có giá" (mặc định tắt).
- Sắp xếp: vendor khớp hoàn toàn nằm trong khoảng lên trước.

## Phạm vi
Làm: ô nhập ngân sách theo hạng mục, logic khớp trên, nhóm vendor chưa có giá, thông báo khi 0 kết quả, ghi sự kiện đo lường.
Không làm: không viết code trong việc này; không liên hệ vendor hay khách thật; không cam kết giá với vendor; không dùng dữ liệu cá nhân thật; không tự chia ngân sách gợi ý; không báo giá hay đặt cọc/thanh toán; không suy đoán giá cho vendor thiếu giá.

## Tiêu chí chấp nhận cho bản xây
1. Nhập "15tr", "15 triệu" và "15000000" đều cho cùng giá trị 15.000.000 VND; giá trị âm hoặc không phải số bị từ chối kèm thông báo.
2. Với tối đa = 20.000.000, vendor khoảng 10-18tr hiện trong nhóm khớp; vendor khoảng 25-40tr không hiện.
3. Vendor khoảng 18-30tr khớp với ngân sách tối đa 20tr (khoảng giao nhau).
4. Vendor "từ 15tr" khớp khi tối đa >= 15tr, không khớp khi tối đa < 15tr.
5. Vendor thiếu giá luôn nằm trong nhóm "Chưa có giá" có nhãn, không nằm lẫn nhóm khớp; bật "Ẩn vendor chưa có giá" thì nhóm này biến mất.
6. Khi 0 vendor khớp, hiện thông báo và gợi ý nới tối đa; không hiện trang trống.
7. Bộ lọc áp dụng theo hạng mục; đổi hạng mục không làm mất giá trị ngân sách đã nhập trong phiên.
8. Mỗi lần lọc ghi sự kiện (hạng mục, tối đa, số kết quả, có/không ẩn vendor chưa có giá) không chứa dữ liệu cá nhân.

## Rủi ro và câu hỏi mở
- Rủi ro: giá vendor lỗi thời hoặc là giá tham khảo gây hiểu nhầm; nhóm "chưa có giá" lớn làm bộ lọc kém hữu ích. Cần ghi nhãn "giá tham khảo" trong hiển thị.
- Câu hỏi cho Capu: (1) Vendor có được tự khai báo giá hay Tơ Hồng thu thập? (chạm cam kết với vendor, phải hỏi trước). (2) Mặc định hiển thị vendor chưa có giá hay ẩn? PRD đề xuất hiển thị. (3) Chấp nhận mục tiêu +20% làm giả định khởi điểm không?

## Mức leo thang
Tự làm cho PRD này. Chạm tiền/pháp lý/dữ liệu: không trực tiếp (chỉ hiển thị giá); câu hỏi (1) cần Capu trước khi xây.
