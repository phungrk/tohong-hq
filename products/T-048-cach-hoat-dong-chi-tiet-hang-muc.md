# Spec T-048: Khối "Cách hoạt động" (Tìm, Lưu, Chốt, Vào ngân sách) trong chi tiết hạng mục ngân sách

## Ý định
Capu (2026-11-03), nguyên văn: "Ở trong màn hình detail của hạng mục ngân sách, hãy thêm hướng dẫn tìm vendor -> update ngân sách như hình đính kèm. Vị trí bên trên VENDOR ĐÃ LƯU." Ảnh mẫu: `eval/T-048/mau-capu.jpg`.

## Bằng chứng
- Ý định và ảnh mẫu của Capu là bằng chứng duy nhất cho việc cần có khối này; chưa có dữ liệu người dùng. Mức tự tin về ý định: cao (~90%).
- Khối y hệt ảnh mẫu ĐÃ có ở màn Vendor: `tohong-front/src/screens/VendorFlowSheet.jsx` (`VFlowOverview` = thẻ, `VendorFlowSheet` = sheet "Chi tiết"), dùng ở `src/screens/Vendors.jsx`. Màu, icon, nét đứt của nó đã đúng ảnh mẫu (Tìm `--kim-500`, Lưu `--kim-600`, Chốt `--sage-500`, Vào ngân sách `--son-500`, nét đứt `--son-300`). Chỗ chưa đạt so với spec này: cả thẻ là MỘT nút (không có nút "Chi tiết" riêng), sheet không có role dialog / nút Đóng / Escape, phụ đề sheet chỉ ghi "Lưu → Chốt → Vào ngân sách" (thiếu Tìm), sheet có thanh tiến độ minh hoạ "235tr / 500tr" bịa sẵn, câu bước 4 nói "thanh ngân sách bên dưới".
- Màn chi tiết hạng mục là `BudgetCatDetail` trong `src/screens/Budget.jsx`. Thứ tự hiện tại: tiêu đề hạng mục, thẻ "Dự toán", rồi mục "Vendor đã lưu · N" (chữ hiển thị in hoa nhờ CSS, `.ds-label`), chỉ render khi hạng mục thuộc `VENDOR_CATEGORIES` (10 hạng mục vendor, `src/screens/VendorCtx.jsx`); hạng mục như "Dự phòng phát sinh" không có mục này.
- PR phungrk/tohong-front#56 (T-046) đã merge vào `origin/main` (commit 60a779e) khi viết spec này; nhánh `main` cục bộ ở máy cũ hơn. Đã chạy eval trên `origin/main` (đỏ) và trên nhánh `feat/t046-venue-theo-ban` (đỏ). Eval không phụ thuộc phần nào của T-046.
- Eval đã được kiểm khả thi: dựng thử một bản cài đặt nháp ngoài repo (không commit), cả 6 eval UI xanh, ảnh 390px khớp mẫu.

## Giả thuyết
Nếu hiện hướng dẫn 4 bước ngay trên danh sách vendor đã lưu của từng hạng mục thì người dùng hiểu đường đi Tìm → Lưu → Chốt → vào ngân sách: tỷ lệ hạng mục có vendor đã chốt trên hạng mục có vendor đã lưu tăng. Chỉ số bảo vệ: số liệu ngân sách không đổi; không thêm sự kiện analytics (đo giả thuyết này là việc riêng).

## Hành vi (người dùng thấy gì)
Các câu dưới đây là quyết định đã chốt; mỗi câu chỉ có một cách hiểu.

