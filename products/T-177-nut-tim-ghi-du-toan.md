# Spec T-177: Nút "Tìm <hạng mục>" ghi kèm dự toán

> v1 · Spec Writer (product) · 2026-11-15 · bậc A · vùng `planner/front/budget` · chỉ chạm `tohong-front` · nối T-171 (H5, thay đổi chưa lưu), T-167 (khuôn số tiền).

## Ý định
Capu (2026-11-15): ở màn chi tiết hạng mục, nút "Tìm <hạng mục>" đổi thành "Tìm <hạng mục> trong khoảng <số tiền dự toán của hạng mục>", để cặp đôi thấy ngay số dự toán sẽ dùng khi tìm vendor.

## Bằng chứng
- `tohong-front` main `7d65d5e`, `src/screens/Budget.jsx:488-493` (`BudgetCatDetail`): nút hiện `Tìm {cat.name.toLowerCase()}`, bấm gọi `onOpenVendorChat(cat.id)`; số dự toán đang hiện là `cat.allocated_tr || 0` (dòng 326, cùng số thanh "Dự toán" và số lớn `{allocated}tr` dòng 369). Giá trị này theo thanh kéo kể cả khi chưa lưu (T-171 H5).
- Khuôn số tiền T-167 H2: dấu phẩy thập phân, bỏ phần thập phân nếu `.0`, "tr" liền số, không phân cách nghìn, không đổi sang tỷ (1440tr), làm tròn 1 chữ số bằng `Math.round(x*10)/10` (`fmtTr`).
- Mức tự tin: cao (~90%) cho hành vi; việc nhỏ, một nút.

## Giả thuyết
Nếu nút ghi sẵn dự toán thì cặp đôi hiểu danh sách vendor sẽ được so với đúng số đó, ít bất ngờ khi điểm Ngân sách thấp. Chỉ số bảo vệ: bấm nút vẫn mở tìm vendor đúng hạng mục, không thêm lệnh ghi.

## Hành vi (người dùng thấy gì)
Chỉ nút "Tìm ..." ở màn chi tiết hạng mục (khối Vendor, hạng mục có mục Vendor). Gọi `X` là dự toán đang hiện của hạng mục (`allocated_tr` đúng số thanh "Dự toán" đang hiện), `R = Math.round(X*10)/10`.
- **H1 · Có dự toán (`R > 0`).** Nhãn đúng `Tìm {tên} trong khoảng {R}tr`, `{R}` theo khuôn T-167 (chốt MỘT khuôn này): `90` -> `90tr`; `12,5` -> `12,5tr`; `12,34` -> `12,3tr`; `1440` -> `1440tr`. Ví dụ `Tìm nhà hàng tiệc cưới trong khoảng 90tr`.
- **H2 · Theo số đang hiện.** Kéo thanh "Dự toán" (kể cả khi chưa lưu hoặc lưu lỗi, câu báo "Chưa lưu được dự toán") thì nhãn đổi ngay theo số trên thanh, không chờ lưu, không quay về số của server. Bấm Reset cũng đổi theo.
- **H3 · Dự toán 0 hoặc chưa phân bổ (`R = 0`, gồm thiếu trường, 0, 0,04).** Giữ đúng `Tìm {tên}`; không có chữ "trong khoảng", không có "0tr".
- **H4 · Tên giữ cách viết hiện tại:** `{tên}` = tên hạng mục đang hiện, chuyển chữ thường (như `cat.name.toLowerCase()` hôm nay), không rút gọn, không đổi.
- **H5 · Bấm không đổi:** bấm nút (mọi nhãn ở trên) mở tìm vendor của đúng hạng mục đang xem, đúng một lần; không ghi dự toán, không gọi API thêm.
- **H6 · 360px:** nhãn dài (kể cả tên dài + `1440tr`) xuống dòng được, không tràn ngang: nút nằm trong khung 360px, chữ và biểu tượng không vượt hộp nút, trang không có cuộn ngang, chữ không bị cắt bằng "...".

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-177-nut-tim-ghi-du-toan` · Vùng: `planner/front/budget`.
- Bất biến đã đọc: `_shared/` và `planner/front/budget/` inv-001..005. Không vi phạm: inv-001 (một con số cho khoản vendor: nhãn dùng đúng số dự toán đang hiện, không tính số mới), inv-002 (không đoán số: dự toán 0 không in số), inv-003 (mở màn không đụng dữ liệu dùng chung), inv-005 (không ghi). Không đề nghị đổi bất biến.
- Kiến trúc: không đổi `onOpenVendorChat`, không thêm gọi API, không đổi state dự toán; chỉ đổi chữ nhãn. Chạy lại `T-171` check_1..10 và `T-174` adv: các eval đó tìm `Tìm nhà hàng tiệc cưới` theo chuỗi con nên vẫn khớp.
- Không chạm payment, auth, schema, dữ liệu người dùng, dịch vụ trả phí.
- Bậc A: đổi nhãn UI, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (biến `TOHONG_FRONT_REPO`, mặc định `../tohong-front`; Playwright + vite dev, API giả, không mạng ngoài). Đỏ trên main là đúng (trừ 4, là rào bảo vệ).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | H1+H4: mở hạng mục có dự toán 90 / 12,5 / 12,34 / 1440 thì nút đúng `Tìm <tên chữ thường> trong khoảng 90tr / 12,5tr / 12,3tr / 1440tr`, khớp số thanh Dự toán | `node eval/T-177/check_1_nhan_theo_du_toan.cjs` |
| 2 | H2: kéo thanh 90 -> 40 (lưu lỗi) nhãn 40tr ngay và sau khi lưu lỗi; kéo 65 -> 65tr; Reset đổi theo | `node eval/T-177/check_2_keo_thanh_nhan_doi_ngay.cjs` |
| 3 | H3: dự toán 0, thiếu, 0,04, kéo về 0 giữ `Tìm nhà hàng tiệc cưới`; kéo lên 5 thành `... trong khoảng 5tr` | `node eval/T-177/check_3_du_toan_0_giu_nhan_cu.cjs` |
| 4 | H5: bấm nút mở tìm vendor đúng id hạng mục một lần, không PUT/POST | `node eval/T-177/check_4_bam_mo_tim_vendor.cjs` |
| 5 | H6: 360px, tên dài + 1440tr không tràn, không cắt | `node eval/T-177/check_5_khong_tran_360px.cjs` |

## Bất biến đề xuất (tầng 2)
Không. (Nhãn là chữ trình bày, không phải tính chất phải đúng mãi; tránh khoá chữ vào bể.)

## Không làm
Không đổi hành vi bấm, không đổi tên hạng mục, không đổi nhãn ở nơi khác (hàng hạng mục dòng 771 "Tìm vendor", chat, tab Vendor), không dùng đơn vị tỷ, không thêm dự toán của vendor đã lưu vào nhãn.

## Câu hỏi mở
Không. (Chốt định dạng theo T-167; nhãn làm tròn 1 chữ số, giá trị nhỏ hơn 0,05tr coi là 0.)
