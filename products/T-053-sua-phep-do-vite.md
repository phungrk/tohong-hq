# Spec T-053: Sửa phép đo vite của eval front (T-051 check 9/10 và các eval cùng lỗi)

## Đã sửa ở v3 (spec rework lần 2, defect `handoffs/T-053-D2.md`)
- D2 (blocker, tiêu chí 4): câu "đo sau khi bỏ comment" cho phép hai cách hiểu vì bộ bỏ comment cũ (`re.sub(r"/\*.*?\*/")`) nuốt mã khi gặp `/api/*` trong comment dòng hay `'…/**'` trong chuỗi. Sửa: check_4 dùng bộ quét biết chuỗi `'…'` `"…"` `` `…` `` (kể cả `${…}` lồng), literal regex, comment dòng và khối. Kiểm hình thức chỉ còn đo hành vi-tương-đương, không ép tên gọi: "có require/import tới module `vite_dev` (đường dẫn literal hoặc hằng trong cùng file; tên biến, destructure đổi tên đều được) và nhắc `startViteDev`", "không spawn npx / npm exec / `.bin/vite` trực tiếp", "không cổng `Math.random`/dải cố định". Thêm ĐỐI CHỨNG DƯƠNG: check_4 chạy selftest trước khi đo (7 bản đúng phải PASS, 8 bản sai phải FAIL, 3 helper đúng/sai, kiểm bộ quét không nuốt mã); selftest hỏng thì check_4 FAIL "bộ kiểm hỏng".
- Minor 3: "vite thật" của check_6 tự thoát (mã 3) nếu môi trường không có `T053_RUN`; helper truyền env thiếu (`env: { PATH: … }`) sẽ FAIL bằng hành vi. Kiểm tĩnh helper cũng chặt hơn: nếu có `env:` thì phải có `process.env` trần (spread/gán), không chỉ `process.env.X`.
- Minor 4: Hành vi 2 nay nói rõ harness THOÁT (mã khác 0) trong 15 giây sau tín hiệu, và handler của helper phải gọi `process.exit`.
- Chứng minh có đường xanh: xem `handoffs/T-053-v3.md` (helper tham chiếu và bản sửa đúng của cả sáu file, ngoài repo).

## Đã sửa ở v2 (spec rework lần 1, defect `handoffs/T-053-D1.md`)
- D1.1: check_4 giờ áp ĐỦ ba kiểm (có `vite_dev`, không `spawn npx`, không `Math.random` gần `port`/dải cố định) cho cả sáu file tiêu thụ kể cả C9/C10, đo sau khi bỏ comment, không phân biệt hoa thường; bỏ điều kiện chữ "nonce" (một comment là thoả). "Nonce kiểm thật" chuyển sang kiểm bằng hành vi: tiêu chí 6 (check_6) cho helper chạy với một vite giả trả 200 cho mọi đường dẫn; helper nào không kiểm thật nonce sẽ báo sẵn sàng và bị FAIL, bất kể đổi dải cổng. Decoy của check_1 mở rộng sang 5100-8999 (gồm 7000-7999 mà cách (b) của critic dùng).
- D1.2: "do eval tạo" nhận diện bằng dấu riêng mỗi lần chạy `T053_RUN=<uuid>` truyền qua biến môi trường tới harness, helper, vite con; lọc bằng `/proc/<pid>/environ`. Không còn nhận diện theo cwd/dòng lệnh; `kill_pids` chỉ kill pid mang dấu. Helper bắt buộc truyền `process.env` xuống vite con (câu "Sản phẩm của việc" bên dưới).
- D1.3: hành vi 2 chốt MỘT cách hiểu: `stop()` và handler tín hiệu xoá file nonce và file thử; sau mọi lần chạy `git status` front không thêm mục `__*`. check_2 gửi SIGTERM, SIGINT, SIGHUP (C9: SIGTERM, SIGHUP; C10: SIGINT, SIGTERM) và đo tiến trình + file TRƯỚC khi harness eval dọn.
- D1.4: check_3 thêm đột biến cho từng nhóm kiểm mà C10 có thể làm yếu (M2 gọi `www.marry.vn`, M3 ghi đè localStorage vendor đã lưu), mỗi đột biến phải FAIL đúng lý do. Hai nhóm không dựng đột biến (id tra tối đa một lần, tra ảnh không mang coupleId của C10, các kiểm gallery riêng của C9) GIAO ADVERSARY đọc diff của C9/C10 và xác nhận thay `waitForTimeout` không làm yếu chúng.

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
2. Chạy xong (PASS, FAIL, lỗi, quá hạn) hoặc harness bị SIGTERM/SIGINT/SIGHUP giữa chừng (khi nhận tín hiệu harness dọn rồi THOÁT với mã khác 0 trong 15 giây; helper gắn handler tín hiệu thì handler phải gọi `process.exit`, vì Node bỏ hành vi tự thoát mặc định khi có handler): không còn tiến trình nào do eval tạo (vite, npx, esbuild... mọi tiến trình mang dấu `T053_RUN` của lần chạy đó), và không còn file nào do eval tạo trong repo front: cả file thử `__t051*.{jsx,html}` lẫn file nonce `__nonce-*`; `git status` của front không thêm mục nào. Eval không bao giờ kill tiến trình không mang dấu của chính lần chạy đó (vite của phiên khác chạy cùng lúc trong cùng repo không bị đếm, không bị kill).
3. Code front bị phá thật (ảnh hỏng không ra ảnh mặc định) vẫn FAIL: không nới ngưỡng, không đổi phép đo nội dung.
4. Không còn chờ cố định (`waitForTimeout`) trong C9/C10; chờ bằng điều kiện (ảnh đã xong/lỗi, phần tử xuất hiện), có hạn tổng.

