# Spec T-058: Mirror ảnh in tiến độ mỗi 100 ảnh và dừng sớm khi 50 ảnh đầu đều hỏng

## Ý định
Capu (2026-11-04): công cụ mirror ảnh phải in tiến độ mỗi 100 ảnh và tự dừng sớm nếu 50 ảnh đầu đều hỏng; Capu muốn biết kết quả sau vài phút, không phải chờ 2 tiếng như lần trước. Sửa công cụ của T-051/T-052; không đổi gì ở front.

## Bằng chứng
- Run 41728164344 (workflow Mirror vendor images, tohong-back) chạy 2 giờ không in dòng nào rồi bị huỷ ở `timeout-minutes: 120` (brief của Capu). marry.vn đang sập, Cloudflare trả 522: máy chủ gốc không trả lời, kết nối treo tới hết thời gian chờ (brief).
- Mã hiện tại (`tohong-back` origin/main, `scripts/vendor-images/vendor-images.mjs`): mặc định `--workers 4 --timeout 20 --retries 2`; chỉ in `FAILED …` và `SUMMARY …` sau khi xong cả hàng đợi; workflow chạy `mirror | tee mirror.log`. Mỗi URL treo tốn 3 yêu cầu × 20 giây = 60 giây; 2.467 URL / 4 luồng ≈ 10 giờ (đúng ước lượng trong brief).
- Phép tính thời gian dừng sớm (nguồn treo kiểu 522): hành vi cũ, 50 URL / 4 luồng = 13 đợt × 60 giây = 13 phút (khoảng 12-15 phút như Capu ước). Hành vi spec này (mục 7, không thử lại timeout trong mẫu): 13 đợt × 20 giây = 260 giây, khoảng 4,5 phút, đạt mục tiêu "khoảng 10 phút" với dư địa.
- Mức tự tin: ~85%. Chưa kiểm được với marry.vn thật (đang sập); eval dùng server giả.

## Giả thuyết
Nếu công cụ in tiến độ và tự dừng khi mẫu đầu đều hỏng thì Capu biết nguồn chặn/treo trong khoảng 5 phút thay vì 2 giờ. Chỉ số bảo vệ: khi nguồn khoẻ, kết quả mirror (manifest, file ảnh, SUMMARY) không đổi so với T-051.

## Hành vi
"Ứng viên mẫu" = URL **trong pool hiện tại** (không phải Pages URL, T-051 mục 13) mà: (a) chưa có entry trong manifest, hoặc (b) có entry `failed` với lý do tạm thời: `timeout`, `network`, `http-5xx` (500-599), `http-403`, `http-429`, **và** `fail_runs` < 3 (thiếu trường coi là 1; mục 9c). Không phải ứng viên mẫu: entry `failed` tạm thời có `fail_runs` ≥ 3 (hỏng mãi: host vendor chết ra `network`, kho ảnh trả 403 cho object đã xoá); entry `ok` (đã có file, khôi phục được, hay tải lại từ URL gốc); entry `failed` với lý do vĩnh viễn (`http-404`, `http-410`, `not-image`, `too-large`, mọi `http-4xx` khác và `http-3xx`); entry mồ côi (URL không còn trong pool, công cụ không gửi yêu cầu cho nó). Các URL không phải ứng viên vẫn được xử lý đúng luật T-051 (entry `failed` vĩnh viễn vẫn được thử lại theo mục 12, ngoài mẫu, và không bị mục 5 chặn). "Đã xử lý" (`done`) = `ok + failed` tại thời điểm in, `ok` gồm cả `new`, `reused`, `restored`, `missing` như trong SUMMARY của T-051; `failed` đếm cả entry mồ côi như T-051.

### A. Dòng tiến độ
1. Dòng tiến độ đúng khuôn một dòng: `PROGRESS done=<n> total=<n> ok=<n> failed=<n> (<lý do>=<n>, <lý do>=<n>)`. `total` = `total` của SUMMARY (số URL trong danh sách việc). Trong ngoặc là số ảnh lỗi theo lý do (`timeout`, `http-403`, `not-image`, `too-large`, `network`, …), chỉ liệt kê lý do có số > 0, xếp theo tên tăng dần, phân cách bằng dấu phẩy và một dấu cách; tổng các số = `failed`. Không có ảnh lỗi thì ngoặc là `(none)`.
2. In một dòng `PROGRESS` ngay khi `done` đạt 100, 200, 300, … (đúng bội số của 100, số liệu tại thời điểm đó). Ngoài ra in một dòng `PROGRESS` ở cuối (trước dòng `SUMMARY`), trừ khi `done` của nó trùng với dòng `PROGRESS` đã in ngay trước (không bao giờ có hai dòng cùng `done`). Hệ quả: tổng 250 thì `done` lần lượt 100, 200, 250; tổng 200 thì 100, 200; tổng 30 thì chỉ một dòng `done=30`; tổng 0 thì một dòng `done=0 total=0 ok=0 failed=0 (none)`.
3. Mỗi dòng `PROGRESS` được ghi ra stdout ngay khi tới (không đệm cho tới cuối lần chạy), để `tee` trên Actions hiện liền: dòng `done=100` tới người đọc trong vòng 1 giây kể từ lúc ảnh thứ 100 xử lý xong.

