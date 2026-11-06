# Spec T-081: Dòng trong modal việc chờ Capu có link tới issue của việc, kèm gợi ý "/ok" khi việc đang leo thang

## Ý định
Capu (2026-11-06, tách từ T-079 tiêu chí 5): mỗi dòng trong modal Capu có link tới issue của việc khi có, để Capu vào issue gõ `/ok`. Việc `board/T-081.md`, bậc B, vùng `hq/dashboard`. Phụ thuộc T-078 (modal, đã merge), T-079 (`/ok`, `products/T-079-ok-tren-issue.md`).

## Bằng chứng
- `/ok` chỉ nhận việc có `issue` **và** `state: escalated` (T-079 A1); việc `blocked`/`done` có Decision Request chưa quyết bị từ chối `not_escalated`. Nên gợi ý "/ok" chỉ đúng ở một loại dòng.
- Ảnh chụp sổ cái 2026-11-06 (`eval/T-076/fixtures/ledger-2026-11-06`): T-072 `issue: 16`, T-074 `issue: 21` (đang escalated, vào modal); T-016, T-070 không có issue. Board thật ghi `issue: 16` hoặc `issue: ""`.
- Trang đọc `capu_queue.links` và vẽ mọi phần tử thành thẻ `a[data-capu-link]` (`/home/user/tohong-hq-dashboard/index.html` ở `origin/main`, hàm `capuDraw`), nên thêm link vào dữ liệu là đủ để hiện. `tasks[]` công khai không có trường `issue` (`scripts/export_dashboard.py`).
- Repo `phungrk/tohong-hq` riêng tư, trình duyệt không gọi được GitHub; link chỉ là `href`, không gọi mạng.
- Tự tin ~85%: Capu muốn link nằm cạnh link Decision Request và thấy rõ chỗ gõ `/ok`. Giả định: nhãn "Issue #N" đủ rõ (không có mẫu đối chiếu).

## Quyết định thiết kế (đóng các câu hỏi Chief of Staff nêu)
- **Q1 Nơi link nằm: trong `capu_queue[].links` do exporter xuất** (không để trang tự dựng từ `tasks[].issue`). Lý do: một nguồn link duy nhất cho modal (D2/D3 của T-076); `tasks[]` công khai không phải thêm trường; INV-009 (a) đã kiểm đúng chỗ này. Hệ quả: dòng `escalated` mới do cập nhật live mà `capu_queue` chưa kịp xuất vẫn hiện (U1) nhưng **chưa có link issue và chưa có gợi ý** cho tới lần xuất kế tiếp; chấp nhận.
- **Q2 Nhãn:** `Issue #<n>`. `pr_state` = `""`.
- **Q3 Thứ tự link trong một dòng:** link Decision Request (nếu có) → link Issue → các link PR (theo D3). Quy tắc đơn: Issue đứng ngay sau Decision Request và trước PR.
- **Q4 Bản `--public`:** không lộ thêm gì ngoài con số `<n>` nằm trong URL (repo riêng tư, URL không mở được nếu không đăng nhập); không thêm `issue` vào `tasks[]`, không đưa tiêu đề/nội dung issue. Bản `--public` và bản thường cho cùng `capu_queue`. Cần sửa INV-009 (URL hợp lệ hiện không có `issues/<n>`): xem Câu hỏi mở.

## Hành vi

### Exporter (`scripts/export_dashboard.py`, `build_capu_queue`)
D-I1. Mỗi phần tử `capu_queue` (mọi `kind`) có đúng một link `{"label": "Issue #<n>", "url": "https://github.com/phungrk/tohong-hq/issues/<n>", "pr_state": ""}` khi trường `issue` trên board của việc là số nguyên dương viết thường: khớp `^[1-9][0-9]*$` sau khi bỏ nháy kép bao ngoài và khoảng trắng đầu cuối (`12` và `"12"` đều là 12). Mọi giá trị khác (rỗng, `0`, `007`, chữ, số âm, số thập phân) thì **không có link issue** và không lỗi.
D-I2. Có `issue` không làm thay đổi tập việc trong `capu_queue`, không đổi `kind`, `decide_by`, hay các link khác. Việc có issue mà không thuộc loại nào (PR đã merged, đang `doing`, ...) vẫn không vào.
D-I3. Thứ tự `links` theo Q3. Việc B/C không có PR (D4 của T-076) mà có issue: `links` chỉ có link Issue (vẫn vào nhờ luật 48 giờ).
D-I4. Link đúng ba khoá `label`, `url`, `pr_state`; tối đa một link issue mỗi phần tử; `tasks[]` không có khoá `issue` ở bản `--public`. Sửa có chủ ý T-076 D2/D3 chỗ "links chỉ gồm Decision Request và PR chưa xử lý": nay gồm thêm link Issue. (D-I1 đến D-I4 thay D1 của T-076 ở chỗ nói về `links`; các câu khác của T-076 giữ nguyên.)

