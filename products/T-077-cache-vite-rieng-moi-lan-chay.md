# Spec T-077: Mỗi lần chạy helper vite có cache riêng, hai eval front chạy chồng không làm nhau đỏ giả

## Ý định
Hai eval front chạy cùng lúc (hai agent song song, ADR-035) không được làm nhau đỏ giả. Nguồn: adversary T-071 v3 (board/T-077.md, Bối cảnh); `decisions/2026-11-07-adr-035-chay-song-song-x2.md` mục 4 (T-077 được ưu tiên).

## Bằng chứng
- Đo 2026-11-07 (phiên Product này), hiện trạng, front gốc `/home/user/tohong-front` + bản sao `h.front_copy` (node_modules symlink về front gốc, nên cả hai dùng chung `node_modules/.vite/deps`):
  - Chạy chồng C10 (bản sao) + small_tile_tooltip (front gốc), tải 8 tiến trình CPU: 1/20 đỏ (conc.py 20 8) và 3/20 đỏ (check_1 này) với `page.waitForFunction: Timeout 15000ms`; tải 4: 0/10 (hiếm, không đủ để làm eval).
  - Mỗi lần chạy chồng ghi lại 31 mục trong cache chung (`check_2`), đúng cơ chế "ghi đè cache" của adversary; sau chạy chồng cache có thể hỏng và chính small_tile_tooltip chạy MỘT MÌNH cũng đỏ 1/3 lần cho tới khi cache lành lại.
- Cách đo tin cậy: đỏ giả theo tần suất chỉ ~5-15% nên eval tiêu chí 1 mang tính thống kê; eval tiêu chí 2 là quan sát tất định (cache chung bị ghi hay không).
- Thử nghiệm bản tham chiếu (không nằm trong sổ cái): helper có `cacheDir` riêng mỗi lần chạy, đặt trong thư mục tạm hệ thống qua file cấu hình bọc `mergeConfig(base, {cacheDir})` ghi cạnh file thử và xoá sau chạy; cả bốn eval xanh trên đó.
- Giả định, tự tin ~70%: nguyên nhân gốc là cache chung (hai kết quả trên khớp); chờ cố định 15s trong lib chỉ là chỗ lộ ra, không sửa ở đây (xem Không làm).

## Giả thuyết
Nếu mỗi lần chạy helper dùng cache riêng thì đỏ giả khi chạy chồng về 0. Chỉ số bảo vệ: PASS/FAIL của C9, C10, small_tile_tooltip và bất biến vendor-images trên code hiện tại không đổi.

## Hành vi (người dùng thấy gì)
"Người dùng" ở đây là agent/người chạy eval front.
1. Mỗi lần gọi `startViteDev` (eval/_lib/vite_dev.cjs) dựng máy chủ vite dùng một thư mục cache riêng của lần đó. Mỗi lần chạy tạo ĐÚNG MỘT mục riêng ngay dưới `os.tmpdir()` (theo `TMPDIR`; vd `tohong-vite-<run>`), không có thư mục cha chung của nhiều lần chạy, và nó chứa cache vite thật (`deps/_metadata.json`). Nó không nằm trong `node_modules/.vite` của repo front (kể cả khi `node_modules` là symlink, như `h.front_copy`).
2. Lúc chạy, vite không thêm, bớt hay sửa file nào trong cache chung `node_modules/.vite` của front gốc.
3. Hai lần chạy cùng lúc (bất kể front gốc hay bản sao) có hai mục cache khác tên, cả hai là mục cấp 1 của `os.tmpdir()` (không gom dưới một thư mục cha chung).
4. Khi `stop()` được gọi, khi tiến trình eval thoát bình thường, khi eval FAIL, và khi tiến trình node nhận SIGINT/SIGTERM/SIGHUP, mục cache riêng đó bị xoá. Sau `stop()` không còn mục nào của lần chạy dưới `os.tmpdir()` (không để thư mục cha rỗng). Eval đo cả SIGINT, SIGHUP và SIGTERM. (SIGKILL không bắt được, ngoài phạm vi.)
5. Kết quả PASS/FAIL của các eval front đang có trên code hiện tại không đổi. Cache riêng không được làm một lần chạy FAIL chỉ vì cache bắt đầu "lạnh": nếu cần, nạp sẵn cache riêng từ cache chung (chỉ đọc) hoặc chờ vite sẵn sàng; chọn cách nào là việc của Engineering.