### B. Dừng sớm
4. Mẫu = tối đa 50 ứng viên mẫu đầu tiên theo thứ tự danh sách việc (thứ tự T-051, không đổi); ít hơn 50 ứng viên thì mẫu là toàn bộ. **Mẫu rỗng thì không có luật dừng sớm**, chạy đúng như T-051 (mã 0/2/3). Một ứng viên "thành công" nghĩa là tải và chuyển ảnh xong (thành `ok`); ảnh `failed` vĩnh viễn thử lại mà vẫn hỏng không phải thành công và cũng không phải lỗi của mẫu.
5. Cả mẫu đều lỗi (mọi lý do tính chung, kể cả lý do vĩnh viễn mới gặp lần này như `not-image`) thì **dừng sớm**; chỉ cần một ứng viên trong mẫu thành công thì không bao giờ dừng sớm. Ứng viên thứ 51 trở đi không được gửi yêu cầu cho tới khi mẫu có một ứng viên thành công hoặc mọi ứng viên của mẫu đã có kết quả; một URL thành công ngoài mẫu không cứu được. Trong lúc chờ, **mọi URL không phải ứng viên thứ 51+ được xử lý bình thường, không bị chặn**: entry `ok` đứng sau (tái dùng `reused`, khôi phục `restored`), entry `failed` vĩnh viễn được thử lại. `done`, `reused`, `restored`, `failed` trong PROGRESS và SUMMARY tính đúng những URL đã xử lý xong tới lúc dừng (mục 6d); URL bị huỷ giữa chừng hoặc chưa bắt đầu không được tính.
6. Khi dừng sớm: (a) mọi yêu cầu còn đang chạy (kể cả yêu cầu khôi phục từ Pages hoặc tải lại của entry `ok` thiếu file) bị huỷ và tiến trình thoát trong vòng 3 giây kể từ lúc URL cuối của mẫu có kết quả, dù yêu cầu đó còn treo; (b) thoát với **mã 4** (thắng mã 3 nếu cả hai cùng xảy ra); (c) không ghi `--manifest`: nếu file chưa có thì vẫn không có, nếu có thì giữ nguyên từng byte; `mirror` vốn không ghi pool và workflow không chạy `rewrite` hay `deploy` sau đó; (d) in dòng `FAILED <URL gốc> <lý do>` cho mỗi URL đã xử lý xong mà lỗi, như bình thường, rồi một dòng `PROGRESS` cuối, rồi dòng cuối cùng `SUMMARY total=<n> ok=<n> new=<n> reused=<n> restored=<n> failed=<n> missing=<n> stopped=early reason=<mã>-<k>/<k>` (các số đếm phản ánh những URL đã xử lý xong tới lúc dừng, `total` giữ nguyên), với `<k>` = cỡ mẫu (50, hoặc ít hơn khi có dưới 50 ứng viên mẫu) và `<mã>` = lý do chung nếu mọi URL trong mẫu lỗi cùng một lý do (vd `timeout-50/50`, `http-403-50/50`), nếu không thì `mixed` (`mixed-50/50`). Lần chạy không dừng sớm thì SUMMARY không có `stopped=` và `reason=`.
7. Lỗi `timeout` của một URL thuộc mẫu không được thử lại (`attempts` = 1 trong manifest nếu lần chạy tiếp tục), vì sao: thử lại làm dừng sớm mất 13 phút thay vì 4,5 phút khi nguồn treo; entry lỗi vẫn được thử lại đầy đủ ở lần chạy sau (T-051 mục 12). Mọi lý do khác của URL trong mẫu (5xx, lỗi mạng) và mọi lỗi của URL ngoài mẫu giữ nguyên luật thử lại `--retries` của T-051 mục 17. Giới hạn thời gian dự kiến khi nguồn treo: tối đa `ceil(50 / workers)` × `timeout` giây = 13 × 20 = 260 giây với mặc định (cộng không quá vài giây).
8. Mã thoát của `mirror` sau T-058: 0 (xong, kể cả có ảnh lỗi), 2 (thiếu tham số / không đọc được pool, manifest), 3 (có `missing`), 4 (dừng sớm). Không thêm tham số dòng lệnh mới; ngưỡng 50 và nhịp 100 là hằng số.
9. Entry `ok` cũ trong manifest không bao giờ bị đổi vì mục 4-8 (T-051 mục 14): dừng sớm giữ nguyên manifest; chạy tiếp thì entry `ok` giữ từng trường.
9c. `fail_runs` (trường mới của entry `failed`, số nguyên ≥ 1) = số lần chạy liên tiếp, có ghi manifest, mà URL đó kết thúc ở trạng thái `failed`: URL thất bại lần đầu thì ghi `fail_runs=1`; entry `failed` thử lại mà vẫn lỗi thì tăng thêm 1 (thiếu trường coi là 1 trước khi tăng); entry thành `ok` thì bỏ trường này; entry không được thử trong lần chạy (mồ côi) giữ nguyên. Lần dừng sớm (mã 4) không ghi manifest nên không tăng `fail_runs`. Entry tạm thời có `fail_runs` ≥ 3 vẫn được thử lại ở mọi lần chạy (T-051 mục 12) nhưng đối xử như hỏng vĩnh viễn: không thuộc mẫu, không chặn URL nào. `fail_runs` là trường thêm vào entry `failed`; T-051 mục 9 (reason, attempts, không có file) giữ nguyên. Cách gỡ thủ công cho host chết: README không cần mục riêng, vì entry này không còn chặn gì.
9b. Chỉ số bảo vệ cụ thể: nguồn khoẻ, manifest có bao nhiêu entry `failed` vĩnh viễn cũng không gây dừng sớm và không chặn URL mới (T-051 mục 11, 12).