### Trang (`index.html`, modal `#capu-modal`)
D-I5. Link issue hiện như mọi link khác của dòng: thẻ `a[data-capu-link]`, `target="_blank"`, `rel` có `noopener`, chữ là `label`, `href` là `url`. Dòng không có link issue trong dữ liệu thì không có thẻ nào trỏ tới `/issues/`. Không dựng link issue từ nguồn nào khác `capu_queue` (dữ liệu cũ không có `capu_queue`, U2 của T-076: không có link issue).
D-I6. **Gợi ý /ok:** dòng có `data-kind="escalated"` **và** có link issue có đúng một phần tử `[data-capu-ok-hint]` (không phải thẻ `a`, không click được) với chữ chính xác `Quyết bằng cách bình luận "/ok <nội dung>" dưới issue`. Mọi dòng khác (kể cả `decision`, `blocked`, `diff-b`, `merge-c` có issue; dòng `escalated` không có link issue) **không có** phần tử này.
D-I7. Dòng chỉ có link Issue (không DR, không PR) không hiện "chưa có link"; "chưa có link" chỉ hiện khi `links` rỗng (U4 của T-076 giữ nguyên).
D-I8. iPhone 390px: không cuộn ngang trang; link issue cao >= 32px (như U9); gợi ý nằm trọn trong chiều ngang.
D-I9. Số trên khối Capu, số dòng, thứ tự dòng, bộ lọc sản phẩm, tóm tắt T-037 không đổi (U1-U12 của T-076): issue chỉ thêm link, không thêm hay bớt dòng.

## Ràng buộc
- Chỉ đọc `issue` từ board; không gọi mạng, không token (đúng INV-001 `_shared`).
- Bất biến đã đọc: `hq/dashboard` INV-006 (số khối = số dòng: không đổi), 007 (lọc: không đổi), 008 (queue không chứa việc đã xử lý: không đổi tập), 009 (URL link hợp lệ: **mâu thuẫn có chủ ý**, cần sửa), 010-012 (không chạm). `hq/ledger/inv-001` (issue là số nguyên dương): D-I1 dùng cùng định nghĩa.
- Repo: `phungrk/tohong-hq` (exporter, eval) + `phungrk/tohong-hq-dashboard` (trang). Tự tin vùng `hq/dashboard`.

