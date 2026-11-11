# Spec T-122: Footer onboarding mờ dần khi còn nội dung nằm dưới, đặc lại khi hết

## Ý định
Capu (2026-11-11, ảnh iPhone Chrome `eval/T-122/capu-iphone-chrome-buoc2.png`): "phần chọn số lượng khách mời vẫn bị che. Do đó, phần chứa button tiếp theo có thể transparency để user biết được có thể chọn sl khách. Khi user scroll lên để chọn sl khách thì hết transparency". Chồng lên PR tohong-front#66 (T-117, nhánh `fix/t115-onboarding-sheet-height`, chưa merge); hai PR merge cùng nhau.

## Bằng chứng
Đo bằng Playwright (dữ liệu giả, `startViteDev` với `files: {}`), 2026-11-11, `tohong-front` main f5c7da0 và nhánh #66 6f20007. Phần che = số px của phần tử nằm dưới đỉnh footer (footer cao 119px, nút Tiếp theo cao 48px, bắt đầu cách đỉnh footer 12px). Mục "Số khách dự kiến" gồm nhãn + HAI hàng nút (80 120 150 200 300 / 500+) ở các màn hẹp; trên 430x932 chỉ một hàng.

| Viewport | Bản | Nhãn bị che | Hàng 1 bị che (cao 34) | Hàng 2 "500+" bị che (cao 34) | Cuộn tối đa |
| --- | --- | --- | --- | --- | --- |
| 390x650 | main | 14 | 34 | 34 | 114 |
| 390x650 | #66 | 0 | 5 | 34 | 62 |
| 375x632 | main | 15 | 34 | 34 | 132 |
| 375x632 | #66 | 0 | 23 | 34 | 80 |
| 390x664 | main | 0 | 34 | 34 | 100 |
| 390x664 | #66 | 0 | 0 | 32 | 48 |
| 393x662 | main | 2 | 34 | 34 | 102 |
| 393x662 | #66 | 0 | 0 | 34 | 50 |
| 430x932 | main và #66 | 0 | 0 | không có hàng 2 | 0 |

- Ảnh Capu: 1179x2556 = 393 px CSS rộng (3x). Vùng trang nhìn thấy (dưới thanh địa chỉ Chrome tới trên thanh công cụ dưới) cao ~662 px (đo từ ảnh, sai số vài px). Trên main ở 393x662 nhãn chỉ lộ 2px dưới đỉnh footer: đúng "chỉ thấy mép" trong ảnh. Capu ước 390x650; hai cỡ đều được đo. Cả hai là ĐOÁN từ ảnh, tự tin ~60% (nguồn chốt: `?vvdebug=1` trên máy Capu).
- Sau #66, ở 393x662 và 390x664, nhãn và hàng 1 đã lộ hết nhưng hàng 2 ("500+") nằm TRỌN sau nút Tiếp theo (nút đặc, cao 48px, phủ hết bề ngang trừ lề 20px). Nền footer mờ không lộ được hàng này vì nút phải đặc (xem "Chốt 2"). Dải mờ chỉ lộ nội dung nằm trong 12px đệm trên nút (ví dụ 375x632: giữa hàng 1) và dải mờ phía trên mép footer. Đây là giới hạn hình học, không phải lỗi eval; xem "Câu hỏi mở".
- INV-012 (planner/front/layout): sau khi cuộn hết, tiêu đề Số khách và nút cuối cách đỉnh footer >= 4px, không bị phủ, ở 375x667, 390x664, 430x932, 320x568, 375x548. INV-013: không dùng vh/lvh cho chiều cao sheet. inv-014 (chờ merge, `eval/T-115/bat-bien-cho-merge/`): chưa cuộn, nhãn Số khách và hàng nút đầu cách đỉnh footer >= 4px ở 375x667, 390x664, 430x932.
- Bản thử (không ràng buộc, chỉ chứng minh eval xanh được): `eval/T-122/proto-on-pr66.diff` trên #66. Với bản thử: INV-012, INV-013, inv-014, T-115 eval 1-6, T-117 adv-01..05 và `eval/T-122/check.cjs` đều PASS (kết quả cuối ghi ở handoff). Lần thử đầu (footer cao thêm 16px khi mờ) làm INV-012/inv-014 đỏ vì chúng đọc hình học ngay sau khi gán `scrollTop`; và bản đặt footer đè lên vùng nhập ở bước 1 làm adv-04 (bàn phím ảo) đỏ. Hai bài học nằm trong hành vi 5 và 7.