## Sản phẩm của việc (Engineering làm theo spec này)
- Helper dùng chung `eval/_lib/vite_dev.cjs` (mẫu: `eval/T-054/lib.cjs` đã làm đúng cho build + máy chủ tĩnh): `startViteDev({repo, files})` trả Promise của `{port, url, stop()}`; `files` = object `{tên-file-tương-đối-trong-repo: nội-dung-chuỗi}` (helper ghi vào repo, `stop()` xoá); `stop()` có thể trả Promise, gọi lặp lại không lỗi; hết hạn/nonce sai thì Promise reject bằng `Error` (đã dọn sạch).
  - Chạy `<repo>/node_modules/.bin/vite --port <N> --strictPort --host 127.0.0.1` trực tiếp (không qua npx) với `cwd = repo`, `detached: true`, và **truyền `process.env` của tiến trình cha xuống vite con** (không đặt `env:` thiếu `process.env`: eval nhận diện tiến trình do chính nó tạo bằng biến `T053_RUN` trong môi trường); `stop()` và handler `exit/SIGINT/SIGTERM/SIGHUP` kill cả nhóm (`process.kill(-pid, 'SIGKILL')`), không `pkill -f`.
  - Cổng: mở `listen(0)` lấy cổng trống, đóng, đưa cho vite với `--strictPort`; vite thoát hoặc nonce sai thì thử lại cổng khác tối đa 3 lần, rồi FAIL rõ ràng.
  - Sẵn sàng = `GET /__nonce-<random>.txt` (harness ghi file đó trong thư mục repo cùng file thử) trả đúng chuỗi random, VÀ tiến trình vite con còn sống. 200 từ nơi khác không tính.
  - Hạn tổng khi chờ (vd 60s), hết hạn thì FAIL kèm lý do, vẫn dọn sạch. `stop()` và handler `exit/SIGINT/SIGTERM/SIGHUP` cũng xoá file nonce và mọi file trong `files` (cả khi lỗi).
- Sửa `eval/T-051/check_9_*.cjs`, `check_10_*.cjs`, `eval/T-066/check_ui.cjs`, `eval/T-068/_advlib.cjs` và hai lib bất biến `vendor_img_inv.cjs`, `small_tile_tooltip.cjs` dùng helper (ADR-024); thay `waitForTimeout` bằng `waitForFunction`/điều kiện. Không đổi bất kỳ ngưỡng, chuỗi kiểm hay dữ liệu thử nào; riêng hai bất biến chỉ đổi phần dựng vite/cổng/thăm dò/kill, không đổi `inv-00x.sh` hay nội dung kiểm.

