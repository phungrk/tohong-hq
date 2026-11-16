# Spec T-192: Thẻ ngân sách trong chat in số tiền từng hạng mục; khoảng giá đầu dưới rỗng

> v1 · Spec Writer (product) · 2026-11-16 · bậc A · vùng `planner/front/budget` · chỉ `tohong-front` (main `631c942`; đặt trên nền PR #85 của T-191/T-187) · khuôn số theo `products/T-187-dau-phay-so-tien-le-o-front.md` H1.

## Ý định
Capu muốn cặp đôi nhìn thẻ ngân sách trong chat là thấy mỗi hạng mục bao nhiêu tiền. Adversary T-191 phát hiện thẻ chỉ ghi "tr" cho mọi hạng mục, và khoảng giá vendor có đầu dưới rỗng ra "tr–5tr".

## Bằng chứng
- `board/T-192.md` (brief từ adversary T-191); đo lại trên front main `631c942`: mọi hàng thẻ chat ghi "Chụp ảnh tr", ô sửa mở ra "undefined", thanh tỷ lệ đầy rãnh (NaN); vendor priceMin "" ra "tr–5tr", priceMin null ra "0tr–6tr", cả hai rỗng ra "tr" (eval 1-5 đỏ đúng các chỗ này). Tự tin cao (đo được).
- Nguyên nhân quan sát được: `src/screens/chat/cards.jsx:348,351` đọc `c.amt`; hạng mục dự toán chỉ có `allocated_tr` (`useBudget.js:171,182`). Đây là mô tả để dễ tìm, KHÔNG phải cách cài bắt buộc.
- Bể: `eval/invariants/planner/front/budget/` inv-001..007 và `inv-008` (chờ thăng bởi T-191) không nói về thẻ chat này; không mâu thuẫn. ADR-113/114/117/118 không liên quan trực tiếp (dấu phẩy ở back; admin; vendor-images).

## Giả thuyết
Nếu thẻ ngân sách chat in đúng số của từng hạng mục thì cặp đôi đọc được phân bổ ngay trong chat mà không phải mở màn Ngân sách. Chỉ số bảo vệ: số thật không đổi; các màn khác không đổi chữ.

## Hành vi (người dùng thấy gì)
H1. Mỗi hạng mục trong thẻ ngân sách chat hiện số tiền đã phân bổ của CHÍNH hạng mục đó (cùng số màn Ngân sách ghi cho hạng mục ấy), theo khuôn T-187 H1: làm tròn một lần tới 1 chữ số, dấu phẩy, bỏ ",0", không phân cách nghìn; API trả số hay chuỗi ("3.4") đều như nhau. Hạng mục phân bổ 0 ghi "0tr". Không hàng nào còn "tr" đứng riêng, "undefined", "NaN".
H2. Chạm số của một hạng mục mở ô sửa chứa số đang phân bổ của hạng mục đó; gõ số mới + Enter thì hàng đó hiện số mới, hàng khác giữ nguyên số (phần bù trừ sang "Dự phòng"/"Tuần trăng mật" theo logic cũ, không đổi, không đo).
H3. Thanh tỷ lệ dưới mỗi hạng mục dài bằng phần của hạng mục trong tổng đã phân bổ (20/60/20 trên tổng 100 thì 20%, 60%, 20% chiều rộng rãnh).
H4. Khoảng giá một vendor ở khung chat (thẻ danh sách VÀ thẻ chi tiết). "Rỗng" = giá trị bỏ khuyết, `null` hoặc chuỗi rỗng; số 0 là giá trị thật, không phải rỗng, giữ như hôm nay.
  - Đầu dưới rỗng, đầu trên có: chỉ ghi đầu trên, vd "5tr", nhà hàng có nguồn giá "5tr/bàn". Không "tr–", không "0tr–", không "tr" trơ.
  - Cả hai đầu rỗng: ghi "Chưa có giá" (đúng chữ đã dùng ở màn Ngân sách).
  - Cả hai đầu có: giữ nguyên như hôm nay ("4tr–5tr", theo khuôn T-187 H2).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-192-the-ngan-sach-chat` · Vùng: `planner/front/budget`. Chỉ đổi chữ/hình hiển thị; không đổi API, dữ liệu lưu, số gửi lên server.
- Bất biến đã đọc: `_shared/`, `planner/front/` (budget inv-001..007, layout, loading, navigation, vendor-images). Không vi phạm.
- Đặt sau khi PR #85 (T-191) merge: dùng chung hàm định dạng của #85; không tự thêm hàm thứ hai. Eval 1, 3, 4, 5 chỉ dùng số nguyên nên không phụ thuộc #85; chỉ eval 2 (khuôn dấu phẩy) cần #85.
- Không chạm: payment, auth, schema, dữ liệu người dùng. Bậc A: chữ/hình hiển thị, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq` (`TOHONG_FRONT_REPO` hoặc `--repo`), khung vite dev + Playwright của `eval/T-187/_lib.cjs`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mỗi hàng thẻ ngân sách chat ghi "<tên> <số>tr" đúng số phân bổ của hạng mục (số nguyên; 0 -> "0tr"); không "tr" trơ | `node eval/T-192/check_1_moi_hang_muc_co_so_tien.cjs` |
| 2 | Số từng hàng theo khuôn T-187 H1: 12.34 -> "12,3tr", "3.4" (chuỗi) -> "3,4tr", 1.15 -> "1,2tr", 2.25 -> "2,3tr", 30 -> "30tr", 1440 -> "1440tr" | `node eval/T-192/check_2_so_hang_muc_theo_khuon_t187.cjs` |
| 3 | Khoảng giá đầu dưới rỗng ở danh sách và chi tiết chat: "5tr", "6tr", "7tr", nhà hàng "5tr/bàn", cả hai rỗng "Chưa có giá", bình thường "4tr–5tr"; không "tr–", "0tr–", "tr" trơ | `node eval/T-192/check_3_khoang_gia_dau_rong.cjs` |
| 4 | Chạm số mở ô sửa chứa "20" (số đang phân bổ); gõ 25 + Enter -> hàng đó "25tr", hàng "Tiệc & nhà hàng" vẫn "60tr" | `node eval/T-192/check_4_cham_so_mo_o_sua_dung_so.cjs` |
| 5 | Ba thanh tỷ lệ dài ~20%, 60%, 20% rãnh (sai số 2 điểm) | `node eval/T-192/check_5_thanh_ty_le_theo_so_phan_bo.cjs` |

Mỗi tiêu chí đúng một eval, tầng 1, tất cả ĐỎ trên main `631c942` ở đúng chỗ lỗi (đã chạy). Đã thử xanh bằng bản vá giả ở worktree tạm (eval 1, 4, 5 PASS; eval 3 PASS trừ ca "cả hai rỗng" vì bản vá giả không làm; eval 2 cần hàm định dạng của #85 nên chưa thử xanh, đã đỏ đúng chỗ).

## Bất biến đề xuất (tầng 2)
Vùng `planner/front/budget`: mọi hàng hạng mục của thẻ ngân sách chat có số tiền, không "tr" trơ (phần dùng số nguyên của eval 1). Không đề nghị đổi bất biến cũ.

## Không làm
- Không đổi thẻ so sánh/thẻ chọn vendor khi giá rỗng (chỉ danh sách + chi tiết); không đổi `priceTotal` dùng tính toán, chỉ chữ hiển thị.
- Không sửa nhập số lẻ ở ô sửa (ô chỉ nhận số nguyên như hôm nay).
- Không đổi back, API, admin.

## Câu hỏi mở
Không. Giả định ghi rõ: cả hai đầu rỗng ghi "Chưa có giá" (mượn chữ có sẵn), tự tin ~80%.
