# Spec T-066: ảnh minh hoạ tự tạo theo hạng mục khi ảnh vendor hỏng

## Ý định
Capu, 2026-11-05: "Trong trường hợp ảnh hỏng thì hãy dùng ảnh tự tạo." Khi ảnh vendor hỏng hoặc không có, app hiện ảnh minh hoạ do Tơ Hồng tự vẽ (không lấy ảnh bên thứ ba) thay cho nền gradient trơn của T-052, và ghi rõ đó là ảnh minh hoạ. Nguồn: `board/T-066.md`, `products/T-051-tu-host-anh-vendor.md` mục 31-33.

## Bằng chứng
- Mã nguồn `tohong-front` ở origin/main (đã đọc): `src/vendorImageUrls.js` (`CAT_FALLBACK_GRAD`, chỉ 4 hạng mục có gradient riêng, còn lại dùng gradient chung), `src/vendorImages.js` (`useVendorBackgrounds`, `useSavedVendorPhotoBg`: ảnh chỉ được dùng khi đã tải thành công), `src/screens/chat/VendorChatCards.jsx`, `src/screens/Vendors.jsx`, `src/screens/Budget.jsx`.
- Hạng mục vendor có trong dữ liệu: đúng 10, theo `VENDOR_CATEGORIES` (`src/screens/VendorCtx.jsx`) và `CATEGORIES` của back (`tohong-back/lib/vendorMatcher.js`): `venue` Tiệc & nhà hàng, `ceremony` Ăn hỏi & sính lễ, `photography` Chụp ảnh / quay, `jewelry` Nhẫn cưới & trang sức, `attire` Trang phục, `decor` Trang trí & hoa, `makeup` Trang điểm & làm tóc, `transport` Xe hoa & đưa đón, `stationery` Thiệp & quà tặng, `honeymoon` Tuần trăng mật. `reserve` chỉ có ở Ngân sách, không có vendor. MC, ban nhạc, hoa riêng KHÔNG phải hạng mục trong dữ liệu (hoa nằm trong `decor`), nên không vẽ.
- Hiện app không có giao diện tối (`src/index.css` không có `prefers-color-scheme`); "nền tối" trong tiêu chí được đo bằng cách đảo toàn bộ token màu (xem tiêu chí 3).
- `src/screens/Vendors.jsx` (bề mặt 5) không còn được import ở đâu: màn này hiện không tới được từ giao diện. Mức tự tin 90% (grep toàn `src`).

## Giả thuyết
Nếu thay gradient trơn bằng minh hoạ đúng hạng mục kèm nhãn thì cặp đôi nhận ra ngay "đây là ảnh minh hoạ, vendor chưa có ảnh" thay vì tưởng app lỗi hay ảnh bị mất. Chỉ số bảo vệ: ảnh tốt vẫn hiện như cũ; không thêm yêu cầu mạng; không cuộn ngang ở 390px.

## Hành vi (người dùng thấy gì)

Thuật ngữ. **Ô ảnh** là khung ảnh vendor ở một bề mặt, giữ nguyên kích thước và vị trí hiện tại. **Ảnh dùng được** là ảnh đã tải thành công (đúng nghĩa mục 31 của T-051). **Ảnh không dùng được** là: vendor có danh sách ảnh rỗng, hoặc mọi ảnh đều tải hỏng (HTTP lỗi, trả HTML). **Đang kiểm** là khoảng từ lúc mở trang đến khi biết chắc ô có ảnh dùng được hay không (bề mặt 5-6: gồm cả lúc đang tra pool theo id, T-051 mục 33).

**M1. Trạng thái của một ô ảnh** (đúng một trong ba):
1. Có ảnh dùng được: hiện ảnh thật như hiện nay. Không có minh hoạ, không có nhãn "Ảnh minh hoạ".
2. Đang kiểm: giữ đúng cách hiện hiện tại của bề mặt (nền gradient danh mục ở bề mặt 1-5; nền sage/sand kèm biểu tượng cửa hàng ở bề mặt 6). KHÔNG hiện minh hoạ và KHÔNG hiện nhãn, để vendor có ảnh tốt không nhấp nháy nhãn sai rồi đổi sang ảnh thật. Quy tắc "không gửi yêu cầu tới URL ảnh đã lưu trước khi tra xong" của T-051 mục 33(e) giữ nguyên.
3. Ảnh không dùng được: hiện minh hoạ của hạng mục (M2) kèm nhãn (M4). Không bao giờ ô trống hay khung vỡ. Vendor chưa có ảnh nào (danh sách rỗng) vào thẳng trạng thái này, không qua "đang kiểm".