## Ràng buộc (vòi)
- Repo: `tohong-hq` (`eval/_lib/vite_dev.cjs`; nếu cần sửa `eval/T-053/lib/h.py` `front_copy`). Không sửa repo front.
- Vùng: `planner/vendor/images`. Bất biến đã đọc: `eval/invariants/_shared/`, `eval/invariants/planner/` (INV-001: mọi dựng vite dev chỉ qua helper, không vi phạm, đã giữ nguyên hợp đồng helper: cổng listen(0), nonce, nhóm tiến trình riêng, dọn file thử), `planner/vendor/`, `planner/front/vendor-images/` (spec này không đổi PASS/FAIL của chúng).
- Giữ nguyên chữ ký `startViteDev({repo, files})` -> `{port, url, stop}`.
- Không chạm: payment, auth, DB, dữ liệu người dùng, repo front.
- Bậc đề xuất: A (đúng như board) — chỉ sửa công cụ đo, eval phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Kiểm khói: chạy chồng C10 (bản sao, lặp) và small_tile_tooltip (front gốc, tối đa 6 lần hoặc 80s) dưới tải vừa 2 CPU: 0 đỏ giả (small_tile_tooltip chạy một mình PASS trước đó). Thống kê, KHÔNG phân biệt chắc đúng/sai | `python3 eval/T-077/check_1_chay_chong.py` (~1-1,5 phút) |
| 2 | **Eval phân biệt chính, tất định.** Mỗi lần chạy helper có cache vite riêng là mục cấp 1 của TMPDIR (hai lần chạy chồng -> >= 2 mục khác tên), cache chung `node_modules/.vite` không đổi | `python3 eval/T-077/check_2_cache_rieng.py` |
| 3 | PASS/FAIL trên code hiện tại không đổi: small_tile_tooltip PASS, C10 PASS; đột biến M1 (ảnh hỏng) -> C10 FAIL, M2 (mất title) -> small_tile_tooltip FAIL đúng lý do | `python3 eval/T-077/check_3_ket_qua_khong_doi.py` |
| 4 | Dọn cache tạm: sau chạy PASS, chạy FAIL, và SIGTERM / SIGINT / SIGHUP giữa chừng, TMPDIR không còn mục nào (trừ node-compile-cache của node); front không dư file `__*` sau chạy PASS/FAIL | `python3 eval/T-077/check_4_don_cache_tam.py` |

Mọi check nhận `--evalroot DIR` (mặc định `eval/`): chạy cùng phép đo trên một bản sao của `eval/` đã thay helper, để chứng minh xanh trên bản tham chiếu mà không đụng sổ cái. Eval đo hành vi quan sát được ngoài (thư mục tạm, cache chung, PASS/FAIL), không đọc mã helper.
Trạng thái đo 2026-11-07: hiện trạng đỏ ở tiêu chí 2 và 4 (tất định); tiêu chí 3 xanh (chủ ý, chốt "không đổi"); tiêu chí 1 KHÔNG đỏ chắc chắn trên hiện trạng (bản gốc 20 lần/tải 8: đỏ 3/20 một lần, Spec Gate đo hai lần đều xanh) nên chỉ là kiểm khói, đã hạ nhẹ (tải 2 CPU, <= 80s) vì không phân biệt được đúng/sai trên máy này; giữ lại để bắt hồi quy rõ. Bản tham chiếu xanh cả bốn.
**Luật đỏ giả:** check_2 (vế "cache chung không đổi") và bất biến đề xuất có thể đỏ giả khi agent khác đang chạy eval front dùng helper cũ cùng lúc (ADR-035). Gặp đỏ chỉ khi chạy chồng thì chạy lại riêng trước khi phân loại (ADR-035 mục 4).

## Bất biến đề xuất (tầng 2)
Đề xuất cho `eval/invariants/planner/` (cùng luật đỏ giả ở trên): "Helper vite dev của eval không bao giờ ghi vào cache chung `node_modules/.vite` của repo, và không để cache tạm sau chạy" — dạng check_2 + check_4 rút gọn (một lần chạy `startViteDev` với TMPDIR riêng: có cache riêng lúc chạy, cache chung không đổi, TMPDIR sạch sau `stop()`), chạy được không cần chromium. Spec critic rút vào bể khi spec qua cổng.

## Không làm
- Không đổi chờ cố định 15s hay timeout trong lib vendor-images (đó là triệu chứng; đổi sẽ đổi ngưỡng đo, ngoài phạm vi).
- Không đổi PASS/FAIL, ngưỡng, hay nội dung C9/C10/small_tile_tooltip.
- Không sửa repo front hay cấu hình vite của front. Không dọn/xoá cache chung hiện có.
- Không xử lý file thử riêng của small_tile_tooltip còn lại khi bị SIGTERM (`__inv004*`): có từ trước, khác lỗi này.

## Câu hỏi mở
Không.