**Hiện ở đâu, khi nào.**
1. Màn chi tiết của một hạng mục thuộc `VENDOR_CATEGORIES` (những hạng mục có mục "Vendor đã lưu") có đúng một khối "Cách hoạt động". Khối nằm giữa thẻ "Dự toán" và dòng tiêu đề "Vendor đã lưu · N": khối ở dưới thẻ "Dự toán", khối nằm ngoài thẻ "Dự toán" (không nằm trong thẻ đó), dòng tiêu đề "Vendor đã lưu · N" ở ngay dưới khối, cách nhau 0 đến 40px, không có chữ nào chen giữa.
2. Khối hiện cả khi hạng mục chưa có vendor đã lưu (N = 0), khi đã có vendor đã lưu, và khi đã CHỐT một vendor: không bao giờ ẩn theo số vendor hay trạng thái chốt.
3. Hạng mục không có mục "Vendor đã lưu" (vd "Dự phòng phát sinh") không có khối. Đây là chỗ khác với mặc định "mọi hạng mục" của Chief of Staff: hướng dẫn "tìm vendor" vô nghĩa ở hạng mục không có vendor, và Capu chỉ định vị trí là "bên trên VENDOR ĐÃ LƯU".

**Hình khối (theo ảnh mẫu).**
4. Khối là thẻ bo góc có nền và viền riêng. Hàng đầu: icon (i) bên trái, tiêu đề chữ "Cách hoạt động", nút "Chi tiết" kèm mũi tên ">" ở mép phải.
5. Hàng dưới: bốn bước nằm ngang trên một hàng, trái sang phải đúng thứ tự: "Tìm", "Lưu", "Chốt", "Vào ngân sách". Mỗi bước là một icon trong vòng tròn đặc (đường kính từ 28px, icon trắng) và nhãn chữ ngay dưới. Icon: Tìm = kính lúp, Lưu = trái tim, Chốt = dấu tích trong vòng tròn, Vào ngân sách = ví. Ba nét đứt nối bốn vòng tròn, mỗi nét nằm giữa hai vòng tròn liền kề.
6. Màu lấy theo biến CSS có sẵn của app, không viết mã hex trong phần mới: nền vòng tròn Tìm `--kim-500`, Lưu `--kim-600`, Chốt `--sage-500`, Vào ngân sách `--son-500`; nét đứt `--son-300`; chữ nút "Chi tiết" `--son-500`. Biến nào đổi giá trị thì khối đổi theo.
7. Ở 390px, nhãn "Vào ngân sách" xuống đúng hai dòng như mẫu; ba nhãn còn lại đúng một dòng; không nhãn nào bị cắt, tràn ra ngoài thẻ, hay có dấu "...". Ở 320px nhãn "Vào ngân sách" tối đa hai dòng, vẫn không bị cắt. Ở mọi chiều rộng từ 320px, trang không cuộn ngang.

**Truy cập.**
8. "Cách hoạt động" là heading; trên màn chỉ có một heading tên này khi hộp thoại đóng. "Chi tiết" là phần tử `button` thật, tên truy cập đúng "Chi tiết" (mũi tên chỉ trang trí), cao và rộng từ 32px; chỉ nút này mở "Chi tiết", chạm vào phần còn lại của thẻ không làm gì. Bốn bước là bốn `listitem` trong một list, tên đọc được là chữ nhãn. Mọi icon trong khối là trang trí (`aria-hidden="true"`). Nút "Chi tiết" nhận focus bàn phím, Enter và Space đều mở. Chạm thật (bằng chuột/ngón tay) vào bất kỳ chỗ nào khác của thẻ, gồm nhãn bước, icon bước, nét đứt, tiêu đề, lề thẻ, không mở hộp thoại và không làm gì cả; không bọc cả thẻ bằng một vùng bấm được.