### C. Workflow
10. Bước chạy `mirror` trong `.github/workflows/mirror-vendor-images.yml` vẫn đưa stdout ra log ngay (`tee mirror.log`). Khi `mirror` thoát mã 4, bước đó đỏ (mã thoát khác 0) và in một dòng chú thích lỗi (`::error::`) chứa đúng chuỗi `nguồn chặn hoặc treo, xem README đường dự phòng`. Mã thoát khác 0 khác vẫn làm bước đỏ như cũ. Các bước `rewrite`, upload artifact, deploy, mở PR không chạy sau mã 4.
11. Bước báo cáo Summary (chạy cả khi bước trước đỏ) ghi vào trang tóm tắt của run: dòng `PROGRESS` cuối cùng trong `mirror.log`; nếu `SUMMARY` có `stopped=early` thì thêm một dòng `Dừng sớm: reason=<mã>-<k>/<k>` (lấy từ SUMMARY); và các thứ đã có (SUMMARY, danh sách FAILED/MISSING). Không có dòng `PROGRESS` thì ghi "chưa có dòng PROGRESS". Cảnh báo lỗi trên 5% không đổi.

### D. README
12. `scripts/vendor-images/README.md` có một mục tiêu đề chứa "tiến độ" mô tả: một ví dụ dòng `PROGRESS done=… total=… ok=… failed=… (…)` và cách đọc; mỗi 100 ảnh và dòng cuối; `stopped=early` trong SUMMARY; **mã thoát 4** = "50 ảnh đầu đều lỗi nên dừng sớm, không ghi manifest, không deploy" và việc làm tiếp theo (xem mục "Đường dự phòng", chạy trên máy Capu hoặc đợi nguồn sống lại). Dòng "mã 0/2/3" trong "Quy tắc công cụ" thêm mã 4.

