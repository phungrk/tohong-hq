# Spec T-192: Thẻ ngân sách trong chat in số tiền từng hạng mục; khoảng giá đầu dưới rỗng

> v2 (spec rework lần 1, defect T-192-D1) · Spec Writer (product) · 2026-11-16 · bậc A · vùng `planner/front/budget` · chỉ `tohong-front` (main `631c942`; đặt trên nền PR #85 của T-191/T-187) · khuôn số theo `products/T-187-dau-phay-so-tien-le-o-front.md` H1.

## Ý định
Capu muốn cặp đôi nhìn thẻ ngân sách trong chat là thấy mỗi hạng mục bao nhiêu tiền. Adversary T-191 phát hiện thẻ chỉ ghi "tr" cho mọi hạng mục, và khoảng giá vendor có đầu dưới rỗng ra "tr–5tr".

## Bằng chứng
- `board/T-192.md` (brief từ adversary T-191); đo lại trên front main `631c942`: mọi hàng thẻ chat ghi "Chụp ảnh tr", ô sửa mở ra "undefined", thanh tỷ lệ đầy rãnh (NaN); vendor priceMin "" ra "tr–5tr", priceMin null ra "0tr–6tr", cả hai rỗng ra "tr" (eval 1-5 đỏ đúng các chỗ này). Tự tin cao (đo được).
- Nguyên nhân quan sát được: `src/screens/chat/cards.jsx:348,351` đọc `c.amt`; hạng mục dự toán chỉ có `allocated_tr` (`useBudget.js:171,182`). Đây là mô tả để dễ tìm, KHÔNG phải cách cài bắt buộc.
- Bể: `eval/invariants/planner/front/budget/` inv-001..007 và `inv-008` (chờ thăng bởi T-191) không nói về thẻ chat này; không mâu thuẫn. ADR-113/114/117/118 không liên quan trực tiếp (dấu phẩy ở back; admin; vendor-images).

## Giả thuyết
Nếu thẻ ngân sách chat in đúng số của từng hạng mục thì cặp đôi đọc được phân bổ ngay trong chat mà không phải mở màn Ngân sách. Chỉ số bảo vệ: số thật không đổi; chữ của giá một-số (thẻ chọn/so sánh có giá, dòng vendor đã lưu, màn Ngân sách) không đổi khi có giá.

## Hành vi (người dùng thấy gì)
H1. Mỗi hạng mục trong thẻ ngân sách chat hiện số tiền đã phân bổ của CHÍNH hạng mục đó (cùng số màn Ngân sách ghi cho hạng mục ấy), theo khuôn T-187 H1: làm tròn một lần tới 1 chữ số, dấu phẩy, bỏ ",0", không phân cách nghìn; API trả số hay chuỗi ("3.4") đều như nhau. Hạng mục phân bổ 0 ghi "0tr". Không hàng nào còn "tr" đứng riêng, "undefined", "NaN".
H2. Chạm số của một hạng mục mở ô sửa chứa số đang phân bổ của hạng mục đó, viết nguyên văn như ô sửa ở màn Ngân sách hôm nay: số nguyên 20 -> "20"; số lẻ 12.34 -> "12.34" và chuỗi "3.4" -> "3.4" (dấu chấm, không làm tròn, không dấu phẩy; Escape đóng ô không đổi số). Ô vẫn chỉ nhận số nguyên khi gõ; gõ số mới + Enter thì hàng đó hiện số mới, hàng khác giữ nguyên số (phần bù trừ sang "Dự phòng"/"Tuần trăng mật" theo logic cũ, không đổi, không đo).
H3. Thanh tỷ lệ dưới mỗi hạng mục dài bằng phần của hạng mục trong tổng đã phân bổ (20/60/20 trên tổng 100 thì 20%, 60%, 20% chiều rộng rãnh). Đúng cả khi API trả các số dạng chuỗi ("20", "60", "20"): tổng là phép cộng số, không nối chuỗi.
H4. Chữ giá vendor khi một đầu rỗng. "Rỗng" = bỏ khuyết, `null` hoặc chuỗi rỗng; số 0 là giá trị thật, không phải rỗng (giữ như hôm nay, vd "0tr–5tr"). Chữ dưới đây là NGUYÊN CHỮ bắt buộc (không "vd"), vì chỉ ghi "5tr" đọc như giá chính xác:
  - Nơi hiển thị KHOẢNG (có cả đầu dưới lẫn đầu trên để ghi): thẻ danh sách chat, thẻ chi tiết chat, câu "giá đã cập nhật (…)" ở màn Vendors:
    - đầu dưới rỗng, đầu trên có -> "Đến 5tr"; nhà hàng có nguồn giá -> "Đến 5tr/bàn";
    - đầu trên rỗng, đầu dưới có -> "Từ 4tr" (nhà hàng "Từ 4tr/bàn");
    - cả hai rỗng -> "Chưa có giá" (đúng chữ ở màn Ngân sách);
    - đủ hai đầu -> giữ "4tr–5tr" (khuôn T-187 H2).
    Không "tr–", không "0tr–" bịa cho đầu rỗng, không "tr" đứng riêng, không "Từ 5tr"/"≤ 5tr"/"5tr" trần cho đầu dưới rỗng.
  - Nơi hiển thị MỘT giá (thẻ chọn so sánh, bảng so sánh, dòng vendor đã lưu ở màn Vendors, hàng vendor ở màn Ngân sách): có giá -> ghi số đó như hôm nay ("4tr", nhà hàng "4tr/bàn"), KHÔNG thêm "Từ"; rỗng (kể cả vendor có priceMin null/bỏ khuyết) -> "Chưa có giá"; không "tr" trơ, không "0tr" bịa cho giá rỗng. Giá 0 thật vẫn "0tr".
  - Phạm vi (Chief chốt): sửa trong hàm định dạng chung của #85 nên mọi chỗ gọi đổi theo: chat (danh sách, chi tiết, thẻ chọn, bảng so sánh) và màn Vendors. Chỗ một-giá chỉ đổi ở ca giá rỗng (từ "tr" thành "Chưa có giá"); chỗ có giá không đổi chữ.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-192-the-ngan-sach-chat` · Vùng: `planner/front/budget`. Chỉ đổi chữ/hình hiển thị; không đổi API, dữ liệu lưu, số gửi lên server.
- Bất biến đã đọc: `_shared/`, `planner/front/` (budget inv-001..007, layout, loading, navigation, vendor-images). Không vi phạm.
- Đặt sau khi PR #85 (T-191) merge: dùng chung hàm định dạng của #85; không tự thêm hàm thứ hai. Eval 1, 3, 4 (ca số nguyên), 5 (ca số nguyên) chỉ dùng số nguyên nên không phụ thuộc #85; chỉ eval 2 (khuôn dấu phẩy) cần #85.
- Không chạm: payment, auth, schema, dữ liệu người dùng. Bậc A: chữ/hình hiển thị, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (`TOHONG_FRONT_REPO` hoặc `--repo`), khung vite dev + Playwright của `eval/T-187/_lib.cjs`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mỗi hàng thẻ ngân sách chat ghi "<tên> <số>tr" đúng số phân bổ của hạng mục (số nguyên; 0 -> "0tr"); không "tr" trơ | `node eval/T-192/check_1_moi_hang_muc_co_so_tien.cjs` |
| 2 | Số từng hàng theo khuôn T-187 H1: 12.34 -> "12,3tr", "3.4" (chuỗi) -> "3,4tr", 1.15 -> "1,2tr", 2.25 -> "2,3tr", 30 -> "30tr", 1440 -> "1440tr" | `node eval/T-192/check_2_so_hang_muc_theo_khuon_t187.cjs` |
| 3 | Nguyên chữ H4: danh sách chat "Đến 5tr"/"Đến 6tr"/"Đến 7tr", "Từ 4tr" (đầu trên "" và null), "Chưa có giá", "4tr–5tr", "0tr–5tr"; nhà hàng "Đến 5tr/bàn"; chi tiết "Đến 5tr"; thẻ chọn và bảng so sánh: giá rỗng "Chưa có giá", giá 4 vẫn "4tr"; màn Vendors: "giá đã cập nhật (Đến 5tr)", lưu không giá "Chưa có giá", giá 4 vẫn "4tr"; ngoài chữ đúng không còn số tiền/"tr" lạ (bắt "Từ 5tr", "5tr" trần) | `node eval/T-192/check_3_khoang_gia_dau_rong.cjs` |
| 4 | Chạm số mở ô sửa chứa "20" (số đang phân bổ); gõ 25 + Enter -> hàng đó "25tr", hàng "Tiệc & nhà hàng" vẫn "60tr". Ca lẻ: 12.34 -> ô chứa "12.34", chuỗi "3.4" -> "3.4" | `node eval/T-192/check_4_cham_so_mo_o_sua_dung_so.cjs` |
| 5 | Ba thanh tỷ lệ dài ~20%, 60%, 20% rãnh (sai số 2 điểm), với số nguyên và với chuỗi "20","60","20" | `node eval/T-192/check_5_thanh_ty_le_theo_so_phan_bo.cjs` |

Mỗi tiêu chí đúng một eval, tầng 1. Trên front main `8751e87` (đã có #85): cả 5 ĐỎ ở đúng chỗ lỗi. Đã thử xanh: bản vá giả ở worktree tạm (hàm chung thêm cờ "khoảng"; chỗ gọi danh sách/chi tiết/Vendors-cập-nhật bật cờ; hàng thẻ ngân sách đọc số phân bổ và cộng số) cho cả 5 PASS.

## Bất biến đề xuất (tầng 2)
Vùng `planner/front/budget`: mọi hàng hạng mục của thẻ ngân sách chat có số tiền, không "tr" trơ (phần dùng số nguyên của eval 1). Không đề nghị đổi bất biến cũ.

## Không làm
- Không đổi `priceTotal` dùng tính toán (số vào ngân sách, so "rẻ nhất"), chỉ chữ hiển thị. Không đổi câu gợi ý "Nếu ưu tiên tiết kiệm…" của bảng so sánh, cũng không đổi cách tô "rẻ nhất".
- Không sửa nhập số lẻ ở ô sửa (ô chỉ nhận số nguyên như hôm nay).
- Không đổi back, API, admin.

## Câu hỏi mở
Không. Điểm lệch so với chỉ thị Chief (cần Chief biết): "Từ 4tr" chỉ áp nơi hiển thị khoảng; nơi chỉ có một giá (thẻ chọn, bảng so sánh, vendor đã lưu, màn Ngân sách) vẫn ghi "4tr", vì áp "Từ" vào đó làm mọi giá đơn ra "Từ 4tr" và vỡ eval T-187. Giả định ghi rõ: cả hai đầu rỗng ghi "Chưa có giá" (mượn chữ có sẵn), tự tin ~80%.


## Đã sửa so với v1 (spec rework lần 1)
- H4 gạch 1: bỏ "vd", ghi nguyên chữ "Đến 5tr"/"Từ 4tr"; eval 3 so khớp nguyên chữ và bắt "Từ 5tr"/"5tr" trần (lỗi: câu cho ba cách cài).
- Phạm vi: bỏ câu "không đổi thẻ so sánh/thẻ chọn" và "các màn khác không đổi chữ"; ghi rõ khoảng vs một-giá; thêm ca thẻ chọn, bảng so sánh, Vendors vào eval 3 (lỗi: hai câu mâu thuẫn).
- H2 ghi khuôn ô sửa với số lẻ (eval 4); H3 ghi ca chuỗi (eval 5).