**"Chi tiết" mở và đóng (không rời màn).**
9. Bấm "Chi tiết" mở một hộp thoại (role dialog, tên "Cách hoạt động") ngay trong app, kiểu sheet trượt từ dưới lên đã có ở app (xem `VendorFlowSheet`), nằm trọn trong khung 390px. Địa chỉ trang (hash) không đổi, không có yêu cầu mạng mới ngoài phông chữ có sẵn. Khi mở, focus vào trong hộp thoại.
10. Nội dung hộp thoại, đúng từng chữ (so sánh sau khi gộp khoảng trắng): tiêu đề "Cách hoạt động"; dòng phụ "Tìm → Lưu → Chốt → Vào ngân sách"; rồi bốn bước theo thứ tự, mỗi bước một tiêu đề và một đoạn:
    - "Tìm vendor phù hợp": "Hỏi Tơ Hồng gợi ý vendor theo phong cách, ngân sách và khu vực của bạn cho từng hạng mục."
    - "Lưu vendor bạn thích": "Lưu những vendor ưng ý vào từng hạng mục. Vendor đã lưu nằm trong mục Vendor đã lưu của hạng mục đó."
    - "Chốt vendor chính thức": "Khi đã quyết định, bấm Chốt trên vendor đó. Mỗi hạng mục chỉ chốt một vendor."
    - "Tự động vào ngân sách": "Vendor vừa chốt được tính vào chi phí của hạng mục này và vào tổng Đã chốt của ngân sách."
    Hộp thoại không có số tiền minh hoạ hay thanh tiến độ (không có "235tr / 500tr" như sheet ở màn Vendor): hướng dẫn không được trông giống số liệu thật của người dùng. Hộp thoại có thể thêm chip trạng thái "Đang xem xét" / "Đã chốt" nhưng không bắt buộc.
11. Năm cách đóng, cách nào cũng chỉ đóng hộp thoại và trả về đúng màn hạng mục cũ, không đổi địa chỉ: nút "Đóng" (tên truy cập đúng "Đóng"); nút "Đã hiểu"; chạm vùng tối phía trên sheet; phím Escape; nút Back của trình duyệt (theo INV navigation: một lớp mở là một bước lịch sử, Back chỉ đóng lớp đó). Mở hộp thoại thêm đúng một bước lịch sử và đóng bằng giao diện (Đóng, Đã hiểu, chạm vùng tối, Escape) lùi lại bước đó: sau khi đóng, bấm Back MỘT lần là rời hạng mục về màn danh sách Ngân sách (`#/ngan-sach`), không có bước Back chết. Mở hộp thoại rồi tải lại trang: hộp thoại đóng, Back một lần cũng rời hạng mục về `#/ngan-sach`. Ở 1280px hộp thoại nằm trong khung app (rộng tối đa 768px, không phủ cả màn hình) và chạm ngoài khung app đóng nó. Sau khi đóng, focus về nút "Chi tiết"; hộp thoại không còn trong cây truy cập (không còn role dialog); mở lại bao nhiêu lần cũng được.