## Giả thuyết
Nếu footer mờ dần khi còn nội dung nằm dưới và đặc lại khi hết, thì người dùng điện thoại ở bước 2/3 biết còn mục Số khách để chọn mà không cần đoán. Chỉ số bảo vệ: nút Tiếp theo vẫn đọc và bấm được (tương phản >= 4.5:1); INV-012, INV-013, inv-014, T-117 adv-01..05 vẫn xanh; desktop và hình học footer không đổi.

## Chốt các câu của Chief of Staff (mỗi câu một cách hiểu duy nhất)
1. "Transparency" = NỀN của footer chuyển dần từ trong suốt (phía trên) sang đặc (từ đỉnh nút Tiếp theo trở xuống) bằng một dải chuyển màu. Không làm mờ hay giảm độ đục của chính hai nút. Lý do: nút mờ thì chữ trắng mất tương phản và người dùng không biết có bấm được hay không.
2. Nút "Tiếp theo" luôn đặc (không lộ nền phía sau), chữ trắng/nền nút >= 4.5:1; chữ "Quay lại bước 1" cũng >= 4.5:1 (hiện 5.6:1). Nút bấm được ở cả hai trạng thái. Hiện nút trắng/đỏ #A83246 là 6.5:1.
3. Có đúng hai trạng thái: MỜ và ĐẶC. MỜ khi còn nội dung nằm dưới: đáy của phần tử nội dung thấp nhất trong vùng cuộn (nút, ô nhập, ảnh, hoặc chữ) > đỉnh footer - 4px. ĐẶC khi đáy đó <= đỉnh footer - 4px. Với bước 2, "cuộn tới số khách thì hết trong suốt" = lúc hàng cuối của mục Số khách lộ đủ và cách đỉnh footer >= 4px; vì Số khách là mục cuối nên lúc đó cũng là lúc cuộn hết. Cuộn ngược lên làm hàng đó chui lại xuống thì footer mờ lại (không "chốt" một lần). Màn đủ cao (430x932, desktop) nội dung vốn không nằm dưới footer thì footer luôn đặc, y như hiện nay.
4. Đặc nghĩa là footer có nền riêng không lộ nền phía sau (eval thử bằng cách tô nền sheet màu tím rồi chụp ảnh). Dải chuyển màu nằm ngang mức nào cũng được, miễn đạt hành vi 1.
5. Phạm vi: mọi bước onboarding có vùng nội dung cuộn dọc kèm footer: bước 2 (bắt buộc, eval 1-4 và 6) và bước 3a chọn ảnh phong cách (eval 5). Bước 1 dùng chung cách làm (nội dung ngắn nên thường đặc) nhưng không có eval riêng, ngoài adv-04. Màn chào và bước 3b không có vùng cuộn dưới footer nên không đổi. Lý do: cùng một sheet, cùng cái bẫy "nội dung bị cắt mà không ai biết".
6. Footer mờ không chặn thao tác: chạm hoặc vuốt vào vùng mờ (phía trên hai nút) đi xuyên xuống nội dung nằm dưới; hai nút vẫn nhận chạm của chính chúng. Đây là câu trả lời cho "INV-012 (elementFromPoint)": INV-012 và inv-014 chỉ đo nội dung ở trạng thái ĐẶC hoặc đã cuộn hết, nên không mâu thuẫn; ngoài ra vùng mờ không phải là "che" vì nó không nhận chạm.