## Không làm
- Gọi API GitHub hay hiện tiêu đề/trạng thái issue; nút "/ok" bấm được; hộp nhập `/ok` trên dashboard; link tới bình luận cụ thể (`#issuecomment`); thêm `issue` vào `tasks[]`; backfill issue cho việc cũ; sửa `/ok` (T-079).
- Sửa T-076 ngoài chỗ ghi ở D-I4 và hai eval nêu dưới.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí | Eval |
| --- | --- | --- |
| 1 | Exporter: link `Issue #<n>` khi và chỉ khi issue hợp lệ; thứ tự DR, Issue, PR; không đổi tập/loại; ba khoá; `--public` = bản thường; `tasks[]` không có `issue` (D-I1-D-I4) | `cd /home/user/tohong-hq && python3 eval/T-081/check_1_export_link_issue.py` |
| 2 | Trang (fixture cố định, 1280 và 390px): link issue tab mới, noopener, đúng thứ tự, bấm thật mở tab tới đúng issue và tab mới không có opener; dòng không issue không link; gợi ý chỉ ở `escalated` có issue; 390px không tràn (D-I5-D-I8). Cuộn khối Capu và link vào khung nhìn trước khi bấm | `cd /home/user/tohong-hq && node eval/T-081/check_2_modal_link_issue_va_goi_y.cjs` |
| 3 | Ca thật: ảnh chụp 2026-11-06 qua exporter `--public` rồi trang 390px: T-072 → Issue #16 + gợi ý, T-074 → Issue #21 + gợi ý, T-016/T-070 không; sổ cái thật khớp board (D-I1, D-I6, D-I9) | `cd /home/user/tohong-hq && node eval/T-081/check_3_ca_that.cjs` |
| 4 | INV-006..009 `hq/dashboard` xanh trên sổ cái và trang thật; INV-009 chấp nhận `issues/<n>` của repo sổ cái và vẫn từ chối URL lạ | `cd /home/user/tohong-hq && bash eval/T-081/check_4_bat_bien_hq_dashboard.sh` |
| 5 | Hồi quy T-076: dòng/số/thứ tự/lọc không đổi (D-I9) | `cd /home/user/tohong-hq && python3 eval/T-076/check_3_export_pr.py && node eval/T-076/check_6_ca_that.cjs && node eval/T-076/check_1_mo_modal_so_khop.cjs` |

Mỗi tiêu chí brief có một eval: brief tiêu chí 1 gồm eval 1-3 và 5 (hành vi), phần "INV-006..009 xanh" là eval 4. Ghi chú: eval JS cần Playwright (`NODE_PATH=$(npm root -g)`), d3 cục bộ (`D3=/đường/dẫn/d3.min.js`), repo dashboard ở `origin/main` đã có T-078 (`TOHONG_DASHBOARD_REPO`). Đỏ trước khi làm: eval 1, 2, 3, 5(check_6), 4 (INV-009 chưa đổi); `check_2` đỏ chỉ ở gợi ý /ok.

## Đã sửa eval T-076 có chủ ý (ghi vết)
- `eval/T-076/check_6_ca_that.cjs`: kỳ vọng "mỗi dòng đúng một link tới Decision Request" đổi thành "link Decision Request đứng đầu; T-072 và T-074 (có issue 16, 21 trên board) có thêm đúng một link `Issue #<n>`; các dòng khác một link". Lý do: D-I1.
- `eval/T-076/check_3_export_pr.py`: không đổi kỳ vọng (việc giả không có `issue`), chỉ thêm ghi chú trong docstring. `check_7` giữ nguyên (không issue; biểu thức URL của nó là danh sách URL của T-076, sẽ phải nới nếu thêm ca issue).

## Bất biến đề xuất
- **Sửa INV-009 hq/dashboard** (chỉ Chief of Staff, ghi `decisions/`): thêm `issues/[1-9]\d*` vào danh sách URL hợp lệ (cả bản kiểm export lẫn bản kiểm trang). Bản dự thảo chạy được: `eval/T-081/inv-draft-009/`.
- **INV mới hq/dashboard** (Spec Critic rút khi qua Spec Gate): link issue trong `capu_queue` đúng `https://github.com/phungrk/tohong-hq/issues/<n>`, `<n>` bằng `issue` trên board, việc không có issue hợp lệ thì không có link, `tasks[]` công khai không có `issue`. Dự thảo: `eval/T-081/inv-draft-013-link-issue-dung-so-viec.py` (hiện PASS vì queue thật chưa có việc nào có issue).
- (Ý, không dự thảo) Gợi ý `/ok` chỉ ở dòng `escalated` có issue: giữ ở eval 2 vì phụ thuộc T-079 A1.

## Câu hỏi mở
1. Chief of Staff áp bản sửa INV-009 vào bể (đổi bất biến cần quyết định ghi `decisions/`) **trước khi** Engineering bàn giao, nếu không Code Gate đỏ ở eval 4 do bất biến cũ chứ không do code.

## Mức tự tin
~80%. Rủi ro: nhãn và chữ gợi ý là lựa chọn của Product (không có mẫu), `check_2` khoá chữ gợi ý chính xác; dòng `escalated` live chưa có link tới lần xuất sau (Q1).