**Không đổi.**
12. Mở màn, mở và đóng "Chi tiết" không đổi một chữ nào khác trên màn (dự toán, danh sách vendor, nhãn trạng thái), không gửi PUT/POST nào, không đổi số liệu ngân sách. Không thêm sự kiện analytics.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-front` · Nhánh: `feat/t048-cach-hoat-dong` tách từ `origin/main` (đã có T-046) · Vùng (`area`): `planner/front/budget`
- Bất biến của vùng đã đọc: `eval/invariants/planner/front/budget/` (INV-001 một con số, INV-002 không đoán số, INV-003 mở màn không đụng dữ liệu), `.../layout/` (INV-001..006: khung, không cuộn ngang, chạm ngoài khung đóng lớp trên cùng), `.../navigation/` (INV-001..006: Back đóng lớp trên cùng). Spec này không vi phạm INV-nào. LƯU Ý CỔNG: `gate.py` chỉ chạy bất biến trong đúng thư mục của area (`planner/front/budget`), không chạy `layout/` và `navigation/`. Vì vậy tiêu chí 8 chạy toàn bộ hai nhóm đó bằng script riêng, và hộp thoại mới có eval của chính T-048 cho Back, bước chết, 1280px (tiêu chí 5), vì lib của navigation INV-002 chưa liệt kê lớp này và không bị sửa. Gợi ý cho Engineering: dùng `useHistoryLayer` (`src/nav.js`) và `useOutsideFrameDismiss` như các sheet khác.
- Kiến trúc / design system phải theo: `DESIGN.md`, token trong `src/index.css`, component `Icon` (`src/ui/Icon.jsx`; tên icon `search`, `heart`, `check-circle-2`, `wallet`, `info`, `chevron-right` đã có), khối và sheet ở `src/screens/VendorFlowSheet.jsx`. Nên dùng chung / tách component từ file đó thay vì dựng bản thứ hai. Màn Vendor không thuộc việc này: nếu dùng chung component thì chữ và hình ở màn Vendor giữ nguyên (không có eval riêng; Engineering ghi vào diff hành vi).
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, số liệu ngân sách, analytics.
- Bậc lưới lọc: A (đã đặt bởi Chief of Staff) — UI thuần, eval tự động phủ hết tiêu chí, không chạm ranh giới cứng.

## Tiêu chí chấp nhận và eval
Chạy tất cả: `cd /home/user/tohong-hq && bash eval/T-048/run_invariants.sh /home/user/tohong-front; for n in 1 2 3 4 5 6; do bash eval/T-048/run.sh /home/user/tohong-front --only $n; done; python3 eval/T-048/check_pr.py /home/user/tohong-front`. Tiêu chí 8: `bash eval/T-048/run_invariants.sh /home/user/tohong-front`. Trên `origin/main` và trên `feat/t046-venue-theo-ban` tiêu chí 1-7 hiện đỏ đúng lý do (chưa có khối); đã kiểm. Brief TC5 ("không đổi hành vi ngân sách; bất biến planner/front/* xanh") = tiêu chí 6 + 8.

| # | Tiêu chí (có/không) | Eval (lệnh chạy được) |
| --- | --- | --- |
| 1 | Hạng mục vendor (venue có 1 vendor đã lưu, photography 0, decor 1, decor đã chốt vendor; N trên tiêu đề phải đúng số đã gieo) có đúng một khối, nằm dưới đáy thẻ "Dự toán", ngay trên "Vendor đã lưu · N", không có chữ chen giữa; hạng mục không có mục "Vendor đã lưu" không có khối (hành vi 1-3) | `cd /home/user/tohong-hq && bash eval/T-048/run.sh /home/user/tohong-front --only 1` |
| 2 | Tiêu đề + icon (i) + "Chi tiết >"; 4 bước đúng thứ tự trên một hàng; vòng tròn đặc đúng token màu; 3 nét đứt `--son-300` giữa các vòng; thẻ bo góc (hành vi 4-6) | `cd /home/user/tohong-hq && bash eval/T-048/run.sh /home/user/tohong-front --only 2` |
| 3 | Truy cập: heading, nút "Chi tiết" thật (một nút, tên đúng, từ 32px), list 4 listitem, icon aria-hidden, Enter/Space mở, click thật vào nhãn/icon/tiêu đề/nét đứt/lề thẻ không mở gì, focus vào hộp thoại và về lại (hành vi 8) | `cd /home/user/tohong-hq && bash eval/T-048/run.sh /home/user/tohong-front --only 3` |
| 4 | 390px và 320px không cuộn ngang, nhãn không bị cắt, "Vào ngân sách" đúng 2 dòng ở 390px; 1024px không cuộn ngang (hành vi 7) | `cd /home/user/tohong-hq && bash eval/T-048/run.sh /home/user/tohong-front --only 4 --shots /tmp/t048-shots` |
| 5 | "Chi tiết" mở hộp thoại đúng nội dung từng chữ, không số tiền, không đổi địa chỉ, không mạng ngoài; đóng được bằng 5 cách; sau mỗi cách đóng bằng giao diện Back một lần rời về `#/ngan-sach`; mở rồi tải lại rồi Back một lần cũng vậy; 1280px hộp thoại trong khung và chạm ngoài khung đóng; mở lại được (hành vi 9-11) | `cd /home/user/tohong-hq && bash eval/T-048/run.sh /home/user/tohong-front --only 5` |
| 6 | Không đổi hành vi ngân sách: chữ trên màn trước và sau khi mở/đóng "Chi tiết" y hệt, 0 PUT/POST, các phần cũ còn đủ (hành vi 12) | `cd /home/user/tohong-hq && bash eval/T-048/run.sh /home/user/tohong-front --only 6` |
| 7 | Ảnh PNG 390px (`docs/screenshots/T-048/*390*.png`, rộng 390/780/1170) đã commit trong tohong-front và được nhúng bằng ảnh markdown trong mô tả PR | `cd /home/user/tohong-hq && python3 eval/T-048/check_pr.py /home/user/tohong-front [--pr N]` |
| 8 | Toàn bộ bất biến `planner/front/layout/inv-*` và `navigation/inv-*` xanh trên repo front (cổng không tự chạy hai nhóm này) | `cd /home/user/tohong-hq && bash eval/T-048/run_invariants.sh /home/user/tohong-front` |

