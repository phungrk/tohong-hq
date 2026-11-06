# Spec T-076: Chạm khối Capu trên dashboard mở danh sách việc chờ Capu duyệt, kèm link nơi duyệt

## Ý định
Capu (2026-11-06): "Trên dashboard anh thấy có 7 task chờ a duyệt nhưng mà anh không biết phải duyệt cái gì? Duyệt ở đâu? Mong muốn khi a tap vào đó nó hiển thị modal, trong đó list ra các task chờ a duyệt và link đến chỗ a phải approve". Việc `board/T-076.md`, bậc A, vùng `hq/dashboard`.

## Bằng chứng
- Khối Capu (`#nd_capu`, hàm `drawModel` trong `/home/user/tohong-hq-dashboard/index.html`) đếm `esc` (state escalated) + `capuRead` (owner engineering, state done, tier khác A, cập nhật < 48h). Không có cách nào biết PR đã merge hay chưa, nên 2026-11-06 hiện 7 trong khi chỉ T-072, T-074 thật sự chờ (Decision Request ở `inbox/capu/T-072-r8-khoa-eval.md`, `T-074-dinh-nghia-phu-hop-va-cach-do.md`); T-052, T-055, T-057, T-067, T-068, T-070 đã được Capu merge.
- Nguồn dữ liệu của trang: `dashboard.json` trên nhánh `dashboard-data`, do `scripts/export_dashboard.py --public` (workflow `.github/workflows/publish-dashboard-data.yml`) tạo. Bản công khai **bỏ `detail` và `link`** của sự kiện (`PRIVATE_EVENT_FIELDS`), và không có trường nào cho PR, nên trang hiện không thể biết link PR hay trạng thái merged. Trình duyệt không được gọi GitHub API (repo `phungrk/tohong`, `tohong-front`, `tohong-back` là riêng tư: gọi không token trả 404, đã thử).
- Link PR có sẵn trong sổ cái: sự kiện `handoff` của engineering (`link` dạng `https://github.com/phungrk/tohong-front/pull/59` hoặc `handoffs/T-xxx-vN.md`) và nội dung `handoffs/T-xxx-v*.md` (vd T-052 có 3 PR, T-068 có PR #63). Link Decision Request: file `inbox/capu/T-xxx-*.md` (sự kiện `escalated` có `link` rỗng, nên tra theo tên file).
- Tự tin ~85% rằng đây là đúng nhu cầu (Capu nêu thẳng); ~60% rằng lấy được trạng thái merged tự động, vì cần một token đọc PR (xem Câu hỏi mở).

## Giả thuyết
Nếu khối Capu chỉ đếm việc thật sự còn chờ và chạm vào là thấy danh sách kèm link thì Capu duyệt đúng chỗ ngay từ lần chạm đầu, số trên khối không còn làm Capu nghi ngờ. Chỉ số bảo vệ: khối Capu vẫn sáng khi có việc leo thang (INV-007, hq/dashboard/model), vẫn không cuộn ngang ở 390px (INV-006), Esc từng lớp khi phóng to (INV-027).

## Hành vi (người dùng thấy gì)

### Dữ liệu (tầng xuất, repo `phungrk/tohong-hq`)
D1. `export_dashboard.py` (cả bản `--public`) thêm vào `dashboard.json` mảng cấp một **`capu_queue`**. Mỗi phần tử có đúng ba khoá: `task` (mã việc), `kind` (`escalated` | `diff-b` | `merge-c`), `links` (mảng, mỗi phần tử đúng ba khoá `label`, `url`, `pr_state`). Không thêm gì khác vào `dashboard.json`; sự kiện công khai vẫn không có `detail`/`link`.
D2. Việc vào `capu_queue` khi và chỉ khi:
  - `escalated`: board có `state: escalated` (mọi chủ việc, mọi bậc). `links` có một phần tử `{label:"Decision Request", pr_state:""}`; `url` = `https://github.com/phungrk/tohong-hq/blob/main/inbox/capu/<file>` với `<file>` là file `inbox/capu/<task>-*.md` có tên đứng cuối theo thứ tự chữ cái; không có file thì `url` = `https://github.com/phungrk/tohong-hq/tree/main/inbox/capu`.
  - `diff-b` / `merge-c`: `owner: engineering`, `state: done`, `tier` B / C, và có ít nhất một PR còn mở (xem D3), hoặc không ai biết PR nào còn mở nhưng việc cập nhật dưới 48 giờ (D4). Bậc A không bao giờ vào. Việc có mọi PR đã merge hoặc đóng (không merge) **không vào** và không để lại dấu vết trong `capu_queue`.
D3. PR của một việc = mọi URL dạng `https://github.com/phungrk/<repo>/pull/<n>` trong `link` của sự kiện `handoff` từ engineering của việc đó và trong `handoffs/<task>-v*.md`, bỏ trùng, thứ tự theo lúc gặp đầu tiên (sự kiện theo thời gian, rồi file theo số bản). Trạng thái từng PR (`pr_state`): `open`, `merged`, `closed`, `unknown`. `links` của việc `diff-b`/`merge-c` chỉ gồm PR `open` và `unknown`, `label` = `PR <repo>#<n>`. Việc có PR `open` vào `capu_queue` bất kể tuổi (giới hạn tra cứu: việc cập nhật trong 30 ngày).
D4. `unknown` (không có token, API lỗi, PR không tra được) **không được giả thành open hay merged**. Việc chỉ có PR `unknown` vào `capu_queue` nếu cập nhật dưới 48 giờ (đúng luật cũ), còn lại ra. Việc không tìm thấy link PR nào cũng theo luật 48 giờ này, `links` rỗng.
D5. Cách lấy trạng thái PR: cờ `--pr-state-file F` (JSON `{"phungrk/<repo>#<n>": "open|merged|closed|unknown"}`, thiếu khoá = `unknown`, dùng cho eval và chạy offline); không có cờ thì gọi GitHub REST `GET /repos/phungrk/<repo>/pulls/<n>` với biến môi trường `PR_READ_TOKEN` (`state: open` -> `open`; `closed` + `merged` -> `merged`; `closed` còn lại -> `closed`; thiếu token hoặc lỗi -> `unknown`); không token thì không gọi mạng.
D6. Workflow `publish-dashboard-data.yml` truyền secret `PR_READ_TOKEN` vào bước "Xuất dữ liệu". Secret do Capu đặt (Claude/agent không đặt thay). Chưa có secret thì mọi thứ chạy theo D4: số trên khối bằng luật cũ cho bậc B/C, nhưng dòng nào cũng ghi "chưa kiểm được PR".

### Giao diện (repo `phungrk/tohong-hq-dashboard`)
U1. **Số trên khối Capu** (`#nd_capu .n`) = số dòng của modal. Dòng gồm: mọi việc có `state: escalated` trong dữ liệu trang (kể cả cập nhật live), cộng mỗi phần tử `kind` `diff-b`/`merge-c` của `capu_queue` mà việc đó vẫn `state: done` trong dữ liệu trang. Chữ phụ dưới số giữ dạng `<a> leo thang · <b> diff hành vi chờ đọc`, b là số dòng `diff-b` + `merge-c`. Màu sáng của khối giữ nguyên (đỏ khi có leo thang, màu code khi chỉ có diff, tắt khi 0).
U2. Dữ liệu cũ **không có** `capu_queue` thì trang dùng luật cũ (leo thang + bậc B/C xong < 48h) cho cả số lẫn dòng; dòng bậc B/C khi đó không có link, ghi "chưa có link". Số trên khối vẫn bằng số dòng.
U3. **Mở:** bấm/chạm chữ số hay thân khối Capu, hoặc focus khối rồi nhấn Enter hay Space, mở modal `#capu-modal` (`role="dialog"`, `aria-modal="true"`, có tiêu đề "Việc chờ anh duyệt (n)"). Khối Capu là phần tử focus được (`tabindex=0`, `role="button"`, `aria-label` nói rõ có n việc chờ, bấm để xem). Chạm vào **nhân vật** Capu vẫn mở tóm tắt T-037 như cũ, không mở modal. Khối ở 0 vẫn mở được modal.
U4. **Dòng** (`[data-capu-row]`, thuộc tính `data-task`, `data-kind`): mã việc, tên việc, loại, bậc, link. Loại và nhãn: `escalated` -> "Leo thang - cần anh quyết"; `diff-b` -> "Đọc diff hành vi - bậc B"; `merge-c` -> "Duyệt và tự merge - bậc C". Link là `a[data-capu-link]`, văn bản = `label`, `href` = `url` trong `capu_queue`, mở tab mới (`target="_blank"`, `rel` có `noopener`). Leo thang không có phần tử `capu_queue` thì link tới thư mục `inbox/capu` (U4 không bao giờ để dòng không có chỗ bấm, trừ ca dưới). Dòng có `links` rỗng ghi "chưa có link", không có thẻ `a`. Link có `pr_state` `unknown` mang `data-pr-state="unknown"` và dòng ghi "chưa kiểm được PR". Việc có hai PR mở: một dòng, hai link theo thứ tự dữ liệu.
U5. **Thứ tự dòng:** leo thang trước, rồi bậc C, rồi bậc B; trong mỗi nhóm theo số việc tăng dần.
U6. **Rỗng:** không có dòng nào thì modal vẫn mở, có đúng một phần tử `[data-capu-empty]` với chữ chính xác "Không có việc nào chờ anh"; có dòng thì phần tử này không tồn tại.
U7. **Đóng:** nút X `#capu-modal-close` (vùng bấm >= 44x44px, `aria-label` "Đóng"), phím Esc, hoặc chạm vùng tối ngoài khung `[data-capu-panel]`. Chạm trong khung không đóng. Đóng xong focus trả về khối Capu. Trong chế độ phóng to bảng Mô hình: Esc lần một chỉ đóng modal, lần hai mới đóng phóng to (cùng tinh thần INV-027).
U8. **Bàn phím:** mở xong focus nằm trong modal; Tab/Shift+Tab xoay vòng trong modal, không ra ngoài.
U9. **iPhone 390px:** khung nằm trọn trong màn hình (không cuộn ngang trang), tên việc dài xuống dòng, link cao >= 32px, quá nhiều dòng thì khung tự cuộn dọc.
U10. Modal đang mở và dữ liệu làm mới (mỗi phút hoặc sự kiện live) thì danh sách, số và dòng "rỗng" cập nhật theo, modal không tự đóng.

## Ràng buộc (vòi)
- Repo: **hai repo**. (a) `phungrk/tohong-hq`: `scripts/export_dashboard.py`, `.github/workflows/publish-dashboard-data.yml`. (b) `phungrk/tohong-hq-dashboard`: `index.html`, `tests/`. Nhánh `t-076-modal-viec-cho-capu` ở cả hai. Vùng: `hq/dashboard`.
- Thứ tự triển khai: (a) trước (trang xử lý được dữ liệu cũ nhờ U2), rồi (b). Phần (a) chạm `scripts/` và `.github/` nên workflow sync mở PR cho Capu duyệt (CLAUDE.md); đề nghị Chief of Staff nâng bậc lên B vì chạm CI và secret (không hạ bậc sau này).
- Bất biến đã đọc: `_shared/` (INV-001 không secret trong repo: token chỉ qua secret/biến môi trường, eval không chứa token), `hq/dashboard/` INV-001..005 (xuất `product`, bộ lọc), `hq/dashboard/model/` INV-006 (không cuộn ngang 390px), INV-007 (Capu sáng khi escalated), INV-009 (khối sáng khi và chỉ khi số > 0, có ca bậc B < 48h không có `capu_queue`: U2 giữ ca đó xanh), INV-021/027 (phóng to, Esc từng lớp), INV-031 (không id trùng). Spec không vi phạm; U3 giữ nguyên hành vi chạm nhân vật của T-037. ADR liên quan: ADR-009 (mô hình cũ, đã thay bởi eval-gated), ADR-011 (sản phẩm/vùng, `capu_queue` không lọc theo bộ lọc sản phẩm: việc chờ Capu là của cả công ty, như bảng Đội ngũ), ADR-019 (cỡ mũi tên: không chạm).
- Kiến trúc / design system: trang tĩnh một file, không build; dùng biến màu và phông hiện có; modal không thêm thư viện. Tên selector ở trên là hợp đồng với eval, còn lại do Engineering chọn.
- Không chạm: payment, auth, DB, dữ liệu người dùng. Công khai: `capu_queue` làm lộ tên repo riêng tư và số PR cho ai xem trang (không lộ nội dung; link vô dụng với người không có quyền). Titles của việc vốn đã công khai.
- Bậc đề xuất: A theo brief (UI, eval phủ hết), nhưng xem ghi chú nâng bậc B ở trên.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Bấm số trên khối Capu mở `#capu-modal`; số dòng = số trên khối (mô hình có `capu_queue`, thiếu `capu_queue`, 1280 và 390px); thứ tự U5 | `cd /home/user/tohong-hq && node eval/T-076/check_1_mo_modal_so_khop.cjs` |
| 2 | Mỗi dòng có mã, tên, loại/bậc, link đúng: Decision Request (blob hoặc thư mục), PR (một hoặc hai), "chưa kiểm được PR", "chưa có link"; link https github.com/phungrk, tab mới, noopener | `cd /home/user/tohong-hq && node eval/T-076/check_2_dong_va_link.cjs` |
| 3 | Việc có mọi PR merged/closed, bậc A, chưa xong, PR unknown cũ > 48h không vào `capu_queue`; link Decision Request tìm đúng file; PR lấy từ sự kiện và từ file bàn giao; không token không giả trạng thái | `cd /home/user/tohong-hq && python3 eval/T-076/check_3_export_pr.py` |
| 4 | Đóng bằng X, Esc, chạm ngoài; chạm trong không đóng; focus vào/trả về/xoay vòng; 390px không tràn, nút X >= 44px, link >= 32px; Esc từng lớp khi phóng to | `cd /home/user/tohong-hq && node eval/T-076/check_4_dong_ban_phim_390.cjs` |
| 5 | Không có việc chờ: modal ghi đúng "Không có việc nào chờ anh"; có việc thì không có dòng đó | `cd /home/user/tohong-hq && node eval/T-076/check_5_rong.cjs` |
| 6 | Ca thật: xuất từ sổ cái thật với mọi PR merged thì khối Capu = đúng số việc escalated trên board (2026-11-06: T-072, T-074, không phải 7), link trỏ file có thật; đối chứng mọi PR mở thì việc B/C quay lại có link PR | `cd /home/user/tohong-hq && node eval/T-076/check_6_ca_that.cjs` |
| 7 | Bản công khai chỉ thêm `capu_queue` đúng khuôn (URL github phungrk), không rò detail/đường dẫn nội bộ/PR đã merge | `cd /home/user/tohong-hq && python3 eval/T-076/check_7_cong_khai.py` |

Ghi chú: eval 1, 2, 4, 5, 6 cần Playwright (`NODE_PATH` từ `npm root -g`) và d3 cục bộ (`D3=/đường/dẫn/d3.min.js`; tự tìm `/opt/npm-tools/...`); repo dashboard lấy từ `TOHONG_DASHBOARD_REPO` hoặc `/home/user/tohong-hq-dashboard`. Tiêu chí 3 của brief gốc ("không đếm PR đã merge/đóng") tách thành 3 (bước xuất) và 6 (ca thật); tiêu chí 4 gộp đóng/bàn phím/iPhone; 7 là tiêu chí thêm về an toàn dữ liệu công khai. Ca "bấm trên iPhone thật" không tự động hoá được ngoài mô phỏng 390px cảm ứng của Playwright: Engineering nên chụp ảnh vào `docs/screenshots/T-076/`.

## Bất biến đề xuất (tầng 2)
- **INV-P1 (hq/dashboard):** số trên khối Capu luôn bằng số dòng `[data-capu-row]` trong modal (kể cả 0 và ca dữ liệu cũ), ở 1280 và 390px. Gốc: eval 1.
- **INV-P2 (hq/dashboard):** `capu_queue` không bao giờ chứa việc mà mọi PR đã `merged`/`closed`, hay việc bậc A, hay việc chưa `escalated`/`done`; trạng thái PR không kiểm được phải ghi `unknown`, không giả. Gốc: eval 3, 6.
- **INV-P3 (hq/dashboard):** mọi link trong modal Capu là https github.com/phungrk/... mở tab mới với `noopener`; bản công khai của `dashboard.json` không chứa `detail`/`link` sự kiện hay đường dẫn máy. Gốc: eval 2, 7.

## Không làm
- Duyệt, merge hay đóng PR ngay trong dashboard; đổi luồng merge hay bậc A/B/C.
- Gọi GitHub API từ trình duyệt; đặt token vào repo hay vào trang.
- Thêm thông báo, âm thanh, hay đếm trên tiêu đề tab.
- Lọc `capu_queue` theo bộ lọc sản phẩm.
- Sửa tóm tắt nhân vật T-037 hay `esc`/`capuRead` ở chỗ khác ngoài khối Capu (vd bảng "Chờ Capu" trong KPI `k.capu` giữ nguyên).

## Câu hỏi mở
Anh có đặt secret `PR_READ_TOKEN` (fine-grained token chỉ đọc "Pull requests" trên `phungrk/tohong`, `tohong-front`, `tohong-back`) vào repo `tohong-hq` không? Có thì việc đã merge tự biến mất khỏi danh sách; chưa thì danh sách tạm theo luật cũ 48 giờ (không đúng cho PR đã merge) và mỗi dòng ghi "chưa kiểm được PR". Spec chạy được cả hai trường hợp, nên Engineering không bị chặn.