## Hành vi (người dùng thấy gì)
Áp cho điện thoại (không đổi desktop 1280x800). Viewport thử: 390x650, 375x632, 390x664, 393x662 (hẹp, bước 2 vẫn còn nội dung dưới footer), 430x932 (đủ cao), 320x568 (bước 3a).
1. Còn nội dung nằm dưới footer (chưa cuộn ở 390x650, 375x632, 390x664, 393x662): footer ở trạng thái MỜ. Đo trên một cột lề trái footer (x = mép trái sheet + 3, không có chữ hay nút), độ đục alpha: tại 16px phía trên đỉnh footer alpha <= 0.1; alpha không giảm khi đi xuống (cho phép tụt 0.05) từ điểm đó tới đỉnh nút Tiếp theo; tại 1px dưới đỉnh footer alpha <= 0.6; từ đỉnh nút Tiếp theo trở xuống alpha >= 0.95. Nếu có chữ của vùng nội dung nằm (tâm) trong 12px đệm trên nút Tiếp theo (vd 375x632) thì chữ/viền đó phải còn thấy được xuyên qua footer (>= 0.5% điểm ảnh của dải đó khác khi ẩn nội dung). Chạm vào chỗ có nút nội dung nằm ngay dưới đỉnh footer (1 đến 10px dưới đỉnh) thì phần tử trên cùng là nội dung chứ không phải footer.
2. Ở trạng thái MỜ, nút Tiếp theo và chữ Quay lại bước 1: không bị phủ (elementFromPoint tại tâm trả về chính nút), nút chính cao >= 44px; chữ nút Tiếp theo >= 4.5:1 so với nền nút, chữ Quay lại bước 1 >= 4.5:1 so với nền; nền nút Tiếp theo không đổi khi nền phía sau đổi màu (không mờ) và bằng nền khi ĐẶC (sai số 8/255 mỗi kênh); bấm Tiếp theo sang được "BƯỚC 3 / 3" và bấm Quay lại bước 1 về được "BƯỚC 1 / 3" (thử ở 375x632).
3. Khi hết nội dung dưới footer (cuộn hết ở bốn viewport hẹp, hoặc 430x932 chưa cuộn): footer ĐẶC, alpha >= 0.98 trong 30px đầu dưới đỉnh footer và >= 0.95 từ đỉnh nút trở xuống; không còn dải mờ phủ phía trên footer (alpha <= 0.1 trong 16px trên đỉnh); đáy nội dung cuối cách đỉnh footer >= 4px; footer cao 119 (sai số 1px) và sát đáy vùng nhìn thấy; trang không cuộn ngang. Desktop 1280x800: sheet đỉnh 76 cao 724, footer đỉnh 681 cao 119 (sai số 1px) và ĐẶC.
4. Chuyển trạng thái theo vị trí cuộn, kiểm ở 390x650 và 375x632: khi đáy nội dung cách đỉnh footer đặc 6px: ĐẶC; khi đáy nội dung lấn xuống 20px dưới đỉnh footer đặc: MỜ; cuộn ngược về đầu: MỜ lại. "Đỉnh footer đặc" = đỉnh footer đo lúc đã cuộn hết. Mọi trạng thái đều thỏa hành vi 1 hoặc 3 tương ứng. Có thể có chuyển cảnh nền <= 250ms; eval chờ 500ms sau khi cuộn.
5. Hình học footer không đổi giữa MỜ và ĐẶC: đỉnh và chiều cao hộp footer (hộp bao Tiếp theo + Quay lại bước 1) chênh <= 1px. Lý do: INV-012, inv-014 và T-115 đo hình học ngay lúc gán `scrollTop`, trước khi trạng thái kịp đổi. Dải mờ được phép kéo dài lên phía trên hộp footer (không nhận chạm) nhưng không được làm hộp footer cao hơn hay đỉnh dịch lên.
6. Bước 3a (chọn ảnh phong cách) ở 390x650 và 320x568: theo đúng luật hành vi 3 của mục "Chốt" (lưới ảnh luôn tràn xuống dưới footer nên chưa cuộn thì MỜ, cuộn hết thì ĐẶC); thỏa hành vi 1 (alpha, chạm xuyên) và hành vi 3 (ĐẶC, ảnh cuối cách đỉnh footer >= 4px); nút chính "Xem Gu của tôi" không bị phủ.
7. Màn rất thấp hoặc bàn phím ảo mở (innerHeight < 480, vd 390x300, 360x300): footer ĐẶC và KHÔNG đè lên vùng nội dung (đáy vùng nội dung <= đỉnh footer + 1px), hai nút không bị phủ. Lý do: adv-04 (T-117) đòi ô tên đang nhập không bị footer che khi bàn phím mở; một footer đè lên nội dung làm adv-04 đỏ.
8. MANUAL: Capu kiểm trên iPhone Chrome/Safari thật theo `eval/T-122/checklist.md` (cảm giác "biết còn nội dung", vuốt xuyên vùng mờ).

