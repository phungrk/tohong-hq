# T-167 · tiêu chí 4 · checklist máy đọc được (phần hiển thị ở front)

Vì sao là checklist: front (`tohong-front`) chỉ có test `node --test` cho hàm thuần (`scripts/test-*.mjs`), không có môi trường dựng thẻ React; phần hiển thị chỉ là in nguyên `match.budgetBasis.text` (back đã được kiểm tự động ở eval 1-3). Engineering được phép thay bằng test tự động nếu dựng được, rồi báo trong bàn giao.

Chuẩn bị: back chạy bản T-167; cặp đôi thử có onboarding 200 khách, bảng dự toán hạng mục Tiệc cưới 90tr; vendor thử là nhà hàng giá theo bàn 3,9tr (vd Bạch Kim `marry_5ec257b82f96`).

1. Mở chat, chọn "Nhà hàng/Tiệc cưới" để hiện thẻ gợi ý, mở chi tiết vendor (khối "Phân tích AI"). Dưới thanh "Ngân sách" có đúng một dòng chữ nhỏ và nó giống HỆT `match.budgetBasis.text` trong phản hồi của GET /api/vendors/match (mở tab Network để so)? Có/không.
2. Với dữ liệu trên, dòng đó đọc đúng `≈ 3,9tr/bàn × 20 bàn = 78tr so với 90tr tiệc cưới`? Có/không.
3. Sửa số khách ở tab Ngân sách thành 300 rồi mở lại thẻ: dòng đổi thành `… × 30 bàn = 117tr so với 90tr tiệc cưới` và thanh Ngân sách là 0%? Có/không (số lệch lộ ra thay vì ẩn).
4. Xoá số khách (bảng 0, hồ sơ 0): dòng đọc "chưa có số khách", thanh Ngân sách 50%? Có/không.
5. Với vendor giá ước tính (nhãn "Ước tính…"): dòng có chữ "ước tính", không có chữ "trong ngân sách"? Có/không.
6. Thanh Ngân sách, dòng phép so và các chip lý do không bao giờ mâu thuẫn nhau (vd dòng ghi 117tr so với 90tr mà thanh 100%)? Không mâu thuẫn = đạt.
7. Phản hồi cũ (back chưa có `budgetBasis`, giả lập bằng cách xoá trường trong Network override): thẻ vẫn mở bình thường, không hiện "undefined", không hiện dòng rỗng? Có/không.
8. Chữ dòng nhỏ không bị cắt/tràn ở màn 360px (chữ xuống dòng)? Có/không.