## Phạm vi: các eval khác cùng cách (đã grep `'vite'`/`npx vite`, đọc từng chỗ)
| Eval | Dựng dev server | Kill nhóm | Cổng | Thăm dò | Kết luận |
| --- | --- | --- | --- | --- | --- |
| T-051 C9, C10 | `npx vite` | KHÔNG (mồ côi) | ngẫu nhiên | 200 | Cùng lỗi đủ bốn mặt: VÀO PHẠM VI |
| T-066 `check_ui.cjs:176` | `npx vite`, detached | có (`kill(-pid)`) | ngẫu nhiên 5200-5699 | 200 | Lỗi cổng + thăm dò: VÀO PHẠM VI (đổi sang helper) |
| T-068 `_advlib.cjs:451` | như trên | có | ngẫu nhiên 5800-6199 | 200 | VÀO PHẠM VI |
| `eval/invariants/planner/front/vendor-images/lib/vendor_img_inv.cjs:179`, `small_tile_tooltip.cjs:154` | như trên | có | ngẫu nhiên | 200 | CÙNG LỖI cổng + thăm dò; bất biến của bể: VÀO PHẠM VI theo ADR-024 (`decisions/2026-11-05-t053-bat-bien-vite-dung-helper.md`), chỉ đổi phép đo sang helper, nội dung kiểm/ngưỡng không đổi |
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
| 1 | Khi vite lạ chiếm cả dải cổng cũ (5100-8999, gồm 7000-8999), 5 lần liên tiếp chạy C9 và C10 (10 lần): 0 FAIL giả (cả 10 PASS) | `cd /home/user/tohong-hq && python3 eval/T-053/check_1_khong_fail_gia.py` |
| 2 | Sau mỗi lần chạy C9/C10 (xong, hoặc bị SIGTERM, SIGINT, SIGHUP giữa chừng) không còn tiến trình nào mang dấu `T053_RUN` và không còn file `__*` do eval tạo trong repo front (đo trước khi eval dọn); chỉ tiến trình mang dấu mới bị đếm/kill | `cd /home/user/tohong-hq && python3 eval/T-053/check_2_khong_mo_coi.py` |
| 3 | PASS/FAIL không đổi: PASS trên code front hiện tại (gồm T-052), vẫn FAIL đúng lý do trên ba bản front đột biến (ảnh hỏng không ra mặc định; gọi `www.marry.vn`; ghi đè localStorage vendor đã lưu) | `cd /home/user/tohong-hq && python3 eval/T-053/check_3_ket_qua_khong_doi.py` |
| 4 | C9/C10 không còn `waitForTimeout`; cả sáu file (C9, C10, T-066 `check_ui.cjs`, T-068 `_advlib.cjs`, hai lib bất biến) gọi `startViteDev` từ `vite_dev.cjs`, không `spawn npx`, không bốc cổng `Math.random`/dải cố định (đo sau khi bỏ comment bằng bộ quét biết chuỗi; mọi cách viết đúng đều xanh, có selftest đối chứng dương/âm); helper có các tính chất tĩnh nêu ở trên (tiêu chí thêm từ brief và ADR-024; kiểm tĩnh vì chờ cố định chỉ đỏ khi máy chậm, không dựng ổn định được) | `cd /home/user/tohong-hq && python3 eval/T-053/check_4_cho_theo_dieu_kien.py` |
| 5 | Hai bất biến vendor-images (`vendor_img_inv.cjs --only 1`, `small_tile_tooltip.cjs`): PASS trên front main khi vite lạ chiếm dải cổng, vẫn FAIL trên bản front bị phá, không để lại vite (ADR-024) | `cd /home/user/tohong-hq && python3 eval/T-053/check_5_bat_bien_vendor_images.py` |
| 6 | Nonce là kiểm thật và helper dọn sạch: với "vite lạ" trả 200 cho mọi đường dẫn, `startViteDev` reject (không báo sẵn sàng); với vite thật thì phục vụ đúng file thử, và sau `stop()`/reject không còn tiến trình mang dấu hay file `__*` | `cd /home/user/tohong-hq && python3 eval/T-053/check_6_helper_nonce.py` |

Chạy cả bộ: `cd /home/user/tohong-hq && EVAL_TMPDIR=<scratchpad> bash eval/T-053/run.sh` (~11 phút). "Code T-052" = front hiện tại (main a7e5807, gồm #58); baseline ở `eval/T-053/baseline.txt`. Lưu ý: tiêu chí 3(a) thực chất là hồi quy: nếu sau này code front đổi hành vi ảnh, eval này đỏ đúng chỗ.

Kết quả trên hiện trạng v2 (đo 2026-11-05, đỏ đúng lý do): 1 ĐỎ (10/10 FAIL giả, `BODY=vite-la`, 158s), 2 ĐỎ (sau chạy xong còn vite mang dấu; sau SIGTERM/SIGINT còn `npm exec vite` và `__t051*` còn trong repo; 52s), 3 XANH (đúng ý: nền PASS, cả ba đột biến FAIL đúng lý do, 135s), 4 ĐỎ (cả sáu file chưa dùng helper, helper chưa có, 8 waitForTimeout), 5 ĐỎ (cả hai bất biến FAIL giả khi vite lạ chiếm dải; 284s), 6 ĐỎ (chưa có helper). Tiêu chí 6 đã kiểm chứng với hai helper tham chiếu ngoài repo: helper đúng PASS, helper nhận mọi 200 FAIL "helper đáng ra reject". Tổng ~10,5 phút, mỗi eval < 600s (check_5 cần dư địa: timeout mỗi lần chạy con 300s). Phần chưa chứng minh được trước khi có helper: nhánh xanh của check_2 (C9/C10 thật dùng helper); chỉ chạy được sau Engineering.

## Bất biến đề xuất (tầng 2)
Có, cho Spec critic rút vào bể (vùng `_shared` hoặc `planner/front`): "mọi eval front dựng vite dev dùng helper `eval/_lib/vite_dev.cjs` (không `cp.spawn('npx', ['vite'`, không bốc cổng bằng `Math.random`)". Kiểm bằng grep trên `eval/`. Theo ADR-024, bật được ngay sau khi T-053 qua Code Gate (hai bất biến vendor-images đã được sửa nên không đỏ ở bể). Trước Code Gate nó sẽ đỏ, nên chưa viết file bất biến.

## Không làm
- Không đổi ngưỡng, dữ liệu thử, chuỗi kiểm nội dung của C9/C10/T-066/T-068.
- Không sửa T-045/T-048 và các eval không spawn dev server. Không sửa `inv-00x.sh` hay nội dung kiểm của hai lib bất biến.
- Không chạy lại gate T-051/T-052; không đổi code `tohong-front`.

## Câu hỏi mở
Không. (Câu về hai bất biến vendor-images đã được Chief of Staff trả lời: CHO PHÉP, ADR-024.)
