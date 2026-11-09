# Spec T-115: Modal onboarding bước 2/3 cao hơn trên điện thoại

## Ý định
Capu (2026-11-09, ảnh chụp iPhone Safari ~390x844, thanh địa chỉ dưới): ở bước 2/3 "Kế hoạch đám cưới", mục số khách bị nút "Tiếp theo" che, chỉ thấy mép chữ. Capu muốn modal cao hơn.

## Bằng chứng
Đo bằng Playwright trên `tohong-front` origin/main a7e5807 (`src/screens/Onboarding.jsx`), 2026-11-09, đo lại được bằng `eval/T-115/lib.cjs`. Mục trong app ghi "Số khách dự kiến" (không phải "Số khách mời"); spec dùng nhãn trong app và nhận diện mục bằng chữ bắt đầu "Số khách". Thứ tự mục: Ngày cưới, Tổ chức tại, Ngân sách, Số khách. Vùng nội dung đã cuộn được (`overflow-y:auto`), nhưng chưa có gì báo cho người dùng biết là còn nội dung bên dưới.

| Viewport | Sheet (đỉnh / cao) | Vùng nội dung (đỉnh..đáy) | Tiêu đề Số khách (đỉnh) | Hàng lựa chọn đầu (đỉnh..đáy) | Footer (đỉnh / cao) | Footer che hàng lựa chọn đầu |
| --- | --- | --- | --- | --- | --- | --- |
| 375x667 | 76 / 591 | 174..548 | 530 | 554..588 | 548 / 119 | che 40px (cả hàng; chỉ thấy 18px tiêu đề) |
| 390x844 | 76 / 768 | 174..725 | 530 | 554..588 | 725 / 119 | không che (cách 137px) |
| 430x932 | 76 / 856 | 174..813 | 489 | 513..547 | 813 / 119 | không che (cách 266px) |
| 1280x800 (desktop) | 76 / 724 | 174..681 | 448 | 472..506 | 681 / 119 | không che |

Viewport tái hiện ảnh Capu: **390x664**. Đo trên main: sheet 76 / 588, tiêu đề Số khách đỉnh 530 (lộ ~15px, "chỉ thấy mép chữ"), hàng đầu 554..588, footer đỉnh 545 / cao 119, che cả hàng (khe -43px). 664 là vùng nhìn thấy khi thanh trạng thái, thanh Safari dưới và vùng home ăn ~180px của màn 844; con số là ĐOÁN (tự tin ~65%, spec-critic D1), nguồn chốt là `?vvdebug=1` (T-056) trên máy Capu. Mô hình "thấp hơn 90px" của v1 bị bỏ: ở 390x754 main vốn đã đủ chỗ, không giải thích được ảnh.

## Giả thuyết
Nếu nâng đỉnh sheet lên và bảo đảm vùng nội dung cuộn tới hết, thì người dùng điện thoại thấy và chọn được số khách ở bước 2 mà không bị nút che. Chỉ số bảo vệ: desktop không đổi; không cuộn ngang; nút Tiếp theo vẫn cao >= 44px.

## Hành vi (người dùng thấy gì)
1. Khi mở bước 2/3 trên điện thoại ở **375x667, 390x664 hoặc 430x932**, chưa cuộn: tiêu đề mục "Số khách ..." và hàng lựa chọn đầu tiên của mục đó (nút 80) nằm trọn trong vùng nhìn thấy, dưới đỉnh vùng nội dung, trên footer (cách đỉnh footer >= 4px), và không bị phần tử nào khác phủ (điểm giữa của nó trả về chính nó khi hỏi phần tử trên cùng).
2. Sheet cao hơn bản gốc ít nhất 24px ở cả ba viewport (591/588/856 thành >= 615/612/880), và trong vùng nhìn thấy (đỉnh >= 0, đáy <= chiều cao cửa sổ). Ở 390x664 hành vi 1 đòi sheet thực tế cao hơn gốc khoảng 47px.
3. Màn rất thấp (320x568, 375x548): chỉ cần vùng nội dung cuộn được; sau khi cuộn hết, tiêu đề Số khách và nút cuối của mục này nằm trên footer, không bị che, nút Tiếp theo không bị che. Không bắt buộc có dấu hiệu "còn nội dung bên dưới" (Chief of Staff chốt).
4. Footer luôn trong vùng nhìn thấy ở 375x667, 390x664, 430x932, 320x568, 375x548; nút Tiếp theo cao >= 44px, không bị che, trang không cuộn ngang.
5. Desktop 1280x800 giữ nguyên số đo gốc (sai số 1px): sheet đỉnh 76, cao 724, trái 256, phải 1024; đỉnh vùng nội dung 174; footer đỉnh 681, cao 119.
6. Chiều cao sheet tính theo vùng nhìn thấy: dùng `dvh`/`svh` hoặc `window.visualViewport` (hoặc neo vào lớp phủ cố định như hiện nay). **Cấm** `vh`/`lvh` cho chiều cao sheet, vì trên Safari có thanh công cụ chúng lớn hơn vùng nhìn thấy mà Chromium không phân biệt được.
7. MANUAL: Capu mở trên iPhone thật (có thể kèm `?vvdebug=1`), bước 2/3 thấy thanh "BƯỚC 2 / 3", tiêu đề Số khách và nút 80 đầu, không cuộn, nút Tiếp theo không bị thanh Safari che (`eval/T-115/checklist.md`).