Gallery chi tiết (bề mặt 2): chỉ gồm ảnh dùng được. Còn ít nhất một ảnh dùng được thì chỉ hiện các ảnh đó (không minh hoạ, không nhãn). Hết ảnh dùng được thì hiện đúng một minh hoạ phủ cả gallery, không chấm chuyển ảnh.

**M2. Minh hoạ theo hạng mục.** Mỗi trong 10 hạng mục có một minh hoạ svg riêng, nhận ra được là hạng mục đó (gợi ý hình: venue bàn tiệc hoặc ly; ceremony tráp hoặc đôi tim; photography máy ảnh; jewelry nhẫn; attire áo dài hoặc váy; decor bó hoa; makeup cọ hoặc gương; transport xe hoa; stationery thiệp và phong bì; honeymoon cây dừa hoặc máy bay). Mười minh hoạ đôi một khác nhau. Cùng hạng mục thì mọi vendor, mọi bề mặt, mọi kích thước đều ra cùng một hình (co giãn theo ô, giữ tỉ lệ, nằm giữa ô). Vendor ảnh hỏng và vendor không có ảnh ra cùng một minh hoạ.

**M3. Nét vẽ và màu.** Minh hoạ là svg nằm trực tiếp trong trang (inline). Không thẻ `<img>`, không `background-image` url, không `<image>`, không tham chiếu `http(s):` hay `url()` ra ngoài, không tải thêm file `.svg`/ảnh/font. Mọi màu lấy từ token màu của app (`var(--…)` đặt qua `style` hoặc CSS; lưu ý thuộc tính trình bày `fill="var(--x)"` không chạy trong trình duyệt nên không dùng), không viết cứng hex/rgb/hsl. Mỗi minh hoạ có một cặp nét và nền đặt cạnh nhau (ví dụ huy hiệu tròn nền `--paper`, nét `--ink-700`) để đọc được dù ô nằm trên nền nào, tương phản cặp này >= 3:1. Khi toàn bộ token bị đảo sang bảng tối thì màu minh hoạ đổi theo token và cặp này vẫn >= 3:1. Mỗi minh hoạ nặng không quá 4096 byte (`outerHTML` của svg). Nền gradient danh mục (bề mặt 1-5) và nền sage/sand (bề mặt 6) giữ làm nền sau minh hoạ, không bỏ (để eval T-051 mục 9 và 10 còn xanh).

**M4. Nhãn.** Cả hai phần đều bắt buộc cho ô ở trạng thái 3:
- Tên truy cập: phần tử bao ô ảnh có `role="img"` và `aria-label` = `Ảnh minh hoạ: <tên hạng mục>` với tên đúng như `VENDOR_CATEGORIES[].name` (vd `Ảnh minh hoạ: Chụp ảnh / quay`). Hạng mục lạ (M5) chỉ có `Ảnh minh hoạ`. Phần tử `role="img"` này có đúng kích thước khung ảnh cũ: bề mặt 1 là 100x100; bề mặt 2 rộng bằng thẻ, cao 150; bề mặt 3 là 40x40; bề mặt 4 là 74x30; bề mặt 5 là 32x32; bề mặt 6 là 56x56.
- Nhãn chữ nhìn thấy "Ảnh minh hoạ" khi ô có cạnh ngắn >= 80px (tức bề mặt 1 và 2): đặt ở nửa dưới ô, sát góc dưới trái, nằm gọn trong ô; chữ >= 12px; chiếm <= 20% diện tích ô; không đè lên chữ hay nút nào khác trong ô (nhãn "#hạng", nút tim, dải "PHÙ HỢP NHẤT" ở đáy ô hạng 1: nhãn nằm ngay trên dải đó); chữ nhãn tương phản >= 4.5:1 với nền nhãn (nền nhãn đặc, độ mờ nền >= 0.75 nếu dùng rgba). Nhãn chữ là phần trang trí đối với trình đọc màn hình (đã có `aria-label`).
- Ô có cạnh ngắn < 80px (bề mặt 3, 4, 5, 6) không đủ chỗ cho chữ: không hiện nhãn chữ, thay bằng thuộc tính `title` đúng bằng `aria-label` (tooltip khi rê/nhấn giữ).