## Giao diện dòng lệnh (hợp đồng với eval)
Như T-051; thêm dòng `PROGRESS …` và `SUMMARY … stopped=early reason=…` ở trên, mã thoát 4. Eval chạy `node scripts/vendor-images/vendor-images.mjs mirror …` với server ảnh giả; đường dẫn `/ok/<n>.png` ảnh tốt, `/forbid/<n>` 403, `/hang/<n>` treo, `/slow/<n>` chậm 0,6 giây (`eval/T-058/lib/t058.py`; mọi thư mục tạm dưới một thư mục gốc riêng, xoá khi thoát).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back` · Nhánh: `t-058-mirror-tien-do` · Vùng: `planner/vendor/images`
- Bất biến đã đọc: `eval/invariants/_shared/` và `planner/vendor/images/` INV-001 (pool chỉ trỏ Pages hoặc ảnh chưa mirror), INV-002 (entry `ok` không mất) và INV-003 (rewrite check không xanh giả): spec không vi phạm; mục 6(c) và 9 chính là INV-002.
- Tham chiếu: ADR-020 `decisions/2026-11-03-t049-gate-lenh-co-tham-so-va-rest.md` (eval đọc GitHub thì dùng REST; eval T-058 không đọc GitHub); ADR-021 `decisions/2026-11-03-tu-host-anh-vendor.md` (tự host ảnh vendor, nguồn của T-051).
- Kiến trúc: sửa `vendor-images.mjs`, workflow, README, và thêm test vào `test/test_vendor_images.js` (ca dừng sớm bằng server HTTP cục bộ trả 403 không cần `sharp`); `npm test` xanh.
- Không chạm: payment, auth, DB, dữ liệu người dùng, secret, front, tham số workflow. Không gọi marry.vn thật.
- Bậc lưới lọc: A (theo board): công cụ, workflow, tài liệu; eval tự động phủ hết tiêu chí.

## Tiêu chí chấp nhận và eval
Mọi lệnh offline, `<back>` = `/home/user/tohong-back`. Chạy tất cả: `cd /home/user/tohong-hq && bash eval/T-058/run.sh --back /home/user/tohong-back`.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Tiến độ đúng khuôn, đúng nhịp 100 và dòng cuối không trùng, đủ số liệu lý do, tới ngay khi xảy ra (mục 1-3) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_1_tien_do.py --back /home/user/tohong-back` |
| 2 | 50/50 timeout (entry ok sau URL 51 vẫn được xử lý, đếm đúng reused/restored): dừng sớm trong thời gian ngắn, không thử lại timeout, không gọi URL thứ 51+, huỷ yêu cầu đang chạy, mã 4, SUMMARY, manifest/pool nguyên (mục 4-8) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_2_dung_som_timeout.py --back /home/user/tohong-back` |
| 3 | 50/50 lỗi 403 (và hỗn hợp, và 50 lỗi + ok thứ 51) dừng sớm, `reason` đúng (mục 4-6) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_3_dung_som_403.py --back /home/user/tohong-back` |
| 4 | 49 lỗi + 1 ok (ở đầu hoặc cuối mẫu) thì chạy tiếp, mã 0, ghi manifest, không `stopped=` (mục 5, 7) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_4_chay_tiep.py --back /home/user/tohong-back` |
| 5 | Định nghĩa mẫu: dưới 50 URL; entry failed vĩnh viễn (60 entry + 5 URL mới -> mã 0, 5 URL mới được mirror), mồ côi và failed tạm thời có `fail_runs`≥3 (50 entry + 5 URL mới -> mã 0; `fail_runs`=1 và nguồn treo -> mã 4) không/có thuộc mẫu; ghi `fail_runs` (mục 9c); 50 failed tạm thời timeout + 10 URL mới sau -> mã 4 (mục 4-6, 9b) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_5_duoi_50.py --back /home/user/tohong-back` |
| 6 | Entry `ok` cũ không đổi (dừng sớm và chạy tiếp) và không tính vào mẫu (mục 4, 9) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_6_entry_ok_cu.py --back /home/user/tohong-back` |
| 7 | Workflow: mã 4 làm bước mirror đỏ kèm thông báo; Summary hiện PROGRESS cuối và lý do dừng; không rewrite/deploy sau mã 4 (mục 10-11) | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_7_workflow.py --back /home/user/tohong-back` |
| 8 | README đủ nội dung mục 12 | `cd /home/user/tohong-hq && python3 -I eval/T-058/check_8_readme.py --back /home/user/tohong-back` |
| 9 | `npm test` xanh | `cd /home/user/tohong-hq && cd /home/user/tohong-back && npm test` |

Ánh xạ tiêu chí board: (1) → 1; (2) → 2, 3, 5; (3) → 4; (4) → 6; (5) → 7, 8; (6) → 9.
Đã kiểm khả thi: chạy 1-8 trên `tohong-back` hiện tại phải đỏ (chưa có PROGRESS, mã 4); cài đặt tham chiếu là việc của Engineering.

## Bất biến đề xuất (tầng 2), vùng `planner/vendor/images`
- INV-E: `mirror` không bao giờ thoát mã 4 mà để lại manifest khác byte so với trước lần chạy (mục 6c). Khó viết độc lập nếu không chạy server giả; chuyển phần của `check_6` thành bất biến khi Spec Gate rút. Ngoài ra: không.

## Không làm
- Đổi ngưỡng (50) hoặc nhịp (100) bằng tham số; dừng sớm giữa chừng khi 50 đầu đã có ok nhưng sau đó nguồn sập (chạy tiếp như cũ, chỉ báo PROGRESS).
- Lách chặn của nguồn, đổi `--timeout`/`--retries` mặc định, giảm `timeout-minutes` của workflow.
- Dừng sớm khi entry `ok` thiếu file mà khôi phục đều lỗi (đó là `missing`, mã 3 như T-051).

## Câu hỏi mở
Không.
