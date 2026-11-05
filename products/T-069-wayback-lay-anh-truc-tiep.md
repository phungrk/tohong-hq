# Spec T-069: Wayback lấy ảnh trực tiếp (bỏ API availability), ghi lý do Wayback, lỗi tạm thời của Wayback không gây mã 4

## Ý định
Capu (2026-11-05, board/T-069.md): lần chạy mirror có `--fallback wayback` phải thật sự lấy được ảnh marry.vn đã lưu trên Internet Archive. Sửa T-065/T-067 (`products/T-065-khoi-phuc-anh-tu-wayback.md`), không đổi ý định gốc của nó và ADR-021 (tự host, bản quyền Capu đã nhận).

## Bằng chứng
- Run 42043795998 (`WAYBACK=true`): dừng sớm mã 4, `wayback=0`, 50/50 ảnh đầu lỗi (`http-522=33`, `timeout=17`); dòng `FAILED` không ghi lý do Wayback nên không phân biệt được "không có bản lưu" với "archive.org từ chối" (board/T-069.md).
- Capu, điện thoại, 2026-11-05: `https://archive.org/wayback/available?url=www.marry.vn/images/detailed/170/Calasa.png` trả `429 Too Many Requests`; `https://web.archive.org/web/2024*/www.marry.vn/images/detailed/*` có danh sách ảnh, bấm vào ra hình; `https://web.archive.org/web/20240730154649/https://www.marry.vn/images/detailed/111/anh-cuoi-dinh-ha-thu-4.jpg` mở ra ảnh thật (tin nhắn của Chief of Staff, cùng ngày). Ảnh có trên web.archive.org; API availability bị chặn. Kết luận: công cụ T-067 gọi availability trước nên không bao giờ thấy bản lưu (tự tin ~80%; chưa tái hiện được từ phiên cloud vì archive.org bị chặn ở đây).
- Kiến thức công khai (tra web 2026-11-05, không đọc được tài liệu chính thức từ phiên này): hậu tố `id_` sau mốc thời gian trả nội dung gốc không bọc thanh công cụ; yêu cầu có mốc 14 chữ số được chuyển hướng (302) tới bản lưu gần nhất (nguồn: https://briangrinstead.com/blog/fetch-latest-copy-from-wayback/, https://cloud.browserless.io/skills/archive.org/find-snapshot). Tự tin ~85% cho cả hai. Mốc ngắn như `2` hay `2024` (Capu gợi ý) **không có nguồn xác nhận**, tự tin ~60%: spec chọn mốc đủ 14 chữ số.
- Giới hạn tốc độ: không có số chính thức cho tải lại bản lưu (replay). Nguồn thứ cấp: CDX 15 yêu cầu/phút (https://beta.pkg.go.dev/github.com/ctoyan/waybackcollector); endpoint lưu 25 yêu cầu/phút (https://pypi.org/project/scrapy-wayback-middleware/0.3.3/); lớp chặn 429 thêm năm 2026 (https://www.kunalganglani.com/blog/wayback-machine-rate-limiting-mini-wayback). Một yêu cầu đơn lẻ từ điện thoại Capu đã bị 429 nên chặn theo IP/dải nặng hơn số công bố. Mức tự tin ~50% rằng 1 yêu cầu/2 giây chịu được liên tục.
- Hành vi của Wayback với bản lưu có mã gốc khác 200, và việc bản "gần nhất" có thể là bản mã 404 dù có bản 200 cũ hơn: chưa kiểm được (tự tin ~55% là hiếm với ảnh).

## Giả thuyết
Nếu tải thẳng `/web/<mốc>id_/<URL gốc>` thay vì hỏi availability thì phần lớn ảnh marry.vn có trong Wayback thành entry `ok` (ở run thật đầu tiên `wayback=n` với n lớn hơn 0), và nếu archive.org giới hạn tốc độ thì lần chạy kết thúc mã 0 với manifest hợp lệ thay vì mã 4. Chỉ số bảo vệ: không cờ thì không yêu cầu nào tới archive.org; entry `ok` cũ không đổi; cả mẫu 50 đều "nguồn hỏng và Wayback nói rõ không có bản lưu" vẫn dừng sớm mã 4.

## Hành vi
Mọi thứ của T-065 không nêu lại dưới đây giữ nguyên (khi nào hỏi Wayback: T-065 mục 1-2; nguồn gốc chết và `origin-skipped`: mục 15, 20-21; ghi manifest theo mốc 100: mục 22a; ô `wayback` và `timeout-minutes` 360 của workflow: mục 23-24). Các câu sau **thay** T-065 mục 3 (hai bước availability + raw), 8 (đơn vị lỗi `http-429`/`http-503`), 9 (cách đếm ngắt mạch), 10 (mặc định tốc độ), 13 (giá trị `wayback`), 18 (cách mẫu xử lý lỗi Wayback), 25 (README). "URL gốc", "entry `ok`", "mẫu", "ứng viên mẫu" giữ nghĩa T-051/T-058/T-065. `<base>` mặc định `https://web.archive.org`.

### A. Cách lấy ảnh
1. Với mỗi URL cần hỏi Wayback: gửi `GET <base>/web/20261101000000id_/<href>`, trong đó `<href>` là URL gốc dạng `new URL(url).href` **nguyên văn, không mã hoá thêm** (vd `<base>/web/20261101000000id_/https://www.marry.vn/images/detailed/111/anh-cuoi-dinh-ha-thu-4.jpg`). Mốc `20261101000000` là hằng cố định: đủ 14 chữ số nên Wayback chuyển hướng tới bản lưu gần nhất (mốc này gần hiện tại nên gần như luôn ra bản mới nhất); không dùng mốc ngắn (`2`, `2024`) vì chưa có nguồn xác nhận. Header: `User-Agent` tự nhận chứa `tohong`, `Accept: image/*,*/*;q=0.5`.
2. **Không bao giờ gửi yêu cầu tới đường dẫn `/wayback/available`** (bất kỳ host) và không đọc JSON của API đó. Không dùng CDX.
3. Theo chuyển hướng (3xx có `Location`, giải theo URL hiện tại) tối đa **5 lần**; lần chuyển hướng thứ 6, hoặc `Location` trỏ tới host khác host của `<base>`, dừng với lý do `http-<mã 3xx>` (vd `http-302`). Mỗi chuyển hướng là một yêu cầu, chịu giới hạn tốc độ và lùi 429 (mục 13-15). Lý do chọn 5: bản lưu có thể là chuyển hướng gốc được phát lại (vd http sang https) cộng một lần chuyển hướng "tới bản gần nhất"; bình thường chỉ 1 lần.
4. Nhận diện kết quả của một URL (chỉ một cột đúng):

| Wayback trả về | Kết quả |
| --- | --- |
| 200 và thân giải mã được thành ảnh (T-051 mục 4) | ảnh `ok` (mục 6, 18) |
| 200 nhưng không giải mã được (trang HTML lỗi của Wayback, ảnh cụt) | `not-image` |
| 200 nhưng URL cuối không có dạng `/web/<14 chữ số>id_/` | `none` (không nhận ra bản lưu) |
| thân > 30MB | `too-large` |
| 404 | `none` |
| 429 hoặc 503 sau hết lần thử (mục 15) | `rate-limited` |
| ngắt kết nối, lỗi mạng, hoặc quá `--timeout` | `network` |
| 403 | `http-403` |
| 5xx khác 503 (không thử lại) | `http-5xx` (vd `http-502`) |
| 4xx khác 403, 404, 429 | `http-<mã>` (vd `http-410`) |

5. Phương án dự phòng CDX **không làm** trong việc này (xem "Không làm"): nếu run thật có `wayback=none` nhiều bất thường thì mở việc mới. Lý do: CDX cũng bị giới hạn (nguồn thứ cấp ghi 15 yêu cầu/phút) và mỗi URL thêm một yêu cầu.
6. Entry `ok` ghi `snapshot` = 14 chữ số trong `/web/<14 chữ số>id_/` của **URL cuối cùng sau chuyển hướng** (mục 4, hàng 3). Tên file theo URL gốc (T-051 mục 7).

### B. Lý do Wayback trong đầu ra
7. Khi Wayback đã được hỏi (hoặc bị ngắt mạch) mà URL vẫn `failed`: entry có trường `wayback` và dòng stdout là **`FAILED <URL gốc> <reason> wayback=<lý do>`** (đúng một dấu cách trước `wayback=`, `reason` là lý do của nguồn gốc như T-065 mục 15). Không hỏi Wayback (không cờ, hoặc nguồn gốc `too-large`) thì dòng `FAILED <URL gốc> <reason>` và entry không có `wayback`.
8. Giá trị `<lý do>` thuộc tập: `none`, `rate-limited`, `circuit-open`, `network`, `not-image`, `too-large`, `http-<mã>` (cột "Kết quả" mục 4; `circuit-open` mục 11). Không giá trị nào khác (đặc biệt không còn `timeout`, `http-429`, `http-503`).

### C. Lỗi tạm thời của Wayback không làm hỏng mẫu 50
9. **Lỗi tạm thời** của Wayback = `rate-limited`, `circuit-open`, `network`, `http-403`, `http-5xx`. Mọi giá trị khác của mục 8 là **kết luận rõ** (Wayback đã trả lời về chính ảnh này).
10. Kết quả của một URL thuộc **mẫu dừng sớm** (T-058, T-065 mục 18) khi có cờ: (a) `ok` (từ nguồn gốc hay Wayback): mẫu qua, không bao giờ dừng sớm; (b) `origin-skipped`: ra khỏi mẫu (T-065 mục 15); (c) `failed` với `wayback` là lỗi tạm thời: **không tính là hỏng**, mẫu chuyển sang "chưa kết luận"; (d) `failed` còn lại (nguồn gốc lỗi và Wayback có kết luận rõ). Khi mọi URL còn trong mẫu đã có kết quả: dừng sớm mã 4 (T-058 mục 8; không ghi manifest) **nếu và chỉ nếu** không có (a), không có (c) và có ít nhất một (d); ngược lại không dừng sớm, các ứng viên thứ 51+ được thả, lần chạy tiếp tục. Hệ quả: archive.org giới hạn tốc độ hoàn toàn thì lần chạy **không bao giờ** ra mã 4; 49 URL "không có bản lưu" cộng 1 URL bị 429 cũng không mã 4.
11. **Ngắt mạch**: sau **5 URL liên tiếp** (theo thứ tự được hỏi) kết thúc bằng lỗi tạm thời `rate-limited`, `network`, `http-403` hoặc `http-5xx` thì không gửi thêm yêu cầu nào tới archive.org trong phần còn lại của lần chạy; mọi URL còn lại cần hỏi Wayback giữ `failed` với `wayback=circuit-open`. Một URL kết thúc theo cách khác (kể cả `none`, `not-image`, `ok`) đặt bộ đếm về 0. Ngắt mạch không kết thúc lần chạy: nguồn gốc vẫn được thử cho các URL còn lại theo luật hiện có.
12. **Kết thúc khi ngắt mạch hoặc Wayback lỗi tạm thời**: lần chạy chạy hết, ghi manifest cuối (mọi entry `ok` giữ nguyên, mọi URL chưa cứu được là `failed`), thoát **mã 0** (hoặc mã 3 nếu có `MISSING` như T-051; không bao giờ mã 4 vì lý do ở mục 10). SUMMARY có thêm, ngay sau `wayback=<n>` và trước `stopped=`: `retry-later=<n>` (số URL `failed` có `wayback` là lỗi tạm thời, kể cả `circuit-open`; luôn in khi có cờ, kể cả 0) và `circuit=open` (chỉ in khi đã ngắt mạch). Lần chạy sau thử lại các URL đó (entry `failed` luôn được thử lại, T-051 mục 12; entry có trường `wayback` ra khỏi mẫu, T-065 mục 18, nên chạy lại không kẹt mã 4).

### D. Tốc độ
13. Mặc định **không quá 1 yêu cầu mỗi 2 giây** (`--wayback-interval` mặc định **2000** ms) tới archive.org, tính mọi yêu cầu kể cả chuyển hướng: hai yêu cầu bắt đầu cách nhau ≥ interval. Sàn cho host không phải loopback vẫn **1000** ms (đúng ràng buộc "tối đa 1 yêu cầu/giây"); `--wayback-interval` dưới 1000 hoặc `--wayback-backoff` dưới 2000 với base không phải loopback (`127.0.0.1`, `localhost`, `[::1]`), và mọi tham số `--wayback-*` khi thiếu `--fallback wayback`, bị từ chối mã 2 (một dòng stderr nêu tên tham số, không ghi manifest, không yêu cầu mạng), như T-065 mục 10. Workflow không truyền các tham số này.
14. Chỉ **một URL được hỏi Wayback tại một thời điểm**, dù `--workers` là bao nhiêu (mốc, chuyển hướng và bản lưu của cùng URL liền nhau).
15. 429 hoặc 503: chờ rồi gửi lại **cùng yêu cầu**, tối đa 3 lần thử lại (≤ 4 yêu cầu). Thời gian chờ = `Retry-After` nếu là số nguyên giây (cắt ở 60), nếu không thì `backoff × 2^k`, k = 0, 1, 2 (mặc định 2, 4, 8 giây). Hết lần thử: `rate-limited`.
16. Vì sao 2 giây thay vì 1: (i) một yêu cầu đơn lẻ của Capu đã bị 429, nên archive.org đang chặn nặng hơn mức công bố; (ii) không có số chính thức cho replay, nguồn thứ cấp cho 15-25 yêu cầu/phút ở các endpoint khác, 30 yêu cầu/phút vẫn là mức thận trọng nhất mà thời gian cho phép (15 yêu cầu/phút sẽ cần ~5,5 giờ, sát giới hạn 6 giờ của Actions); (iii) bị 429 hàng loạt tốn thời gian hơn là chậm đều. Coi run thật đầu tiên là phép đo: Capu đọc `retry-later` và `circuit=open` trong SUMMARY.
17. Ước thời gian cho 2.467 ảnh, giả sử nguồn gốc chết (nguồn gốc tốn ≤ 50 × (1 + retries) yêu cầu, không đáng kể) và mọi ảnh có bản lưu: mỗi ảnh 2 yêu cầu (mốc + bản lưu) = 4.934 yêu cầu. Ở 2 giây: 4.934 × 2 = 9.868 giây ≈ **2 giờ 45 phút** nếu mỗi yêu cầu trả lời dưới 2 giây (độ trễ thật chưa đo; tự tin ~60%); nếu trung bình 3 giây thì ≈ 4 giờ 6 phút; giới hạn 360 phút bị chạm khi trung bình ≈ 4,4 giây mỗi yêu cầu. Ở 1 giây (so sánh): ≈ 82 phút. Mỗi chuyển hướng trung gian thêm 2 giây cho ảnh đó; mỗi 429 thêm 2-8 giây. Manifest ghi theo mốc mỗi 100 ảnh (T-065 mục 22a) nên job bị huỷ không mất toàn bộ.

### E. Manifest và bất biến
18. Entry `ok` qua Wayback giữ đúng 7 trường `status`, `file`, `width`, `height`, `bytes`, `source: "wayback"`, `snapshot` (T-065 mục 11); entry `ok` không bao giờ bị đổi hay hỏi lại (T-065 mục 12); ảnh tải được từ nguồn gốc không có `source`/`snapshot`.
19. **inv-006 không phải đổi nội dung kiểm.** inv-006 đo qua `--wayback-base` loopback và đo khoảng cách ≥ 0,9 giây, không cùng lúc: cả hai vẫn đúng với mặc định 2 giây và không phụ thuộc host hay API availability (đã chạy xanh trên bản dựng thử). Chỉ một câu trong docstring ("mỗi URL một availability") sẽ lỗi thời. **Đề xuất nội dung ADR (Chief of Staff ghi):** "T-069: công cụ mirror không dùng API availability của Wayback nữa (archive.org trả 429); tải thẳng `/web/<mốc>id_/<URL gốc>`. INV-006 giữ nguyên hiệu lực và ngưỡng 0,9 giây; chỉ sửa chữ trong docstring (bỏ 'availability', nêu 'mốc + bản lưu'); thêm INV-007: `mirror` không bao giờ gửi yêu cầu tới `/wayback/available`. Tốc độ mặc định 2 giây (sàn 1 giây không đổi). Eval T-065 `check_1`-`check_5` mô hình hoá availability nên thay bằng eval T-069 (đánh dấu superseded); `check_6`, `check_7` của T-065 cũng được thay bằng `check_6` của T-069."
20. Bất biến đề xuất INV-007: xem mục "Bất biến đề xuất".

### F. Workflow, README, test
21. Bước Summary của `.github/workflows/mirror-vendor-images.yml`: giữ dòng `Wayback: <n> ảnh khôi phục…`; nếu dòng SUMMARY có `circuit=open` thì thêm một dòng bắt đầu **`Wayback ngắt mạch`** nêu số `retry-later` và lời nhắc chạy lại sau ít nhất 1 giờ; không `circuit=open` thì không có dòng này. Workflow vẫn không truyền tham số tốc độ; `timeout-minutes` vẫn 360. Lần chạy ngắt mạch không làm job đỏ (mã 0).
22. `scripts/vendor-images/README.md`, mục Wayback, viết lại: dạng URL `/web/<mốc>id_/<URL gốc>` và theo chuyển hướng (tối đa 5), **không dùng availability** (archive.org trả 429), `wayback=<lý do>` ở dòng `FAILED` và các giá trị, lỗi tạm thời không tính vào dừng sớm mã 4, ngắt mạch kết thúc mã 0 với `retry-later` và `circuit=open`, tốc độ mặc định 2 giây (sàn 1 giây), 429 lùi theo `Retry-After` hoặc 2/4/8 giây; các ý còn đúng của mục cũ (cờ, ô workflow, `origin-skipped`, `source`/`snapshot`, mốc 100, ADR-021) giữ.
23. `npm test` xanh; các ca Wayback trong `test/test_vendor_images.js` được viết lại cho cách mới (server cục bộ giả `/web/<mốc>id_/`, có chuyển hướng), ≥ 3 ca có "wayback" trong tên, không ca nào còn dựng `/wayback/available` như đường dùng được. Không gọi archive.org thật.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-back`, nhánh `t-069-wayback-id` · Vùng: `planner/vendor/images`. Sửa `scripts/vendor-images/vendor-images.mjs`, workflow, README, test; không thêm dependency.
- Bất biến đã đọc: `eval/invariants/_shared/` và `planner/vendor/images/` inv-001..006: spec không vi phạm (mục 19); `check_5` chạy lại cả sáu trên bản dựng thử.
- Tham chiếu: ADR-021 (bản quyền, tự host), ADR-020 (không dùng: eval không đọc GitHub), T-051, T-058, T-065.
- Không chạm: payment, auth, DB, dữ liệu người dùng, secret, front. Không liên hệ vendor hay Internet Archive. Eval và test không gọi archive.org.
- Bậc C (theo board): dịch vụ ngoài, ảnh sao chép không đảo ngược. Capu duyệt diff hành vi, tự merge và tự chạy workflow `wayback=true`.

## Tiêu chí chấp nhận và eval
Mọi lệnh offline; không có `--back` thì eval tự tìm `tohong-back` (biến `TOHONG_BACK_REPO`, cwd, `../tohong-back`, `/home/user/tohong-back`).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Nguồn gốc lỗi mà Wayback có bản lưu → tải bằng `/web/20261101000000id_/<URL gốc>`, theo chuyển hướng (≤ 5; 6 lần, vòng lặp, host lạ thì không), entry `ok` 7 trường `source=wayback` `snapshot` = mốc URL cuối, ảnh mẫu của Capu (`…20240730154649…anh-cuoi-dinh-ha-thu-4.jpg`) thành `ok`; 404/HTML/bản lưu mã lỗi giữ `failed`; nguồn `ok`/`too-large`/không cờ không hỏi (mục 1, 3, 4, 6, 14) | `cd /home/user/tohong-hq && python3 -I eval/T-069/check_1_lay_anh.py` |
| 2 | Không yêu cầu nào tới `/wayback/available` (mục 2, INV-007) | `cd /home/user/tohong-hq && python3 -I eval/T-069/inv-proposed-khong-goi-availability.py` |
| 3 | Dòng `FAILED … wayback=<lý do>` và trường `wayback` đúng cho `none`, `rate-limited`, `network` (cả timeout), `not-image`, `http-403`, `http-502`, `http-410`, `circuit-open`; không hỏi thì không hậu tố (mục 7-8, 11) | `cd /home/user/tohong-hq && python3 -I eval/T-069/check_2_ly_do.py` |
| 4 | 429/503/ngắt kết nối của Wayback không gây mã 4 (mã 0, manifest ghi, `retry-later`, `circuit=open`); 50/50 "không có bản lưu" vẫn mã 4; 49 `none` + 1 bị 429 không mã 4; 49 `none` + 1 ảnh không mã 4; chạy lại sau hồi phục mã 0 (mục 9-12) | `cd /home/user/tohong-hq && python3 -I eval/T-069/check_3_dung_som.py` |
| 5 | Mặc định ≥ 2 giây giữa hai yêu cầu kể cả chuyển hướng, một lúc một yêu cầu dù `--workers 4`; 429 lùi theo `Retry-After`, hoặc nhân đôi; đúng 4 yêu cầu rồi bỏ; sàn tốc độ từ chối mã 2 (mục 13-15) | `cd /home/user/tohong-hq && python3 -I eval/T-069/check_4_toc_do.py` |
| 6 | Manifest giữ `source`/`snapshot`; entry `ok` cũ không hỏi lại nguồn nào; inv-001..006 xanh (mục 18-19) | `cd /home/user/tohong-hq && python3 -I eval/T-069/check_5_manifest_bat_bien.py` |
| 7 | Summary có dòng `Wayback ngắt mạch`, README đủ nội dung, `npm test` xanh với ≥ 3 ca Wayback viết cho cách mới (mục 21-23) | `cd /home/user/tohong-hq && python3 -I eval/T-069/check_6_workflow_readme_npm.py` |

Ánh xạ tiêu chí board: (1) → 1; (2) → 2; (3) → 3; (4) → 4; (5) → 5; (6) → 6, 7.
**Đã kiểm khả thi:** bản dựng thử (bản sao `tohong-back` main 8074508 trong thư mục scratchpad, không commit, đã xoá) làm cả 7 eval xanh; trên main (8074508) cả 7 đỏ (công cụ vẫn gọi availability). Thời gian chạy cả bảy ≈ 4-6 phút (`check_4` chờ giãn cách 2 giây thật, `check_6` chạy `npm test`).
**Ghi chú cho Code Gate:** `check_5` và INV-007 chạy trên công cụ thật; `INV-007` chỉ rút vào bể sau khi T-069 qua Code Gate (trên main nó đỏ vì công cụ còn gọi availability).

## Bất biến đề xuất (tầng 2), vùng `planner/vendor/images`
- **INV-007**: `mirror` không bao giờ gửi yêu cầu tới `/wayback/available` (bất kỳ host). Chạy được, tự đứng, không tham số: `eval/T-069/inv-proposed-khong-goi-availability.py` (PASS "chưa áp dụng" khi công cụ chưa có `--fallback`). Rút vào bể **sau** Code Gate, không phải khi qua Spec Gate (đỏ trên main).
- Không đề xuất thêm bất biến về mã 4 hay ngắt mạch: đã bao bởi INV-004 (mã 4 không đổi manifest) và eval hành vi.

## Không làm
- CDX hoặc thử bản lưu cũ hơn khi bản "gần nhất" lỗi; chọn bản lưu theo ngày; mốc ngắn (`2`, `2024`).
- Hạ tốc độ dưới 1 yêu cầu/giây, lách chặn (đổi User-Agent giả, proxy, nhiều IP), truyền tham số tốc độ từ workflow.
- Thử lại URL `rate-limited` trong cùng lần chạy sau khi ngắt mạch (để lần chạy sau).
- Sửa eval T-065 hay bất biến trong bể (Chief of Staff ghi ADR, mục 19).
- Đổi front, pool, deploy, ngưỡng 50 hay nhịp 100.

## Câu hỏi mở
Không. (Ghi nhận cho Capu: tốc độ mặc định 2 giây thay vì 1 giây là lựa chọn của spec, mục 16; đổi lại chỉ cần đổi hằng số và `check_4`.)