"Có tính 3 bước": thanh tiến trình ba bước (Bước 2/3) nằm trong phần đầu sheet và được tính vào chiều cao; không được bỏ nó để lấy chỗ.

## Ràng buộc (vòi)
- Repo: `tohong-front` · Nhánh: `t-115-...` · Vùng: `planner/front/layout`
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/front/layout/` inv-001..011, `planner/front/` (budget, loading, navigation) và `planner/`. Spec này không vi phạm INV nào: không đổi khung `--app-max` (inv-001, 003), không cuộn ngang (inv-002), sheet vẫn nằm trong khung (inv-003), chạm ngoài khung vẫn đóng (inv-005) và không đổi khoá cuộn nền (inv-009). Không có bất biến nào của pool về vùng chạm 44px; tiêu chí 4 tự đặt ngưỡng này cho nút Tiếp theo.
- Kiến trúc: giữ cách dựng hiện có của `Onboarding.jsx` (sheet trong lớp `.ov-fixed`), không đổi logic bước, `localStorage` và dữ liệu.
- Không chạm: payment, auth, schema, dữ liệu người dùng, bước 0/1/3.
- Bậc đề xuất: A, giữ nguyên (UI thuần, eval tự động phủ hết tiêu chí).

## Tiêu chí chấp nhận và eval
Chạy bằng `python3 scripts/gate.py T-115 --cwd /home/user/tohong-front` (lệnh eval có tiền tố `cd /home/user/tohong-hq &&`).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Hành vi 1: không cuộn, tiêu đề Số khách + hàng đầu trọn, trên footer, không bị che (elementFromPoint), 3 viewport | `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 1` |
| 2 | Hành vi 2: sheet cao hơn gốc >= 24px, trong vùng nhìn thấy | `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 2` |
| 3 | Hành vi 3: màn rất thấp cuộn được, không bị che | `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 3` |
| 4 | Hành vi 4: footer trong vùng nhìn thấy, nút >= 44px, không cuộn ngang | `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 4` |
| 5 | Hành vi 5: desktop giữ nguyên | `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 5` |
| 6 | Hành vi 6: chiều cao sheet không dùng vh/lvh (kiểm tĩnh trong `Onboarding.jsx` và các luật `.ov-fixed` của `index.css`; vì Chromium không phân biệt vh với svh) | `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 6` |
| 7 | Hành vi 7: Capu kiểm trên iPhone thật | `eval/T-115/checklist.md` (MANUAL: Chromium không có thanh Safari thật) |

Tự kiểm phép đo (không phải tiêu chí sản phẩm): `cd /home/user/tohong-hq && node eval/T-115/check.cjs --repo /home/user/tohong-front --only 7` chạy lại phép đo với hai biến thể cấu trúc (thêm dấu hiệu cuộn giữa nội dung và footer, bọc nút trong div) và đòi kết quả y hệt bản thường. Phần tử được tìm theo hành vi: vùng nội dung = tổ tiên cuộn dọc được của tiêu đề Số khách; footer = hộp bao hai nút Tiếp theo và Quay lại bước 1; sheet = tổ tiên chung của chữ BƯỚC 2 / 3 và nút Tiếp theo.

Trạng thái trên main a7e5807: eval 1 và 2 đỏ (đúng kỳ vọng); 3, 4, 5, 6, 7 xanh (chặn hồi quy). Eval dùng `eval/_lib/vite_dev.cjs` với `files: {}`, chặn mạng ngoài.

## Bất biến đề xuất (tầng 2)
"Chiều cao sheet/modal không dựa `vh`/`lvh`" = tiêu chí 6 (`--only 6`), và "bước 2/3, hàng Số khách không bị che ở 390x664" = tiêu chí 1. Không đề xuất bất biến chiều cao tuyệt đối.

## Không làm
- Không đổi nội dung, thứ tự hay nhãn các mục (không đổi "Số khách dự kiến" thành "Số khách mời").
- Không đổi bước 0, 1, 3a, 3b; không đổi desktop; không đổi banner "Dữ liệu chưa được lưu".
- Không dùng thủ thuật riêng cho Safari (đo thanh công cụ bằng user agent).

## Câu hỏi mở
Không. Lưu ý cho Capu: 664 là đoán; nếu có thể, gửi ảnh bước 2/3 với `?vvdebug=1` để chốt `innerHeight` thật.

## Sửa ở v2 (spec rework, defect T-115-D1)
- Hành vi 1 và Bằng chứng: bỏ mô hình "thấp hơn 90px" (mâu thuẫn số đo của chính spec); viewport bắt buộc 375x667, 390x664, 430x932 (bỏ 390x844 vì đã xanh trên main).
- Thêm Hành vi 6 (cấm vh/lvh) và 7 (MANUAL) vì cách cài dùng `100vh` qua hết eval Chromium mà hỏng trên Safari.
- Hành vi 3: chọn nhánh "chỉ cần cuộn được" cho màn rất thấp.
- Eval: tìm phần tử theo hành vi, kiểm "bị che" bằng elementFromPoint, thêm tự kiểm hai biến thể; lệnh có tiền tố `cd /home/user/tohong-hq &&`.