## Ràng buộc (vòi)
- Repo: `tohong-front` · Nhánh: chồng lên `fix/t115-onboarding-sheet-height` (#66); PR riêng, hai PR merge cùng nhau · Vùng (`area`): `planner/front/layout`
- Bất biến đã đọc: `eval/invariants/_shared/` + `planner/front/layout/` inv-001..013, + `planner/front/`, `planner/`. Spec này không vi phạm INV nào: INV-012 (cuộn hết không bị che: hành vi 3 và 5), INV-013 (không `vh/lvh`: không đụng chiều cao sheet), inv-001..011 (khung, cuộn ngang, khoá cuộn nền, chạm ngoài khung: không đụng). inv-014 (chờ merge) xanh: hành vi 5 giữ hình học footer. T-117 adv-01..05 phải vẫn xanh (adv-04 là lý do của hành vi 7).
- ĐỀ NGHỊ đổi bất biến: không sửa INV-012, INV-013, inv-014. Ghi chú cho spec-critic/adversary: INV-012 và inv-014 đo hình học đồng bộ sau khi gán `scrollTop`, không chờ trạng thái; hành vi 5 chặn cài đặt "mờ thì footer cao hơn" thay vì đổi hai bất biến đó.
- Kiến trúc: giữ cách dựng sheet trong `.ov-fixed` của `Onboarding.jsx`; không đổi logic bước, `localStorage`, dữ liệu; màu theo token hiện có (`--paper`, `--son-500`, `--ink-400`).
- Không chạm: payment, auth, schema, dữ liệu người dùng, nội dung/thứ tự trường onboarding.
- Bậc đề xuất: A, giữ nguyên (UI thuần, eval tự động phủ 7 trên 8 hành vi; hành vi 8 là MANUAL cho Capu, không chặn merge của bậc A theo policy hiện hành của T-115/T-117).

## Tiêu chí chấp nhận và eval
Chạy bằng `python3 scripts/gate.py T-122 --cwd /home/user/tohong-front` (lệnh eval có tiền tố `cd /home/user/tohong-hq &&`). `check.cjs` in `PASS` hoặc `FAIL <lý do>`; tìm phần tử theo nhãn/hành vi, đo độ đục bằng ảnh chụp, không bám class hay DOM.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Hành vi 1 và 5: còn nội dung dưới footer thì MỜ đúng hồ sơ alpha, nhìn xuyên, chạm xuyên; hình học footer không đổi; 4 viewport hẹp | `cd /home/user/tohong-hq && node eval/T-122/check.cjs --repo /home/user/tohong-front --only 1` |
| 2 | Hành vi 2: nút Tiếp theo và Quay lại bước 1 đọc được, không bị phủ, bấm được, nút không bị làm mờ | `cd /home/user/tohong-hq && node eval/T-122/check.cjs --repo /home/user/tohong-front --only 2` |
| 3 | Hành vi 3: hết nội dung dưới footer thì ĐẶC; 430x932 và desktop không đổi | `cd /home/user/tohong-hq && node eval/T-122/check.cjs --repo /home/user/tohong-front --only 3` |
| 4 | Hành vi 4: chuyển trạng thái đúng theo vị trí cuộn, cuộn ngược mờ lại | `cd /home/user/tohong-hq && node eval/T-122/check.cjs --repo /home/user/tohong-front --only 4` |
| 5 | Hành vi 6: bước 3a theo cùng luật | `cd /home/user/tohong-hq && node eval/T-122/check.cjs --repo /home/user/tohong-front --only 5` |
| 6 | Hành vi 7: màn rất thấp/bàn phím ảo: footer đặc, không đè nội dung | `cd /home/user/tohong-hq && node eval/T-122/check.cjs --repo /home/user/tohong-front --only 6` |
| 7 | Hành vi 8: Capu kiểm trên iPhone thật | `eval/T-122/checklist.md` (MANUAL: Chromium không có thanh công cụ và cảm giác thật của iPhone) |

Trạng thái trên main f5c7da0 và #66: eval 1, 3, 4, 5, 6 đỏ (đúng kỳ vọng: footer hiện chưa có nền riêng và không mờ); eval 2 xanh (chặn hồi quy: nút hiện đã đọc/bấm được). Trên bản thử `eval/T-122/proto-on-pr66.diff`: tất cả xanh. Chặn hồi quy bổ sung (đã có sẵn, phải xanh): `bash eval/invariants/planner/front/layout/inv-012-*.sh`, `inv-013-*.sh`, `eval/T-115/bat-bien-cho-merge/inv-014-*.sh`, `eval/T-117/adv-01..05-*.sh`, `node eval/T-115/check.cjs --only 1..6`.

Tự kiểm phép đo (đã chạy tay, ghi để spec-critic đối chiếu): (a) bản thử tắt chạm xuyên: eval 1 đỏ "chạm vào dải mờ không xuống tới nội dung"; (b) bản thử làm nút Tiếp theo trong suốt 55%: eval 2 đỏ "tương phản 2.71:1"; (c) bản thử làm dải mờ yếu (alpha tối đa 0.6): eval 1 đỏ "không đặc từ đỉnh nút trở xuống"; (d) lỗi thật bắt được khi viết: gradient lặp lại vào viền 1px trên của footer tạo một vạch đặc (độ đục tụt 1 -> 0.56).

## Bất biến đề xuất (tầng 2)
Một, cho spec-critic rút vào `eval/invariants/planner/front/layout/` khi spec qua cổng: "Footer onboarding (bước 2 và 3a) chỉ mờ khi còn nội dung nằm dưới và đặc khi hết; hai nút luôn đặc, chữ >= 4.5:1; hình học hộp footer không đổi giữa hai trạng thái; viewport < 480px cao thì footer không đè nội dung" = `check.cjs --only 1,2,3,6` (bản chụp cố định vào `lib/` của bể, như T-115). Không đề xuất bất biến về số đo tuyệt đối (alpha là ngưỡng của spec này, có thể đổi bằng spec mới).

## Không làm
- Đổi nội dung, thứ tự, nhãn các trường onboarding; đổi desktop; đổi chiều cao sheet (#66); đổi banner "Dữ liệu chưa được lưu"; màn chào và bước 3b.
- Làm mờ chính hai nút; thủ thuật riêng cho Chrome iOS/Safari (đo bằng user agent); dùng `vh/lvh`.
- Rút ngắn footer hay bỏ dòng "Quay lại bước 1" để lộ hàng 500+ (xem câu hỏi mở).

## Câu hỏi mở
Sau #66, ở 393x662 hàng "500+" của Số khách nằm trọn sau nút Tiếp theo (đặc, cao 48px) nên dải mờ không lộ được hàng này, chỉ báo hiệu bằng dải mờ ngay trên footer; muốn lộ hàng 500+ thì phải thu footer (bỏ chữ "Quay lại bước 1" khỏi footer, ~38px) hoặc đổi vị trí nút. Mặc định của spec: KHÔNG làm (chấp nhận, vì cuộn được và 80–300 đã thấy); Capu nói nếu muốn việc thu footer thì mở việc riêng.