Ghi chú cho người chạy:
- Chụp ảnh: `bash eval/T-048/run.sh /home/user/tohong-front --only 4,5 --shots <thư-mục>` ra `budget-detail-390.png` (màn hạng mục) và `budget-detail-390-chi-tiet.png` (hộp thoại mở); đổi tên thành `docs/screenshots/T-048/budget-detail-390.png`, commit, nhúng vào PR. Eval 7 chỉ kiểm có ảnh hợp lệ trong repo và PR; việc ảnh đúng là màn chi tiết hạng mục do adversary nhìn ở Code Gate.
- Eval chạy trên bản build tạm với API giả, mạng ngoài bị chặn (cho qua phông chữ có sẵn). Hạng mục thử: `venue` (1 vendor đã lưu), `photography` (0), `decor` (1), `reserve` (không có mục vendor). Harness gieo `th_user` để không bị màn chào mừng chắn.
- Eval tìm phần tử theo chữ và vai trò (getByRole, listitem, dialog, tên truy cập). Chỗ duy nhất đọc style tính toán là so MÀU nền vòng tròn / nét đứt / chữ link với giá trị của biến CSS, và đo hình học (vị trí, số dòng) — không dùng bộ chọn theo style, class hay cấu trúc component.

## Bất biến đề xuất (tầng 2)
- planner/front/budget: "Mọi lớp mở từ màn chi tiết hạng mục (hộp thoại 'Cách hoạt động') là role dialog, đóng được bằng Escape / Back / chạm ngoài, và không phát PUT/POST." Đề xuất để spec-critic cân nhắc rút từ eval 3, 5, 6 khi spec qua cổng; tôi không tự thêm vào bể.
- Không sửa lib navigation INV-002 (bất biến có sẵn). Bất biến tổng quát cho mọi hộp thoại mới sẽ do spec-critic rút khi spec qua cổng; eval 5 của T-048 đã đo hai vế (Back đóng lớp, đóng bằng giao diện không để bước chết).

## Không làm
- Không đổi màn Vendor (tab "Vendor đã lưu"), không đổi cách tính tiền, số bàn, dự toán, chốt/hủy chốt.
- Không thêm analytics, không thêm API, không đổi dữ liệu lưu.
- Không thêm khối vào hạng mục không có mục "Vendor đã lưu", không thêm vào màn danh sách Ngân sách.
- Không làm thanh tiến độ minh hoạ trong hộp thoại.
- Không đóng cứng mã hex trong phần mới (trừ màu trắng của icon trên vòng tròn nếu app chưa có biến trắng dùng được; `--white` có sẵn nên ưu tiên biến).

## Câu hỏi mở
Không. (Hai quyết định tôi tự chốt và nêu để Chief of Staff biết: khối chỉ hiện ở hạng mục có mục "Vendor đã lưu", không phải "mọi hạng mục"; nội dung hộp thoại ở hành vi 10, đã bỏ số liệu minh hoạ 235tr/500tr.)
