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

Giới hạn của bằng chứng: trong Chromium 390x844 mục số khách hiện đủ, **không tái hiện** đúng ảnh của Capu. Chỉ 375x667 tái hiện được hiện tượng bị che. Ảnh của Capu là Safari thật với thanh công cụ dưới; Playwright không giả lập được. Giả định: thanh công cụ làm vùng nhìn thấy thấp hơn cửa sổ bố cục khoảng 90px (tự tin ~60%), nên eval thêm các viewport thấp hơn 90px (375x577, 390x754, 430x842) để mô phỏng. Khi vùng thấp như vậy, nội dung bắt buộc phải cuộn được và footer không được che hàng nào sau khi cuộn hết.

## Giả thuyết
Nếu nâng đỉnh sheet lên và bảo đảm vùng nội dung cuộn tới hết, thì người dùng điện thoại thấy và chọn được số khách ở bước 2 mà không bị nút che. Chỉ số bảo vệ: desktop không đổi; không cuộn ngang; nút Tiếp theo vẫn cao >= 44px.

## Hành vi (người dùng thấy gì)
1. Khi mở bước 2/3 trên điện thoại ở 375x667, 390x844 hoặc 430x932, chưa cuộn: tiêu đề mục "Số khách ..." và hàng lựa chọn đầu tiên của mục đó (nút 80) nằm trọn trong vùng nhìn thấy, phía dưới đỉnh vùng nội dung và phía trên footer, cách đỉnh footer ít nhất 4px.
2. Sheet cao hơn bản gốc ít nhất 24px ở cả ba viewport, và không vượt ra ngoài vùng nhìn thấy (đỉnh >= 0, đáy <= chiều cao cửa sổ).
3. Khi vùng nhìn thấy thấp hơn (có thanh công cụ trình duyệt, mô phỏng bằng viewport thấp hơn 90px): nội dung cuộn được; sau khi cuộn hết, tiêu đề Số khách, hàng lựa chọn đầu và phần tử cuối của vùng nội dung đều nằm trên footer, không bị che.
4. Footer (Tiếp theo + Quay lại bước 1) luôn nằm trọn trong vùng nhìn thấy, nút Tiếp theo cao >= 44px, trang không cuộn ngang.
5. Desktop 1280x800: sheet, vùng nội dung và footer giữ nguyên số đo gốc (sai số 1px): sheet đỉnh 76, cao 724, trái 256, phải 1024; đỉnh vùng nội dung 174; footer đỉnh 681, cao 119.
6. Ở 320x568 và 375x667, sau khi cuộn hết, không tràn ngang và hàng lựa chọn đầu của mục Số khách không bị footer che.

"Có tính 3 bước": thanh tiến trình ba bước (Bước 2/3) nằm trong phần đầu sheet và được tính vào chiều cao; không được bỏ nó để lấy chỗ.

## Ràng buộc (vòi)
- Repo: `tohong-front` · Nhánh: `t-115-...` · Vùng: `planner/front/layout`
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/front/layout/` inv-001..011, `planner/front/` (budget, loading, navigation) và `planner/`. Spec này không vi phạm INV nào: không đổi khung `--app-max` (inv-001, 003), không cuộn ngang (inv-002), sheet vẫn nằm trong khung (inv-003), chạm ngoài khung vẫn đóng (inv-005) và không đổi khoá cuộn nền (inv-009). Không có bất biến nào của pool về vùng chạm 44px; tiêu chí 4 tự đặt ngưỡng này cho nút Tiếp theo.
- Kiến trúc: giữ cách dựng hiện có của `Onboarding.jsx` (sheet trong lớp `.ov-fixed`), không đổi logic bước, `localStorage` và dữ liệu.
- Không chạm: payment, auth, schema, dữ liệu người dùng, bước 0/1/3.
- Bậc đề xuất: A, giữ nguyên (UI thuần, eval tự động phủ hết tiêu chí).

## Tiêu chí chấp nhận và eval
Chạy từ `/home/user/tohong-hq`; `--repo` trỏ tới repo front đang làm việc (mặc định cwd).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Hành vi 1: không cuộn, tiêu đề Số khách + hàng đầu nằm trên footer ở 375x667, 390x844, 430x932 | `node eval/T-115/check.cjs --repo /home/user/tohong-front --only 1` |
| 2 | Hành vi 2: sheet cao hơn gốc >= 24px (591/768/856 -> 615/792/880), trong vùng nhìn thấy | `node eval/T-115/check.cjs --repo /home/user/tohong-front --only 2` |
| 3 | Hành vi 3: viewport thấp hơn 90px, nội dung cuộn được, sau khi cuộn hết không bị footer che | `node eval/T-115/check.cjs --repo /home/user/tohong-front --only 3` |
| 4 | Hành vi 4: footer trong vùng nhìn thấy, nút >= 44px, không cuộn ngang | `node eval/T-115/check.cjs --repo /home/user/tohong-front --only 4` |
| 5 | Hành vi 5: desktop 1280x800 giữ nguyên | `node eval/T-115/check.cjs --repo /home/user/tohong-front --only 5` |
| 6 | Hành vi 6: 320x568 và 375x667 không tràn ngang, hàng đầu không bị che sau khi cuộn hết | `node eval/T-115/check.cjs --repo /home/user/tohong-front --only 6` |

Trạng thái trên main a7e5807: eval 1 và 2 đỏ (đúng kỳ vọng); eval 3, 4, 5, 6 xanh (chặn hồi quy: Chromium cuộn được sẵn). Eval chạy qua `eval/_lib/vite_dev.cjs`, chặn mạng ngoài.

## Bất biến đề xuất (tầng 2)
Đề xuất cho Spec critic: "Ở bước 2/3 Onboarding, ở mọi viewport điện thoại 375x667..430x932, sau khi cuộn hết, mục Số khách và nút Tiếp theo không che nhau" = tiêu chí 3 và 4 (`--only 3`, `--only 4`). Không đề xuất bất biến chiều cao tuyệt đối.

## Không làm
- Không đổi nội dung, thứ tự hay nhãn các mục (không đổi "Số khách dự kiến" thành "Số khách mời").
- Không đổi bước 0, 1, 3a, 3b; không đổi desktop; không đổi banner "Dữ liệu chưa được lưu".
- Không dùng thủ thuật riêng cho Safari (đo thanh công cụ bằng user agent).

## Câu hỏi mở
Không. Lưu ý cho Capu: ảnh Safari thật không tái hiện được trong headless; sau khi ship, Capu kiểm lại trên iPhone, nếu vẫn che thì cần ảnh mới để chỉnh GIẢ ĐỊNH ~90px.