**M5. Hạng mục lạ hoặc không xác định** (không thuộc 10 hạng mục, rỗng, null, undefined, `reserve`): dùng một minh hoạ chung (hình đôi tim hoặc hoa văn cưới trung tính), khác cả 10 hình trên, cùng ràng buộc M3, nhãn là `Ảnh minh hoạ` không kèm hạng mục. Hiện UI không có đường nào tới nhánh này (mọi bề mặt chỉ nhận 10 hạng mục), nhánh vẫn phải có làm dự phòng.

**M6. Phạm vi: sáu bề mặt** (T-051 mục 32): (1) thẻ danh sách gợi ý; (2) thẻ chi tiết (gallery); (3) thẻ chọn so sánh (ảnh anchor và ảnh từng hàng); (4) bảng so sánh (ảnh đầu mỗi cột); (5) màn "Vendor đã lưu" (ảnh 32px; `Vendors.jsx` vẫn chưa được gắn vào giao diện, vẫn sửa để khi gắn lại không mất minh hoạ); (6) tiêu đề "Chi tiết vendor" 56px ở Ngân sách: ở trạng thái 3 minh hoạ thay biểu tượng cửa hàng, nền sage/sand giữ nguyên. Ở đó hạng mục lấy từ hạng mục đang mở của Ngân sách.

**M7. Không đổi dữ liệu, API, localStorage, thứ tự vendor.** 390px không cuộn ngang ở mọi bề mặt (khung bảng so sánh đã tự cuộn ngang bên trong thẻ thì vẫn được, tài liệu và body thì không).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `t-066-anh-minh-hoa` · Vùng (`area`): `planner/front/vendor-images`
- Bất biến đã đọc: `eval/invariants/_shared/` (INV-001, INV-002) và `planner/front/{layout,navigation,budget,loading}` (cha gần nhất của vùng; `planner/front/vendor-images` chưa có bất biến riêng). Spec này không vi phạm: không đổi khung (layout INV khung/cuộn ngang), không đổi điều hướng, không đổi số liệu ngân sách, không thêm vùng chờ (loading). Cần chú ý layout `inv-002-khong-cuon-ngang`.
- Kiến trúc / design system: token màu trong `src/index.css`; ảnh vendor đã đi qua `src/vendorImages.js`, `src/vendorImageUrls.js` (giữ `CAT_FALLBACK_GRAD` làm nền sau). Mục "Chức năng bắt buộc không được xoá" (`BotMarkdown`…) không liên quan nhưng không được đụng.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, API, localStorage, dịch vụ trả phí.
- Bậc lưới lọc đề xuất: A. Chỉ giao diện front, eval tự động phủ tiêu chí 1-5, 7, 8; riêng tiêu chí 6 là checklist vì nhánh không có đường vào từ UI.
- Tối thiểu cho PR: ảnh chụp 390 trước và sau cho cả 6 bề mặt (12 ảnh, tiêu chí 8).

