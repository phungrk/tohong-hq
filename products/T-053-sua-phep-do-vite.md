# Spec T-053: Sửa phép đo vite của eval front (T-051 check 9/10 và các eval cùng lỗi)

## Ý định
Eval T-051 check 9/10 không được FAIL giả vì môi trường (vite mồ côi, cổng trùng); lỗi là của phép đo, không của code. Nguồn: adversary T-052 (`handoffs/T-052-v3.md` ghi nghi flake; `board/T-052.md`).

## Bằng chứng
- Đo hôm nay (2026-11-05) trên `/home/user/tohong-front` (main a7e5807): chạy C9 + C10 mỗi cái một lần, cả hai PASS nhưng để lại 2 tiến trình `vite` mồ côi (cổng 5543, 5704). Nguyên nhân: `cp.spawn('npx', ['vite', ...])` rồi `vite.kill()` chỉ giết npx (`eval/T-051/check_9_front_anh_mac_dinh.cjs:50-53`, `check_10_front_vendor_da_luu.cjs:52-53`).
- Cổng bốc ngẫu nhiên trong dải 5100-5599 (C9) và 5600-5899 (C10), `--strictPort`, thăm dò chỉ cần HTTP 200 (`:56`). Khi vite lạ giữ cổng, vite mới thoát, thăm dò nhận 200 từ vite lạ, trang sai -> FAIL giả. Dựng lại bằng eval T-053 tiêu chí 1: 10/10 lần FAIL với `BODY=vite-la`. "~15%" là số của adversary T-052, chưa tự đo; tự tin 70%.
- Chờ cố định: C9 có 5, C10 có 3 chỗ `waitForTimeout`.

## Giả thuyết
Nếu dùng một helper dựng vite dùng chung (nhóm tiến trình riêng, cổng từ `listen(0)`, thăm dò nonce, chờ điều kiện) thì tỷ lệ FAIL giả của C9/C10 về 0 và không còn vite mồ côi. Chỉ số bảo vệ: kết quả PASS/FAIL trên code không đổi, ngưỡng không nới.

## Hành vi (người dùng của spec = người/agent chạy eval front)
1. Chạy C9 hoặc C10 khi máy còn vite lạ giữ cổng bất kỳ (kể cả cả dải 5100-6199 trả 200): vẫn ra kết quả đúng của code (PASS trên code T-052/hiện tại). Không bao giờ dùng nhầm máy chủ lạ.
2. Chạy xong (PASS, FAIL, lỗi, quá hạn) hoặc harness bị SIGTERM/SIGINT/SIGHUP giữa chừng: không còn tiến trình vite (kể cả npx/npm exec) do eval tạo, và các file thử `__t051*.{jsx,html}` bị xoá.
3. Code front bị phá thật (ảnh hỏng không ra ảnh mặc định) vẫn FAIL: không nới ngưỡng, không đổi phép đo nội dung.
4. Không còn chờ cố định (`waitForTimeout`) trong C9/C10; chờ bằng điều kiện (ảnh đã xong/lỗi, phần tử xuất hiện), có hạn tổng.

## Sản phẩm của việc (Engineering làm theo spec này)
- Helper dùng chung `eval/_lib/vite_dev.cjs` (mẫu: `eval/T-054/lib.cjs` đã làm đúng cho build + máy chủ tĩnh): `startViteDev({repo, files})` trả `{port, url, stop()}`.
  - Chạy `<repo>/node_modules/.bin/vite` trực tiếp (không qua npx), `detached: true`; `stop()` và handler `exit/SIGINT/SIGTERM/SIGHUP` kill cả nhóm (`process.kill(-pid, 'SIGKILL')`), không `pkill -f`.
  - Cổng: mở `listen(0)` lấy cổng trống, đóng, đưa cho vite với `--strictPort`; vite thoát hoặc nonce sai thì thử lại cổng khác tối đa 3 lần, rồi FAIL rõ ràng.
  - Sẵn sàng = `GET /__nonce-<random>.txt` (harness ghi file đó trong thư mục repo cùng file thử) trả đúng chuỗi random, VÀ tiến trình vite con còn sống. 200 từ nơi khác không tính.
  - Hạn tổng khi chờ (vd 60s), hết hạn thì FAIL kèm lý do, vẫn dọn sạch.
- Sửa `eval/T-051/check_9_*.cjs` và `check_10_*.cjs` dùng helper; thay `waitForTimeout` bằng `waitForFunction`/điều kiện. Không đổi bất kỳ ngưỡng, chuỗi kiểm hay dữ liệu thử nào.

