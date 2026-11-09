# Spec T-114: Bỏ chữ "Ảnh minh hoạ" hiển thị trên ô ảnh vendor

## Ý định
Capu 2026-11-09, sau khi xem ảnh chụp mobile trang "Nhẫn cưới & trang sức": "Bỏ text ảnh minh hoạ". Chữ "Ảnh minh hoạ" in đè lên ô ảnh minh hoạ.

## Bằng chứng
- Ảnh chụp màn hình Capu gửi (chat 2026-11-09). Em không xem được ảnh, chỉ có mô tả của Chief of Staff; tự tin ~90% rằng "text" là chip.
- Đọc code `tohong-front` origin/main `src/vendorIllustrations.jsx`: chữ hiển thị chỉ do một dòng sinh ra, chip `<span aria-hidden>Ảnh minh hoạ</span>` khi `chip` bật. `git grep "minh ho" origin/main -- src` không thấy chỗ nào khác in chữ này cho người dùng.
- Chip chỉ bật ở 2 nơi, cả hai trong `src/screens/chat/VendorChatCards.jsx`: dòng 320 (bề mặt 1, thẻ danh sách gợi ý, ô 100px) và dòng 558 (bề mặt 2, gallery chi tiết, cao 150). Các nơi còn lại (VendorChatCards 757, 796; Vendors.jsx:30; Budget.jsx:194) không có chip.
- Đọc bất biến: xem mục "Ràng buộc".

## Giả thuyết
Bỏ chip thì ảnh minh hoạ sạch hơn, không còn chữ đè lên; cặp đôi vẫn nhận ra đây là hình vẽ vì nó là hình nét viền, không phải ảnh thật. Chỉ số bảo vệ: ô có ảnh thật không đổi; trình đọc màn hình vẫn đọc "Ảnh minh hoạ: <hạng mục>"; không cuộn ngang ở 390px. Rủi ro đã biết (giả định, ~60%): bỏ chữ thì một số người có thể tưởng hình vẽ là ảnh thật của vendor. Capu đã chọn, ghi nhận để Insight theo dõi.

## Hành vi (người dùng thấy gì)
1. Mọi bề mặt có ô minh hoạ (thẻ danh sách gợi ý trong chat, gallery chi tiết, thẻ chọn so sánh, bảng so sánh, Vendor đã lưu, chi tiết vendor ở Ngân sách): ô chỉ hiện hình vẽ của hạng mục. KHÔNG có chữ "Ảnh minh hoạ" nhìn thấy ở bất kỳ vị trí nào trong trang: không chip, không chữ trong svg, không nội dung `::before`/`::after`. Quy tắc này áp cho mọi ô, kể cả ô lớn (>= 80px) và ô nhỏ.
2. Tên truy cập giữ nguyên: phần tử bao ô vẫn là `role="img"` với `aria-label` = `Ảnh minh hoạ: <tên hạng mục>` (hạng mục lạ: `Ảnh minh hoạ`). Kích thước ô, hình vẽ, màu không đổi.
3. Ô lớn (cạnh ngắn >= 80px, bề mặt 1 và 2): như hiện nay, KHÔNG có thuộc tính `title`, và chuột/chạm đi xuyên qua ô (bấm vào hình thì thẻ bên dưới vẫn nhận bấm như cũ). Bỏ chip không được làm ô bắt chuột hay hiện tooltip mới.
4. Ô nhỏ (cạnh ngắn < 80px, bề mặt 3, 4, 5, 6): giữ nguyên `title` = tên truy cập (xem quyết định tooltip bên dưới).
5. Ô có ảnh thật, hoặc đang kiểm ảnh: không đổi gì (vẫn không có hình vẽ, không có chữ).