## Tiêu chí chấp nhận và eval
Dữ liệu giả: mỗi hạng mục có vendor "Tot" (ảnh tốt), "Hong" (ảnh 404), "Khong" (không ảnh), "Cham" (ảnh tốt nhưng tải chậm 3,5s). Thân eval nằm ở `eval/T-066/check_ui.cjs`; mỗi tiêu chí in một dòng `C<n> PASS|FAIL`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Ảnh hỏng hoặc thiếu ở cả 6 bề mặt cho đúng 1 ô `role="img"` tên bắt đầu `Ảnh minh hoạ` có tên đúng hạng mục, đúng khung ảnh cũ; vendor ảnh hỏng và ảnh thiếu ra cùng minh hoạ; quét đủ 10 hạng mục ở bề mặt 1, 2 hạng mục (photography, transport) ở bề mặt 2-4, hạng mục photography và jewelry ở bề mặt 5, photography ở bề mặt 6 | `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 1` |
| 2 | Nhãn: ô >= 80px có chữ "Ảnh minh hoạ" nửa dưới, gọn trong ô, >= 12px, <= 20% diện tích, không đè, tương phản >= 4.5:1; mọi ô có `aria-label` bắt đầu "Ảnh minh hoạ"; ô < 80px có `title` = `aria-label` | `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 2` |
| 3 | Minh hoạ là svg inline, không `<img>`/url ngoài/file svg/yêu cầu mạng ngoài, không màu viết cứng, <= 4096 byte, cặp nét/nền >= 3:1 ở bảng token thường và bảng token đảo (màu đổi theo token), 10 hạng mục ra 10 hình khác nhau | `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 3` |
| 4 | Ảnh tốt vẫn là ảnh thật, không minh hoạ, không nhãn (kể cả ảnh tải chậm sau 3,5s); lúc đang kiểm (ảnh chưa tải xong, đang tra pool ở bề mặt 5) giữ cách hiện cũ, không minh hoạ, không nhãn | `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 4` |
| 5 | Khung 390px: `documentElement` và `body` không rộng hơn 390 ở cả 6 bề mặt | `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 5` |
| 6 | Hạng mục lạ/không xác định dùng một minh hoạ chung (M5). Checklist, vì không có đường vào từ giao diện để ép nhánh này mà không nhắc tới cách cài đặt | `eval/T-066/checklist.md` |
| 7 | Bất biến front (layout, navigation, budget, loading, `_shared`) vẫn xanh | `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 7` |
| 8 | PR có đủ 12 ảnh 390 (6 bề mặt x trước/sau) đã commit ở `docs/screenshots/T-066/<bề-mặt>-390-<truoc\|sau>.png` và nhúng trong mô tả PR; PR tự tìm theo tên nhánh `t-066-anh-minh-hoa` qua REST (ADR-020) | `cd /home/user/tohong-hq && python3 eval/T-066/check_pr.py /home/user/tohong-front` |

Tạo ảnh cho PR: `cd /home/user/tohong-hq && bash eval/T-066/run.sh /home/user/tohong-front --only 1 --shots /home/user/tohong-front/docs/screenshots/T-066 --tag truoc` chạy trên main (trước khi sửa), rồi `--tag sau` trên nhánh việc. Mô tả PR nhúng bằng công cụ GitHub MCP `update_pull_request` (ADR-020 mục 3).

Đã chạy trên main (2026-11-05): C1, C2, C3 FAIL; C4, C5 PASS (hồi quy: ảnh tốt, đang kiểm và khung 390 đã đúng, phải giữ đúng); C7 PASS; C8 FAIL (chưa có ảnh/PR). Đã kiểm eval có thể xanh: một bản thử tạm (ngoài repo, đã bỏ) vẽ minh hoạ ở cả 6 bề mặt cho C1 và C2 xanh; C3 đỏ chỉ vì bản thử dùng chung một hình; C4 đỏ vì bản thử hiện minh hoạ cả lúc đang kiểm.

## Bất biến đề xuất (tầng 2)
Vùng `planner/front/vendor-images`: (a) ô ảnh vendor có ảnh không dùng được luôn có phần tử `role="img"` tên `Ảnh minh hoạ…` và không bao giờ trống hay khung vỡ; (b) ô có ảnh thật không bao giờ mang nhãn "Ảnh minh hoạ"; (c) chuỗi svg minh hoạ không chứa màu viết cứng hay tham chiếu mạng. Viết được thành `inv-*.sh` bằng đúng harness của C1, C3, C4 rút gọn.

## Không làm
- Không dùng ảnh stock hay ảnh của bên thứ ba; không tạo ảnh bằng dịch vụ trả phí.
- Không vẽ minh hoạ cho MC, ban nhạc (không phải hạng mục trong dữ liệu).
- Không đổi API, dữ liệu, localStorage, thứ tự vendor, quy tắc tra pool của T-051 mục 33.
- Không gắn lại `Vendors.jsx` vào giao diện; không thêm giao diện tối (chỉ bảo đảm minh hoạ đi theo token).
- Không thêm thư viện, không thêm file ảnh/svg vào `public/` hay `assets/`.
- Không sửa eval của T-051 hay bất biến trong bể.

## Câu hỏi mở
Không. (Giả định đã tự quyết, Capu có thể đảo: ô ảnh < 80px chỉ có tên truy cập và tooltip, không có chữ nhìn thấy, vì không đủ chỗ; trong lúc đang kiểm ảnh giữ cách hiện cũ thay vì hiện minh hoạ, để khỏi gắn nhãn sai lên vendor có ảnh tốt.)