## Phạm vi: các eval khác cùng cách (đã grep `'vite'`/`npx vite`, đọc từng chỗ)
| Eval | Dựng dev server | Kill nhóm | Cổng | Thăm dò | Kết luận |
| --- | --- | --- | --- | --- | --- |
| T-051 C9, C10 | `npx vite` | KHÔNG (mồ côi) | ngẫu nhiên | 200 | Cùng lỗi đủ bốn mặt: VÀO PHẠM VI |
| T-066 `check_ui.cjs:176` | `npx vite`, detached | có (`kill(-pid)`) | ngẫu nhiên 5200-5699 | 200 | Lỗi cổng + thăm dò: VÀO PHẠM VI (đổi sang helper) |
| T-068 `_advlib.cjs:451` | như trên | có | ngẫu nhiên 5800-6199 | 200 | VÀO PHẠM VI |
| `eval/invariants/planner/front/vendor-images/lib/vendor_img_inv.cjs:179`, `small_tile_tooltip.cjs:154` | như trên | có | ngẫu nhiên | 200 | CÙNG LỖI cổng + thăm dò nhưng là bất biến của bể: CHƯA đưa vào, chờ Chief of Staff (xem Câu hỏi mở) |
| T-045, T-048 `check_ui.cjs` | `npx vite build` đồng bộ (`execSync`), máy chủ tĩnh trong harness `listen(0)` | không cần (build thoát) | `listen(0)` | không thăm dò vite | KHÔNG cùng lỗi, không sửa (nit: `npx` build không có hạn, ghi nhận) |
| T-043, T-027, `members_ui_inv`, T-054 và các `lib` còn lại | không spawn vite dev | | `listen(0)` / T-054 đã dùng nonce | | Không cùng lỗi (T-054/lib.cjs là mẫu đúng) |

## Ràng buộc (vòi)
- Repo: `tohong-hq` (sổ cái) · Vùng: `planner/vendor/images` · Không chạm code sản phẩm (`tohong-front` chỉ được đọc/chạy, kể cả bản sao thử).
- Bất biến đã đọc: `eval/invariants/_shared/`, `planner/`, `planner/vendor/` — không mâu thuẫn. Spec không sửa/xoá bất biến nào.
- Không dùng `pkill -f vite` (giết nhầm phiên); chỉ kill pid/nhóm do chính eval tạo. Không ghi vào `/tmp` chung; dùng `$EVAL_TMPDIR` (scratchpad).
- Không chạm payment, auth, DB, dữ liệu người dùng. Bậc A: chỉ sửa eval/harness, eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Khi vite lạ chiếm cả dải cổng cũ, 5 lần liên tiếp chạy C9 và C10 (10 lần): 0 FAIL giả (cả 10 PASS) | `cd /home/user/tohong-hq && python3 eval/T-053/check_1_khong_fail_gia.py` |
| 2 | Sau mỗi lần chạy C9/C10 (xong, hoặc bị SIGTERM giữa chừng) không còn tiến trình vite do eval tạo | `cd /home/user/tohong-hq && python3 eval/T-053/check_2_khong_mo_coi.py` |
| 3 | PASS/FAIL không đổi: PASS trên code front hiện tại (gồm T-052), vẫn FAIL trên bản front bị phá có chủ đích | `cd /home/user/tohong-hq && python3 eval/T-053/check_3_ket_qua_khong_doi.py` |
| 4 | C9/C10 không còn `waitForTimeout`, thăm dò dùng nonce (tiêu chí thêm từ brief; kiểm tĩnh vì chờ cố định chỉ đỏ khi máy chậm, không dựng ổn định được) | `cd /home/user/tohong-hq && python3 eval/T-053/check_4_cho_theo_dieu_kien.py` |

Chạy cả bộ: `cd /home/user/tohong-hq && EVAL_TMPDIR=<scratchpad> bash eval/T-053/run.sh` (~5 phút). "Code T-052" = front hiện tại (main a7e5807, gồm #58); baseline ở `eval/T-053/baseline.txt`. Lưu ý: tiêu chí 3(a) thực chất là hồi quy: nếu sau này code front đổi hành vi ảnh, eval này đỏ đúng chỗ.

Kết quả trên hiện trạng (trước khi sửa): 1 ĐỎ (10/10 FAIL giả), 2 ĐỎ (4/4 điểm kiểm còn vite), 3 XANH (đúng ý: nền không đổi), 4 ĐỎ (8 waitForTimeout).

## Bất biến đề xuất (tầng 2)
Có, đề xuất cho Spec critic, vùng `_shared` hoặc `planner/front`: "mọi eval front dựng vite dev dùng helper `eval/_lib/vite_dev.cjs` (không `cp.spawn('npx', ['vite'` hay bốc cổng bằng `Math.random`)". Kiểm bằng grep trên `eval/` (cho phép danh sách ngoại lệ ghi rõ). Chỉ bật sau khi bất biến vendor-images (xem câu hỏi mở) được xử lý, nếu không sẽ đỏ ngay.

## Không làm
- Không đổi ngưỡng, dữ liệu thử, chuỗi kiểm nội dung của C9/C10/T-066/T-068.
- Không sửa T-045/T-048 và các eval không spawn dev server.
- Không chạy lại gate T-051/T-052; không đổi code `tohong-front`.

## Câu hỏi mở
Hai file bất biến `vendor_img_inv.cjs` và `small_tile_tooltip.cjs` (bể `planner/front/vendor-images`) cùng lỗi cổng + thăm dò 200; sửa bất biến phải qua Chief of Staff và ghi `decisions/` — có cho đổi sang helper (chỉ phép đo, không đổi nội dung kiểm) không? Mặc định spec: CHƯA.