## Ràng buộc (vòi)
- Repo: `tohong-front` · Nhánh: `t-114-bo-chu-minh-hoa` · Vùng: `planner/front/vendor-images`
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/`, `planner/front/`, `planner/front/vendor-images/` (INV-001..004 và lib), spec `products/T-066-anh-minh-hoa-tu-tao.md` v2. Spec này KHÔNG vi phạm INV-001..004, không cần ADR sửa bất biến. Căn cứ:
  - INV-001 (đo bằng `lib/vendor_img_inv.cjs --only 1`) đòi "ô role=img tên 'Ảnh minh hoạ: <hạng mục>'": đó là tên truy cập, không phải chữ hiển thị. Phần kiểm "ô >= 80px phải có chữ nhãn" (`checkTile`, mục `!t.chip`) chỉ báo vào nhóm lỗi 2, mà không bất biến nào gọi (inv-001 chạy `--only 1`, inv-002 `--only 3`, inv-003 `--only 4`). Lib vẫn còn dòng đó vì là bản sao của eval T-066 tiêu chí 2; nó không có hiệu lực trong bể.
  - INV-002 (svg nội bộ, token, 10 hình): không liên quan chữ.
  - INV-003: "ô có ảnh thật không mang nhãn" vẫn đúng (mạnh hơn). "ảnh treo quá 8 giây thì sang minh hoạ có nhãn": lib đếm ô `role=img` có tên, không đếm chữ nhìn thấy; "nhãn" ở đây là tên truy cập. Chạy lib với `--only 1,3,4` và `small_tile_tooltip.cjs` trên bản thử đã bỏ chip (bản sao ở scratchpad, đã xoá): xanh.
  - INV-004: tooltip ô nhỏ. Giữ (xem dưới).
  - Hệ quả: các comment trong inv-001/002/003 ("nhãn 'Ảnh minh hoạ'") và `products/T-066` M4 còn nói chữ nhìn thấy cho ô >= 80px; đề nghị Chief of Staff ghi ADR ngắn: "M4 của T-066 về chữ nhìn thấy ở ô >= 80px bị T-114 thay thế; `title` ô nhỏ và tên truy cập giữ". Không cần sửa mã bất biến. Lib dòng chip chỉ lệch comment, không đụng.
- Quyết định tooltip (INV-004): GIỮ. Lý do: tooltip là thuộc tính `title`, chỉ hiện khi rê chuột trên máy tính ở ô 32-74px, không phải chữ đè lên ảnh như ảnh chụp mobile của Capu; bỏ nó cần sửa INV-004 và không có bằng chứng Capu muốn vậy. Nếu Capu muốn bỏ luôn cả tooltip, đó là việc riêng (T-xxx) kèm ADR sửa INV-004 (xem Câu hỏi mở).
- Kiến trúc: giữ một component `VendorIllustration` duy nhất; chữ chip không còn nơi nào dùng thì bỏ cả hằng chip và prop `chip`/`chipBottom` ở nơi gọi (không bắt buộc; hành vi mới là thứ được kiểm). Dải "PHÙ HỢP NHẤT" ở đáy ô hạng 1 không đổi.
- Không chạm: payment, auth, DB, dữ liệu người dùng.
- Bậc đề xuất: A (UI, eval tự động phủ hết tiêu chí).

## Tiêu chí chấp nhận và eval
Một lần chạy `check_ui.cjs` đo cả năm tiêu chí, mỗi dòng ra `C<n> PASS|FAIL`. Đo trên DOM thật bằng Playwright (Chromium 390px) với vite dev qua `eval/_lib/vite_dev.cjs`, cùng dữ liệu giả và 6 bề mặt như bất biến vendor-images (10 hạng mục ở bề mặt 1; photography và transport ở bề mặt 2-4; photography, jewelry ở bề mặt 5-6).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Trên 6 bề mặt ở trạng thái ảnh hỏng/thiếu, trong toàn trang không có text node hay `::before/::after` nhìn thấy chứa "Ảnh minh hoạ" (kể cả chip trong ô) | `bash eval/T-114/run.sh /home/user/tohong-front 1` |
| 2 | Mỗi ô minh hoạ vẫn có `role=img`, `aria-label` bắt đầu "Ảnh minh hoạ" và đúng hạng mục, đúng khung ảnh cũ; ô < 80px có `title` = aria-label; ô >= 80px không có `title` | `bash eval/T-114/run.sh /home/user/tohong-front 2` |
| 3 | Ô có ảnh thật hoặc đang kiểm ảnh (kể cả tải chậm, treo dưới 8 giây) không có hình vẽ và không có chữ; ảnh thật vẫn hiện; ảnh treo quá 8 giây vẫn sang hình vẽ | `bash eval/T-114/run.sh /home/user/tohong-front 3` |
| 4 | Ô >= 80px không bắt chuột: phần tử trúng chuột ở tâm ô không nằm trong ô minh hoạ | `bash eval/T-114/run.sh /home/user/tohong-front 4` |
| 5 | Khung 390px không cuộn ngang ở các bề mặt | `bash eval/T-114/run.sh /home/user/tohong-front 5` |

Kết quả đã chạy (2026-11-09, hai bản thử tạm ở scratchpad riêng, đã xoá, không sửa repo front): main hiện tại: C1 FAIL (chip ở bề mặt 1 và 2), C2-C5 PASS. Bản đúng (bỏ chip, giữ pointer-events none và không title): C1-C5 PASS. Bản sai (bỏ chip nhưng ô lớn bắt chuột và có title): C1 PASS, C2 FAIL, C4 FAIL, chứng tỏ eval bắt được cách hiểu "chỉ xoá chữ".

Bất biến vendor-images (INV-001..004) giữ nguyên, kiểm trên bản đúng: xanh. Gate chạy chúng ở tầng 2.

## Bất biến đề xuất (tầng 2)
Có, một (cho spec-critic): vùng `planner/front/vendor-images`: "Không có chữ 'Ảnh minh hoạ' nhìn thấy (text node hoặc pseudo-element) ở bất kỳ bề mặt vendor nào; tên truy cập `role=img` vẫn đúng." Viết được từ `eval/T-114/check_ui.cjs` tiêu chí 1. Nên rút vào bể sau khi việc qua Code Gate, vì nó chống chip quay lại (ví dụ ai đó làm lại nhãn theo T-066 M4).

## Không làm
- Không đổi hình vẽ, màu, kích thước, quy tắc khi nào hiện minh hoạ, bất biến INV-001..004.
- Không bỏ `aria-label`, `role=img`, hay tooltip ô nhỏ.
- Không thêm chữ thay thế ("Hình minh hoạ", biểu tượng "i", …).
- Không đổi thông điệp khác trong app.

## Câu hỏi mở
Capu có muốn bỏ luôn tooltip khi rê chuột ở ô nhỏ (INV-004) không? Mặc định spec này giữ; muốn bỏ thì mở việc riêng kèm ADR sửa INV-004.
