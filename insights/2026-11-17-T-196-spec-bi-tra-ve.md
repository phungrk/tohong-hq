---
type: insight
task: T-196
from: insight
date: 2026-11-17
window: "2026-10-24 → 2026-11-17 (toàn bộ sổ cái)"
confidence: medium
---
# T-196 · Vì sao spec bị Spec Gate trả về: nhóm nguyên nhân, checklist cho product, kiểm tự động

(`templates/` không có mẫu báo cáo insight riêng; dùng cấu trúc báo cáo tuần: hiện tượng → nhóm → giả thuyết → đo.)

## 1. Kết luận (đọc phần này là đủ)

1. Sổ cái ghi **98 lần spec bị trả**, trên **72 việc** (71 trong 183 việc đã accept = 38,8%). Không có lỗi "code" trong số này: 91/91 defect có trường `kind` đều là `spec` (chỉ T-021-D2, thời reviewer, không có trường này).
2. Nguyên nhân không tập trung một chỗ. Gộp thành 5 họ (blocker đứng đầu của mỗi defect): **câu chữ** 33 (34%: nhiều cách hiểu 16, thiếu ca biên 16, "vd" 1), **spec lệch hiện trạng** 28 (29%: bất biến/ADR 12, bề mặt dùng chung 11, luật đang chạy 5), **eval** 22 (22%: eval hỏng 12, eval không đo 10), **mâu thuẫn nội bộ** 13 (13%), **ý định hai nghĩa** 2 (2%).
3. Nhóm "vd thay chữ chốt" chỉ có **1** lần (T-192). Giả thuyết ban đầu về "vd" không phải đòn bẩy lớn; nó là một ca riêng của nhóm "nhiều cách hiểu".
4. **Eval có mặt ở 35/98 lần trả** (làm blocker phụ khi chữ mơ hồ: eval không phân biệt được các cách hiểu) và 22 lần là blocker chính. Nếu tính "có mặt", eval là yếu tố chung lớn nhất, ngang "nhiều cách hiểu" (35).
5. **Lần trả thứ 2 trở đi của cùng việc: 26/98 (27%)**, trong đó 8 lần là eval của bản sửa vẫn hỏng, 4 là ca biên. Bản v2 thường sai ở **phần mới thêm** (spec chưa từng chạy eval trên bản cài thử).
6. Hướng dẫn hiện có trong `.claude/agents/product.md` mục 6 đã nói "với mỗi câu nghĩ ba cách cài đặt" và mục 4 "đọc bất biến vùng"; vậy mà tỷ lệ qua Spec Gate lần đầu là **13/77 = 16,9%** (KPI ghi ≥ 70%). Lời nhắc không đủ: cần **sản phẩm kiểm được** trong spec (bảng ba cách cài, bảng ca biên, danh sách INV, bản thử chạy xanh).
7. Ước tính checklist 10 mục nếu làm đúng chặn được khoảng **35/98** lần trả (khoảng 25–45), tự tin thấp–vừa (xem mục 5). Ba kiểm tự động đáng làm trước: self-test eval (bản đúng xanh, bản sai đỏ), preflight bất biến/INV, bảng đóng defect khi respec.

## 2. Số của Chief so với số đếm lại

| Chief báo | Đếm lại | Lệch | Cách đếm (mục 7) |
|---|---|---|---|
| 183 việc accept | 183 | không | C1 |
| 95 lần spec rework | **93** `respec` khác nhau; **96** `rejected` state spec/escalated khác nhau (98 dòng thô); **98** lần trả nếu tính cả 2 defect không có sự kiện `rejected` | có (xem dưới) | C2, C3 |
| 39% spec rework | 71/183 = **38,8%** | không | C4 |
| 42% có rework thật | spec ∪ code = 73/183 = **39,9%** | −2 điểm | C5 |
| code rework 4% | `rejected` state `rework`: 5 sự kiện, 3 việc (T-004, T-014, T-021), trong đó 2 việc accept = **1,1%**. Không tái lập được 4%. Nếu tính việc có `respec` về `engineering` (spec lệch do Code Gate bắt): 8 việc = 4,4%. Đoán (tự tin 40%) đó là nguồn con số 4% | có | C5, C6 |
| 77% việc product bị trả ≥1 | tuỳ mẫu số: 65/81 (có handoff của product) = **80%**; 64/89 (giao cho product) = 72%; 64/77 (tới Spec critic, qua `handoff` tới `spec-critic`) = 83% | 77% không khớp mẫu số nào; đều trong 72–83% | C7 |
| Engineering 11% | không đếm (ngoài phạm vi) | | |

Ba lệch cần Chief biết, vì chúng làm sai mọi con số đếm từ sổ cái:

- **Sổ cái có 32 dòng trùng nguyên văn** (1564 dòng thô → 1532 dòng khác nhau). Trùng ở `rejected` 2, `respec` 2, `handoff` 8, `evalplus` 5, `accepted` 2... Ví dụ `rejected` T-087-D1, T-087-D2 và `respec` của T-087 đều xuất hiện hai lần. Đếm thô thổi phồng `respec` 95 → thật 93.
- **22 mã `E-xxxx` bị dùng lại cho sự kiện khác nhau** (ví dụ E-0814 là `rejected` của T-102 ở dòng 814 và `requested` của T-106 ở dòng 836), nên `id` không dùng làm khoá duy nhất được. Đoán (tự tin 60%): hai phiên cùng ghi sổ rồi rebase/đồng bộ (`sync-ledger`) gộp lại.
- **2 defect spec không có sự kiện `rejected`**: `handoffs/T-145-D2.md` (spec-critic, blocker, kind spec) và `handoffs/T-108-D1.md`. Heuristic chỉ đếm `rejected` sẽ bỏ sót chúng. Báo cáo này đếm theo defect + sự kiện.
- Heuristic code/spec của Chief **đúng** với dữ liệu: 91/91 defect có `kind` đều `spec`; mọi `rejected` từ `spec-critic` đều vào state `spec` (hoặc `escalated` khi tự leo thang). Chỗ cần lưu ý: "spec" ở đây gồm cả **eval do product viết** (22/98 = 22% là lỗi eval), và **7/98 lần trả đến từ adversary sau khi code đã làm xong** (T-078, T-108, T-112, T-144, T-163, T-166, T-174): đắt nhất vì Engineering đã làm.

## 3. Nhóm nguyên nhân

Cách gán: mỗi defect có một nhãn **chính** (blocker đứng đầu trong defect) và 0–3 nhãn **phụ** (blocker/lỗi khác trong cùng defect). Tôi đọc phần mở đầu của từng defect (≤650 ký tự đầu, đọc đầy đủ các tiêu đề B1/B2/...), không đọc toàn văn 655 KB. Gán bằng tay, không phải máy; mức tự tin về nhãn chính ~75% (ranh giới AMB/EDGE/INT/EVG mờ, xem mục 6). Danh sách từng dòng ở Phụ lục A.

| Nhóm | Mô tả | Chính | Có mặt (chính+phụ) |
|---|---|---|---|
| AMB | Câu hành vi cài được ≥2 cách cho kết quả người dùng thấy khác nhau | 16 | 35 |
| EDGE | Thiếu ca biên (0, âm, rỗng, nửa đúng, thiếu dữ liệu, ít hơn k, tab/CRLF, chạy lặp/song song, trạng thái sau khi áp) | 16 | 25 |
| INT | Mâu thuẫn nội bộ: mục–mục, spec–eval của chính nó, bản sửa sót chỗ khác | 13 | 18 |
| INV | Trích sai/bỏ sót bất biến hoặc ADR (gồm vùng anh em; eval của spec làm đỏ INV tầng 2) | 12 | 16 |
| EVB | Eval hỏng: đỏ với bản cài đúng spec (hoặc đúng theo cách tự nhiên nhất) | 12 | 15 |
| SHR | Đụng hàm/dữ liệu/bề mặt dùng chung mà spec không nói | 11 | 19 |
| EVG | Hành vi spec hứa mà eval không đo (cài sai vẫn xanh) | 10 | 35 |
| RUN | Mâu thuẫn luật/code/dữ liệu đang chạy | 5 | 17 |
| CAP | Ý định của Capu hai nghĩa / spec chọn thay Capu | 2 | 5 |
| VD | Chữ "vd" biến chữ bắt buộc thành ví dụ | 1 | 1 |
| | Tổng | 98 | |

So với nhóm gợi ý ban đầu: giữ nguyên "vd", "ca biên", "trích sai bất biến", "bề mặt dùng chung", "luật đang chạy", "mâu thuẫn nội bộ"; **tách "eval" làm hai** (không đo 10 / hỏng 12) vì cách sửa khác nhau; **thêm CAP** (ý định hai nghĩa, 2 lần: T-072-D1 và T-074-D1, Spec Writer tự chọn nghĩa thay Capu; cả hai cuối cùng phải leo lên Capu quyết, E-0539 và E-0551). Mọi thứ đều có ít nhất 1 ca, không nhóm nào trống.

### Ví dụ cụ thể (nhóm lớn)

- **AMB** (16). T-043-D1: "Hai dòng có cùng cặp đôi mới nhất ... theo email chuẩn hoá" có ba cách cài, người dùng thấy ba thứ tự. T-039-D1: "dài 6 đến 10px ... giống nhau mọi viewport" cho ba kích thước khác hẳn ở 390px. T-076-D1: "việc chờ anh duyệt" có ba cách hiểu, 5 Decision Request thật trong `inbox/capu/` khớp khác nhau.
- **EDGE** (16). T-187-D1: `Math.round(x*10)/10` rồi "giữ dấu trừ" không nói làm tròn số có dấu hay trị tuyệt đối; `Math.round` làm tròn nửa về +∞ nên mọi số âm kiểu x,x5 ra chữ khác nhau. T-179-D1: nhãn "Theo dự toán {D}tr" chỉ đo D nguyên; không ca D=0, K thiếu, 39,5, đọc số lỗi. T-099-D1: "khoảng trắng" không nói tab/CRLF. T-056-D1: nhánh "chênh = 0" chưa có lối ra.
- **INT** (13). T-032-D2: bảng quyết định đã đóng D1 nhưng "câu thay thế số 1" còn nguyên bản cũ. T-058-D1: mục 4 lấy mẫu từ "việc cần tải" gồm entry `failed`, mâu thuẫn Giả thuyết. T-102-D1: phương án rút gọn 6 lượt mâu thuẫn eval đã khoá.
- **INV** (12). T-194-D1: H5 bỏ qua lần ghi INV-003 cho phép khi mở màn. T-078 (adversary, spec T-076): trích "ADR-011 (capu_queue không lọc theo bộ lọc sản phẩm)" nhưng ADR-011 không có câu đó, và trái quyết định T-041 mục 1. T-153-D1: mọi cách cài Hành vi 1 làm đỏ INV-006 của vùng anh em `planner/admin/members`; Code Gate chỉ chạy `_shared` và vùng tổ tiên nên lỗi lọt. T-087-D2: Bước 2 trái hq/dashboard INV-005.
- **EVB** (12). T-061-D2: hai eval đỏ ổn định với mọi cài đặt đúng spec. T-058-D2: `pr.stdout` là luồng, eval chết `AttributeError`. T-167-D2: regex phân biệt hoa thường trong khi khuôn spec mở bằng "Chưa". T-053-D2: bộ bỏ comment nuốt cả `require`. T-092-D1: eval đòi `name` đúng 141 ký tự; T-096-D2: eval chặn `name` > 141 trong khi spec cho phép tới 150.
- **SHR** (11). T-164-D2: thêm nguồn số khách thứ hai nhưng không nói ba chỗ khác dùng số khách. T-172-D1: lịch sử hội thoại (30 tin gần nhất) do chính AI viết trước T-172 vẫn mang nhãn giá. T-144 (adversary): lệnh `gcloud storage rm -r gs://wedding-planner-vendors` xoá bucket dùng chung với `scrape-vendors.yml`. T-169-D1: đặt `total_tr` mà không nói `allocated_tr`.
- **EVG** (10). T-188-D1: `build()` luôn đặt `VITE_ADMIN_OPEN: ''` nên không build nào có biến vắng mặt; hành vi "cờ vắng thì tắt" không được đo. T-066-D1: bản P2 sai do critic dựng trong scratchpad vẫn xanh trên eval cấu trúc DOM. T-177-D1: ellipsis cắt mất con số vẫn qua.
- **RUN** (5). T-194-D2: H5 v2 mâu thuẫn luật đang chạy "chỉnh Tuần trăng mật thì rút chênh từ Dự phòng". T-102-D2: tiêu chí 9 lấy ngân sách từ frontmatter `budget`, mà `task.py` không có lệnh ghi `budget` sau `new`.
- **VD** (1). T-192-D1: "chỉ ghi đầu trên, vd '5tr'" cài được thành "5tr", "Đến 5tr" hoặc "Từ 5tr" (nghĩa ngược).

### Danh sách defect theo nhóm chính

**AMB** (16): `handoffs/T-021-D2.md`, `handoffs/T-037-D1.md`, `handoffs/T-039-D1.md`, `handoffs/T-043-D1.md`, `handoffs/T-051-D1.md`, `handoffs/T-051-D2.md`, `handoffs/T-054-D1.md`, `handoffs/T-072-D2.md`, `handoffs/T-076-D1.md`, `handoffs/T-079-D1.md`, `handoffs/T-106-D1.md`, `handoffs/T-108-D1.md`, `handoffs/T-122-D1.md`, `handoffs/T-126-D1.md`, `handoffs/T-140-D1.md`, `handoffs/T-152-D1.md`

**EDGE** (16): `handoffs/T-056-D1.md`, `handoffs/T-072-D3.md`, `handoffs/T-074-D2.md`, `handoffs/T-094-D1.md`, `handoffs/T-096-D1.md`, `handoffs/T-099-D1.md`, `handoffs/T-101-D1.md`, `handoffs/T-111-D2.md`, `handoffs/T-120-D1.md`, `handoffs/T-129-D1.md`, `handoffs/T-136-D2.md`, `handoffs/T-167-D1.md`, `handoffs/T-170-D1.md`, T-174 (E-1417), `handoffs/T-179-D1.md`, `handoffs/T-187-D1.md`

**INT** (13): `handoffs/T-028-D1.md`, `handoffs/T-032-D1.md`, `handoffs/T-032-D2.md`, `handoffs/T-058-D1.md`, `handoffs/T-065-D1.md`, `handoffs/T-073-D1.md`, `handoffs/T-076-D2.md`, `handoffs/T-087-D1.md`, `handoffs/T-077-D1.md`, `handoffs/T-102-D1.md`, T-108 (E-0889), `handoffs/T-115-D1.md`, `handoffs/T-162-D1.md`

**INV** (12): `handoffs/T-035-D1.md`, `handoffs/T-041-D1.md`, T-078 (E-0595), `handoffs/T-087-D2.md`, `handoffs/T-110-D1.md`, `handoffs/T-111-D1.md`, `handoffs/T-124-D1.md`, `handoffs/T-145-D1.md`, `handoffs/T-153-D1.md`, `handoffs/T-163-D1.md`, `handoffs/T-169-D2.md`, `handoffs/T-194-D1.md`

**EVB** (12): `handoffs/T-054-D2.md`, `handoffs/T-061-D2.md`, `handoffs/T-058-D2.md`, `handoffs/T-053-D2.md`, `handoffs/T-076-D3.md`, `handoffs/T-092-D1.md`, `handoffs/T-096-D2.md`, T-112 (E-0926), `handoffs/T-145-D2.md`, `handoffs/T-167-D2.md`, T-166 (E-1349), `handoffs/T-185-D1.md`

**SHR** (11): `handoffs/T-045-D1.md`, `handoffs/T-083-D1.md`, `handoffs/T-135-D2.md`, T-144 (E-1172), `handoffs/T-147-D1.md`, `handoffs/T-159-D1.md`, `handoffs/T-164-D1.md`, `handoffs/T-164-D2.md`, `handoffs/T-171-D1.md`, `handoffs/T-169-D1.md`, `handoffs/T-172-D1.md`

**EVG** (10): `handoffs/T-027-D1.md`, `handoffs/T-045-D2.md`, `handoffs/T-047-D1.md`, `handoffs/T-048-D1.md`, `handoffs/T-066-D1.md`, `handoffs/T-053-D1.md`, `handoffs/T-106-D2.md`, `handoffs/T-136-D1.md`, `handoffs/T-177-D1.md`, `handoffs/T-188-D1.md`

**RUN** (5): `handoffs/T-061-D1.md`, `handoffs/T-102-D2.md`, `handoffs/T-129-D2.md`, `handoffs/T-135-D1.md`, `handoffs/T-194-D2.md`

**CAP** (2): `handoffs/T-072-D1.md`, `handoffs/T-074-D1.md`

**VD** (1): `handoffs/T-192-D1.md`

## 4. Theo thời gian, theo vùng, theo vòng

**Theo tuần** (ISO, ngày sự kiện trả; số việc tới Spec critic lần đầu / số bị trả từ Spec critic):

| Tuần | Lần trả | Câu chữ | Spec lệch hiện trạng | Eval | Nội bộ | Ý định | Việc tới Spec critic / bị trả |
|---|---|---|---|---|---|---|---|
| 44 (30/10–01/11) | 6 | 1 | 1 | 1 | 3 | 0 | 6 / 4 |
| 45 (02–08/11) | 52 | 19 | 9 | 14 | 8 | 2 | 37 / 32 |
| 46 (09–15/11) | 34 | 11 | 16 | 5 | 2 | 0 | 28 / 23 |
| 47 (16–17/11, chưa đủ tuần) | 6 | 2 | 2 | 2 | 0 | 0 | 6 / 5 |

Quan sát: tỷ lệ bị trả không giảm theo thời gian (tuần 45: 32/37 = 86%, tuần 46: 23/28 = 82%). Họ "eval" giảm (14 → 5) còn họ "spec lệch hiện trạng" tăng (9 → 16), cùng lúc khối lượng chuyển từ dashboard/UI sang `planner/vendor` và chat/ngân sách (nhiều bề mặt chung hơn). Đoán (tự tin 50%): đó là hiệu ứng cơ cấu việc, không phải học được. Cỡ mẫu tuần 44 và 47 quá nhỏ để kết luận.

**Theo vùng** (`area` của việc): `planner/vendor` 42 lần trả (29 việc tới critic, 24 bị trả), `planner/front` 16 (14/12), `hq/dashboard` 15 (12/9), `planner/admin` 7, `dashboard/model` 6, `hq/ledger` 5. Tỷ lệ việc bị trả cao đều ở mọi vùng (75–100% trong vùng ≥ 4 việc tới critic). Cơ cấu họ nguyên nhân giống nhau giữa `planner` (69 lần) và `hq` (20 lần): câu chữ 33%/30%, hiện trạng 30%/30%, eval 23%/25%, nội bộ 10%/15%. **Theo vùng không phân biệt được**; không đề xuất checklist riêng theo vùng.

**Theo vòng:** 26 lần trả là lần thứ 2+ của cùng việc (98 − 72), tức 27% công trả là do bản sửa chưa đóng hết hoặc gây lỗi mới. Nhóm của 26 lần này (theo file `-D2`, `-D3`): EVB 8, EDGE 4, AMB 3, RUN 3, INT 2, EVG 2, INV 2, SHR 2. Hai việc bị trả 3 lần: T-072 và T-076; cả hai đều leo `escalated` sau 2 lần. 22 việc bị trả 2 lần, 48 việc 1 lần.

**Theo nguồn trả:** spec-critic 90, adversary 7 (sau khi code xong), reviewer 1 (T-021, thời trước adversary).

**Chi phí đo được:** trung vị 13 phút giữa handoff của product và lần handoff/respec kế (86 vòng ghi được), tổng ≈ 34 giờ đồng hồ. Chi phí token từng vòng chưa tách được từ sổ cái (xem mục 8).

## 5. Checklist đề xuất cho `.claude/agents/product.md` (≤10 mục)

Đặt trước bước 7 (bàn giao). Mỗi mục là câu hỏi tự kiểm; trả lời **bằng tệp có thể kiểm** (bảng trong spec hoặc dòng trong handoff), không bằng lời. Cột "chặn" đếm từ Phụ lục A: **chính** = số lần trả mà blocker đứng đầu thuộc nhóm đó; **có mặt** = cả blocker phụ; **trọn** = số lần trả chỉ có đúng nhóm đó (riêng mục này chặn được cả lần trả, 30 lần trả chỉ có một nhãn).

| # | Câu hỏi tự kiểm trước handoff | Nhóm | chính / có mặt / trọn |
|---|---|---|---|
| 1 | Với mỗi câu hành vi, tôi đã viết **ít nhất hai cách cài khác nhau** và chỉ ra chúng cho người dùng thấy khác nhau ở đâu chưa? Câu đã **chốt đúng một** cách bằng chữ/số/bảng (không "vd", "khoảng", "hoặc", "như cũ", "thường") và eval có phân biệt được hai cách chưa? | AMB, VD | 17 / 35 / 2 |
| 2 | Mỗi đầu vào của câu hành vi đã có hàng cho: 0 và âm, rỗng/null/thiếu một trong hai, nửa đúng (x,5), quá dài/ngắn, ký tự lạ (tab, CRLF, xuống dòng), ít hơn k phần tử, chạy lại hoặc chạy song song, trạng thái sau khi đã áp, lượt hỏi tiếp? Ô không áp dụng ghi "N/A vì …". | EDGE | 16 / 25 / 5 |
| 3 | Mỗi tiêu chí có **đúng một** eval đo thứ **người dùng thấy** (chữ, vị trí, file/dữ liệu thật) chứ không đo cấu trúc DOM, tên component, regex trên mã nguồn, hay giá trị do chính code tự khai? Có ít nhất một **bản cài sai nhưng giống** (đột biến) làm eval đỏ không? | EVG | 10 / 35 / 3 |
| 4 | Tôi đã dựng (ở scratchpad) một bản cài đúng chữ spec theo cách **tự nhiên nhất** và thấy mọi eval **xanh, hai lần liên tiếp**, và một bản theo cách thứ hai cũng xanh? Helper dùng chung của eval (clickNode, bộ bỏ comment, so khớp chữ/hoa-thường, ngưỡng ký tự) đã thử trên ca thật chưa? | EVB | 12 / 15 / 9 |
| 5 | Đã liệt kê INV và ADR của vùng, vùng cha **và vùng anh em** (grep tên hàm/trường/endpoint spec chạm trong `eval/invariants/<sản phẩm>/**`), trích **nguyên văn** câu bất biến chạm tới, và chạy gate xem eval mới của spec có làm đỏ bất biến nào không? | INV | 12 / 16 / 4 |
| 6 | Với mỗi hàm/trường/endpoint/file/bucket/workflow/prompt spec đổi, đã grep mọi nơi dùng (3 repo + workflow + kho dùng chung) và ghi từng nơi "đổi/không đổi + eval nào"? Đã tìm mọi chỗ người dùng thấy giá trị suy ra (chat, lịch sử hội thoại, câu AI, thẻ, báo cáo, CSV)? | SHR | 11 / 19 / 4 |
| 7 | Mỗi câu "luôn / không bao giờ / mọi / vẫn như cũ" và mỗi giả định về dữ liệu hay luật đang chạy đã được **chạy một lệnh** trên main hoặc dữ liệu thật, kết quả dán vào mục Bằng chứng (hoặc ghi "chưa chạy, giả định, tự tin N%")? | RUN | 5 / 17 / 1 |
| 8 | Sau khi viết, đã lập bảng chéo mục hành vi × tiêu chí × eval × ràng buộc × giả thuyết và grep mỗi số/thuật ngữ cốt lõi ở mọi chỗ nhắc lại chưa? | INT | 13 / 18 / 2 |
| 9 | Câu ý định của Capu đã chép nguyên văn; chỗ nào ý định có hai nghĩa, hay phải chọn giá trị Capu chưa quyết, đã thành **Câu hỏi mở** (không tự chọn)? Spec có đổi thang đo của câu gốc không (vd tỉ lệ trùng → precision)? | CAP | 2 / 5 / 0 |
| 10 | (Chỉ khi respec) Mỗi lỗi của defect cũ có một dòng "đã đóng bằng câu/eval nào"? Đã chạy lại **toàn bộ** eval trên bản thử và soi riêng phần **mới thêm** ở v2? Đã tìm lỗi cùng loại ở chỗ khác chưa? | vòng lặp (26 lần trả thứ 2+) | EVB 8, EDGE 4, AMB 3, RUN 3 |

**Ước số lần chặn được.** Cận trên (mọi mục làm hoàn hảo, mọi blocker bị bắt) là 98. Thực tế một lần trả chỉ tránh được khi **mọi** blocker trong defect bị bắt; 68/98 lần trả có ≥2 nhãn. Ước của tôi: 30 lần "trọn" × 0,7 + 68 lần nhiều nhãn × 0,2 ≈ **35 (khoảng 25–45)**, tức đưa tỷ lệ qua cổng lần đầu từ 17% lên khoảng 35–50%. Hệ số 0,7/0,2 là đoán (tự tin 35%); chưa có cách kiểm trước khi áp dụng.

Mục có lợi suất cao nhất theo "trọn": **4** (9), **2** (5), **5** và **6** (4 mỗi mục). Mục 3 ít "trọn" nhưng có mặt ở 35 lần: nó là mắt xích hay hỏng khi chữ mơ hồ.

Đề xuất sửa kèm cho Chief đưa qua PR (không tự sửa): (a) `product.md` mục 6 hiện nói "Chạy gate để chắc eval chạy được (đỏ là bình thường, ERROR là không)": thêm "và bản thử đúng spec ra xanh"; (b) `templates/spec.md` dòng "Bất biến đã đọc: _shared + mọi cấp cha": thêm "và vùng anh em có từ khoá chung"; thêm hai bảng ngắn "Ba cách cài / chốt" và "Ca biên"; (c) cổng `gate.py` hiện chỉ chạy `_shared` + tổ tiên của `area` (T-153-D1 và T-135-D1 M4 cùng chỉ ra), cân nhắc chạy cả bất biến vùng anh em có từ khoá chung (không thuộc phạm vi T-196, ghi để Chief xét).

## 6. Kiểm tự động đề xuất

Không kiểm nào thay được chấm tay; mỗi kiểm dưới đây bắt một **dấu vết** của nhóm lỗi. Cách đo chung: chạy thử ngược (back-test) trên các spec v1 của 72 việc đã bị trả; cần lịch sử git của `products/` và `eval/`, tôi không chạy git theo yêu cầu, nên **chưa back-test**. Chief hoặc Engineering chạy được.

| # | Kiểm (đề xuất tên) | Làm gì | Nhóm | Cách đo | Kỳ vọng (đoán) |
|---|---|---|---|---|---|
| K1 | `scripts/eval_selftest.py T-xxx` | Mỗi `eval/T-xxx/` có `refs/ok/` (mô tả bản cài hoặc fixture đúng) và ≥1 `refs/bad-*`; chạy eval: ok phải xanh hai lần, bad phải đỏ. Với eval đọc mã nguồn bằng regex/`re.sub` thì bắt buộc có selftest hai mẫu | EVB, EVG | Số lần trả nhóm EVB+EVG / 98 (baseline 22, 22%) và `% eval có selftest` | 10–14 lần trả tránh được (EVB 9 trọn + EVG 3 trọn + một phần có mặt); tự tin 45%. Chi phí cao với việc đa repo (cần dựng bản thử), nên bắt buộc có thể chỉ cho bậc B/C |
| K2 | `scripts/spec_preflight.py T-xxx` (phần INV) | (i) mọi `INV-`/`ADR-` trong spec phải tồn tại và câu trích đặt trong dấu ngoặc phải khớp văn bản gốc; (ii) rút từ khoá từ các đoạn mã (`` `…` ``) trong spec rồi grep `eval/invariants/<sản phẩm>/**`, in INV chưa được liệt kê ở "Bất biến đã đọc" | INV | Số lần trả nhóm INV (baseline 12, 12%); số INV cảnh báo mỗi spec / số được xác nhận là thật | 4–7 lần tránh được (T-078 trích sai ADR-011 và T-153 INV-006 vùng anh em đều là ca máy bắt được); tự tin 55% |
| K3 | `scripts/spec_lint.py` | Trong khối "Hành vi": cấm/cảnh báo `\bvd\b`, "ví dụ", "chẳng hạn", "khoảng", "tương tự", "v.v.", "…", "như hôm nay/như cũ" (không kèm đường dẫn), "hoặc" không kèm bảng; mỗi hành vi phải có ≥1 con số, chữ trích nguyên văn hoặc bảng | AMB, VD | Số cảnh báo/spec; precision = cảnh báo dẫn tới defect/cảnh báo (back-test); số lần trả AMB (baseline 16) | **Thấp**: 1 ca VD chắc chắn + vài ca AMB; ≤5 lần tránh được. Chỉ đáng làm vì rẻ (tự tin 60% về con số ≤5). Tương quan phụ: `vd` có trong 37/63 file spec của việc bị trả nhưng 2/15 file spec của việc không bị trả (bản cuối trong `products/`, đếm `\bvd\b`; mẫu nhỏ, chỉ là dấu hiệu) |
| K4 | `task.py respec` kiểm bảng đóng | Từ chối `respec` nếu file handoff không có dòng "D<n>.<m> → đóng bằng …" cho mỗi mục B/C trong defect liền trước; in cảnh báo nếu phần "mới thêm ở v2" chưa có eval | vòng lặp | Số lần trả thứ 2+ (baseline 26, 27% của 98) | 8–12 lần tránh được; tự tin 40%. Cần sửa `scripts/task.py` (ngoài phạm vi insight) |
| K5 | Kiểm tính toàn vẹn sổ cái | (a) không có hai dòng giống nhau; (b) `id` duy nhất; (c) mỗi `handoffs/*-D*.md` kind spec có sự kiện `rejected` cùng đường dẫn | đo lường | Dòng trùng (baseline 32), id dùng lại (22), defect mồ côi (2) → 0 | Không giảm lần trả; làm số đếm đúng. Nên làm trước khi dùng bất kỳ metric nào bên dưới |
| K6 | Bảng "Ca biên" bắt buộc trong spec | Script chỉ kiểm bảng có đủ hàng/cột và không ô trống | EDGE | Số lần trả EDGE (baseline 16) | Hình thức, dễ làm cho có; chỉ đáng làm kèm mục 2 trong checklist. Tự tin 30% về hiệu quả |

K1 và K2 là hai kiểm đáng làm trước (nhắm nhóm lớn có dấu vết máy đọc được). K3 rẻ nhưng hiệu quả thấp. Với nhóm AMB/EDGE/INT/SHR (45% lần trả) không có kiểm tự động đáng tin; cách giảm là mục 1, 2, 6, 8 của checklist, nên Spec critic vẫn phải là cổng.

## 7. Metric theo dõi sau khi áp dụng

Đo từ sổ cái **sau khi K5 làm sạch** (hoặc dedupe dòng như ở C2). Baseline = từ 24/10 đến 17/11.

| Metric | Định nghĩa | Baseline | Ngưỡng mong đợi (đoán) |
|---|---|---|---|
| M1 Qua Spec Gate lần đầu | số việc có `handoff` tới `spec-critic` mà **không** có defect spec-critic ở lần chấm đầu / số việc có `handoff` tới `spec-critic` (tuần theo ngày handoff đầu) | **13/77 = 16,9%** (tuần 44: 2/6, 45: 5/37, 46: 5/28, 47: 1/6) | sau 2 tuần (≥ 20 việc) ≥ 30%; sau 4–6 tuần ≥ 50%; KPI cũ 70% chưa thực tế với bản đồ nguyên nhân này |
| M2 Lần trả / việc | tổng lần trả (spec-critic + adversary) / số việc tới critic | 98/77 = 1,27 | ≤ 0,8 rồi ≤ 0,5 |
| M3 Tỷ lệ lần trả thứ 2+ | lần trả thứ 2+ của cùng việc / tổng lần trả | 26/98 = 27% | ≤ 15% (K4 + mục 10) |
| M4 Spec lệch bắt ở Code Gate | defect spec do adversary ghi / tháng | 7 (cả đợt) | ≤ 1 mỗi 4 tuần (mỗi lần như vậy đắt nhất) |
| M5 Tỷ trọng lỗi eval | (EVB + EVG chính) / tổng lần trả | 22/98 = 22% | ≤ 8% |
| M6 Số việc nhãn `INV` | lần trả có nhãn INV chính | 12 | ≤ 3 mỗi 20 việc |

**Chỉ số bảo vệ** (để không dồn lỗi sang chỗ khác): (a) tỷ lệ việc có `evalplus` không tăng (baseline 52/183 = 28% việc accept); (b) thời gian từ giao việc tới handoff đầu của product không tăng quá 30% (baseline chưa tính riêng; xem mục 8); (c) số bất biến mới rút vào bể mỗi spec qua cổng không giảm (checklist không được làm spec nghèo đi); (d) số `minor` do critic ghi không tăng đột biến (dấu hiệu critic chuyển từ bắt lỗi sang soi chi tiết).

## 8. Chỗ đoán, chưa đo được, và thứ nên đo thêm

- **Nhãn gán tay** (mục 3): đọc phần đầu defect; ranh giới AMB/EDGE/INT/EVG mờ (ví dụ T-087-D1 gán INT nhưng cũng là EDGE; T-077-D1 gán INT nhưng là một ca eval-vs-spec). Nếu Capu cần số chính xác thêm một người chấm độc lập 20 ca ngẫu nhiên và tính độ đồng thuận; tự tin vào xếp **họ** (câu chữ / hiện trạng / eval / nội bộ) 80%, vào xếp **nhóm con** 65–70%.
- **Ước 35/98** (mục 5) là đoán có cấu trúc, không phải đo; xem hệ số.
- **Nguyên nhân sâu chưa kiểm**: tôi không biết Product Writer đã làm "ba cách cài" trong đầu hay không (không có dấu vết). Đề xuất đo: yêu cầu spec ghi bảng "ba cách cài" (checklist mục 1); sau 2 tuần so sánh số AMB.
- **Chưa đo được chi phí token/giờ của mỗi vòng rework**: sổ cái có trường `cost` nhưng `cost` chỉ ghi khoản ngoài token và chi phí do hook; không tách theo vòng. Đề xuất đo thêm: ghi `cost` theo `task` × `round` vào `ledger/events.jsonl` lúc `rejected`/`respec`, để biết một lần trả đắt bao nhiêu và có đáng chặn bằng K1/K2 không.
- **Thời gian giữa các sự kiện** (trung vị 13 phút/vòng) có thể là thời gian ghi sổ cái, không phải thời gian làm việc; đừng dùng làm chi phí.
- **Một thứ nên đo thêm** (theo định dạng báo cáo tuần): ghi nguyên nhân (nhóm nhãn ở đây) ngay trong defect, thêm trường `cause:` vào `templates/defect.md`, để lần sau đếm bằng máy thay vì đọc lại 98 defect. Đề xuất cho Chief đưa qua PR.
- **Hiệu quả theo vùng** không đo được (mẫu nhỏ, cùng cơ cấu họ nguyên nhân).

## 9. Cách đếm (để chạy lại)

Mọi lệnh chạy ở gốc `tohong-hq`, chỉ đọc `ledger/events.jsonl`, `board/`, `handoffs/`. Python 3.

<details><summary>C1–C7</summary>

```python
import json, collections
seen=set(); ev=[]; dup=0
for l in open('ledger/events.jsonl'):
    if l in seen: dup+=1; continue          # C2: 1564 dòng thô, dup=32, còn 1532
    seen.add(l); ev.append(json.loads(l))
acc={e['task'] for e in ev if e['event']=='accepted'}                  # C1: 183
sr=[e for e in ev if e['event']=='rejected' and e['state'] in ('spec','escalated')]   # C3: 96 (thô 98)
st={e['task'] for e in sr}                                              # 72 việc, 71 trong acc (C4: 71/183)
respec=[e for e in ev if e['event']=='respec']                          # 93 (thô 95)
code={e['task'] for e in ev if e['event']=='rejected' and e['state']=='rework'}   # C5: T-004, T-014, T-021 ; &acc = 2
print(len((st|code)&acc)/len(acc))                                      # 73/183 = 39,9%
# C6: respec về engineering = 8 sự kiện
[e['task'] for e in ev if e['event']=='respec' and e['to']=='engineering']
# C7: mẫu số 77%
g={e['task'] for e in ev if e['event']=='handoff' and e['to']=='spec-critic'}   # 77 việc ; bị trả bởi spec-critic: len(g & {e['task'] for e in sr if e['from']=='spec-critic'}) = 64
ps={e['task'] for e in ev if e['event']=='handoff' and e['from']=='product'}     # 81 ; & st = 65
as_={e['task'] for e in ev if e['event']=='assigned' and e['to']=='product'}     # 89 ; & st = 64
```
Hai defect không có `rejected`: duyệt mọi `handoffs/T-*-D*.md` có `kind: spec`, đối chiếu với `link` của các `rejected`; thiếu T-145-D2 và T-108-D1 (ledger của T-145 chỉ có `rejected` D1 rồi `handoff` v3 "sửa D2"; T-108-D1 chữa spec T-106 v4 nhưng không có `rejected`; đoán, tự tin 60%: spec-critic ghi defect mà không chạy `task.py reject`).

Dòng id dùng lại: `collections.Counter(e['id'] for e in ev)` còn 22 id xuất hiện >1 lần sau khi bỏ dòng trùng. Số theo họ nguyên nhân: đếm cột "Chính" ở Phụ lục A.
</details>

Số "qua lần đầu" M1: `g` ở trên (77) trừ tập việc có defect của `spec-critic` (64) = 13; theo tuần ISO của `handoff` đầu tiên tới `spec-critic`.

Nhãn tay nằm ở Phụ lục A (cột Chính/Phụ), là dữ liệu gốc của mọi số ở mục 3–5.

## Phụ lục A. Nhãn cho từng lần bị trả (98 dòng)

Cột chính = nhóm của blocker đứng đầu; phụ = nhóm khác cùng có mặt. `*` = không có file defect (adversary ghi trong detail của sự kiện, hoặc file eval); `—` = không có sự kiện `rejected` trong sổ cái.

| # | Ngày | Việc | Nguồn | Defect / sự kiện | Chính | Phụ |
|---|---|---|---|---|---|---|
| 1 | 10-30 | T-021 | revie | handoffs/T-021-D2.md · E-0147 | AMB | EVG |
| 2 | 11-01 | T-028 | spec- | handoffs/T-028-D1.md · E-0189 | INT | AMB |
| 3 | 11-01 | T-027 | spec- | handoffs/T-027-D1.md · E-0190 | EVG | AMB |
| 4 | 11-01 | T-032 | spec- | handoffs/T-032-D1.md · E-0216 | INT | RUN |
| 5 | 11-01 | T-032 | spec- | handoffs/T-032-D2.md · E-0219 | INT |  |
| 6 | 11-01 | T-035 | spec- | handoffs/T-035-D1.md · E-0239 | INV | EVG |
| 7 | 11-02 | T-037 | spec- | handoffs/T-037-D1.md · E-0252 | AMB | INT,SHR |
| 8 | 11-02 | T-039 | spec- | handoffs/T-039-D1.md · E-0267 | AMB | EVG |
| 9 | 11-02 | T-041 | spec- | handoffs/T-041-D1.md · E-0283 | INV | SHR |
| 10 | 11-02 | T-043 | spec- | handoffs/T-043-D1.md · E-0298 | AMB | EVG |
| 11 | 11-03 | T-045 | spec- | handoffs/T-045-D1.md · E-0311 | SHR | RUN |
| 12 | 11-03 | T-045 | spec- | handoffs/T-045-D2.md · E-0314 | EVG | AMB |
| 13 | 11-03 | T-047 | spec- | handoffs/T-047-D1.md · E-0335 | EVG | AMB |
| 14 | 11-03 | T-048 | spec- | handoffs/T-048-D1.md · E-0336 | EVG | INV |
| 15 | 11-03 | T-051 | spec- | handoffs/T-051-D1.md · E-0363 | AMB | INT,EVG |
| 16 | 11-03 | T-051 | spec- | handoffs/T-051-D2.md · E-0366 | AMB |  |
| 17 | 11-04 | T-054 | spec- | handoffs/T-054-D1.md · E-0384 | AMB | INT |
| 18 | 11-04 | T-054 | spec- | handoffs/T-054-D2.md · E-0387 | EVB | EDGE |
| 19 | 11-04 | T-056 | spec- | handoffs/T-056-D1.md · E-0402 | EDGE | RUN |
| 20 | 11-04 | T-061 | spec- | handoffs/T-061-D1.md · E-0428 | RUN | EVB,AMB |
| 21 | 11-04 | T-061 | spec- | handoffs/T-061-D2.md · E-0431 | EVB |  |
| 22 | 11-05 | T-058 | spec- | handoffs/T-058-D1.md · E-0454 | INT | RUN |
| 23 | 11-05 | T-058 | spec- | handoffs/T-058-D2.md · E-0457 | EVB |  |
| 24 | 11-05 | T-065 | spec- | handoffs/T-065-D1.md · E-0475 | INT | AMB |
| 25 | 11-05 | T-066 | spec- | handoffs/T-066-D1.md · E-0484 | EVG |  |
| 26 | 11-06 | T-053 | spec- | handoffs/T-053-D1.md · E-0509 | EVG | EVB |
| 27 | 11-06 | T-053 | spec- | handoffs/T-053-D2.md · E-0512 | EVB | EVG |
| 28 | 11-06 | T-073 | spec- | handoffs/T-073-D1.md · E-0531 | INT | RUN |
| 29 | 11-06 | T-072 | spec- | handoffs/T-072-D1.md · E-0532 | CAP | INT |
| 30 | 11-06 | T-074 | spec- | handoffs/T-074-D1.md · E-0537 | CAP | AMB,EDGE |
| 31 | 11-06 | T-072 | spec- | handoffs/T-072-D2.md · E-0542 | AMB | EVG |
| 32 | 11-06 | T-072 | spec- | handoffs/T-072-D3.md · E-0550 | EDGE |  |
| 33 | 11-06 | T-076 | spec- | handoffs/T-076-D1.md · E-0569 | AMB | CAP,EVG |
| 34 | 11-06 | T-076 | spec- | handoffs/T-076-D2.md · E-0572 | INT |  |
| 35 | 11-06 | T-076 | spec- | handoffs/T-076-D3.md · E-0575 | EVB |  |
| 36 | 11-06 | T-078 | adver | (trong detail E-0595) · E-0595 | INV |  |
| 37 | 11-06 | T-074 | spec- | handoffs/T-074-D2.md · E-0612 | EDGE | RUN |
| 38 | 11-06 | T-079 | spec- | handoffs/T-079-D1.md · E-0616 | AMB | EVG |
| 39 | 11-06 | T-083 | spec- | handoffs/T-083-D1.md · E-0642 | SHR | AMB,CAP |
| 40 | 11-07 | T-087 | spec- | handoffs/T-087-D1.md · E-0676 | INT | EDGE |
| 41 | 11-07 | T-087 | spec- | handoffs/T-087-D2.md · E-0681 | INV |  |
| 42 | 11-07 | T-092 | spec- | handoffs/T-092-D1.md · E-0722 | EVB | AMB |
| 43 | 11-07 | T-094 | spec- | handoffs/T-094-D1.md · E-0757 | EDGE |  |
| 44 | 11-07 | T-077 | spec- | handoffs/T-077-D1.md · E-0769 | INT | EVB |
| 45 | 11-07 | T-096 | spec- | handoffs/T-096-D1.md · E-0773 | EDGE | EVG |
| 46 | 11-07 | T-096 | spec- | handoffs/T-096-D2.md · E-0786 | EVB |  |
| 47 | 11-07 | T-099 | spec- | handoffs/T-099-D1.md · E-0793 | EDGE | AMB |
| 48 | 11-08 | T-101 | spec- | handoffs/T-101-D1.md · E-0813 | EDGE | AMB,SHR |
| 49 | 11-08 | T-102 | spec- | handoffs/T-102-D1.md · E-0814 | INT | EVG |
| 50 | 11-08 | T-102 | spec- | handoffs/T-102-D2.md · E-0823 | RUN | AMB,EVG |
| 51 | 11-08 | T-106 | spec- | handoffs/T-106-D1.md · E-0828 | AMB | EVG |
| 52 | 11-08 | T-106 | spec- | handoffs/T-106-D2.md · E-0834 | EVG |  |
| 53 | 11-08 | T-108 | spec- | handoffs/T-108-D1.md · — | AMB | EDGE |
| 54 | 11-08 | T-108 | adver | eval/T-108/adv-06-khop-nham-dia-diem-conf-cao.py · E-0889 | INT | EDGE |
| 55 | 11-08 | T-110 | spec- | handoffs/T-110-D1.md · E-0908 | INV | INT,EDGE |
| 56 | 11-08 | T-111 | spec- | handoffs/T-111-D1.md · E-0916 | INV | RUN,AMB |
| 57 | 11-08 | T-111 | spec- | handoffs/T-111-D2.md · E-0920 | EDGE |  |
| 58 | 11-08 | T-112 | adver | eval/T-112/gate-latest.json · E-0926 | EVB |  |
| 59 | 11-09 | T-115 | spec- | handoffs/T-115-D1.md · E-0953 | INT | EVG |
| 60 | 11-10 | T-120 | spec- | handoffs/T-120-D1.md · E-0988 | EDGE | EVG |
| 61 | 11-11 | T-122 | spec- | handoffs/T-122-D1.md · E-1007 | AMB |  |
| 62 | 11-11 | T-124 | spec- | handoffs/T-124-D1.md · E-1024 | INV | EDGE,SHR |
| 63 | 11-11 | T-126 | spec- | handoffs/T-126-D1.md · E-1041 | AMB | EVG,EDGE |
| 64 | 11-12 | T-129 | spec- | handoffs/T-129-D1.md · E-1064 | EDGE | INV,EVG |
| 65 | 11-12 | T-129 | spec- | handoffs/T-129-D2.md · E-1075 | RUN | INV |
| 66 | 11-13 | T-136 | spec- | handoffs/T-136-D1.md · E-1117 | EVG | RUN,CAP,AMB |
| 67 | 11-13 | T-136 | spec- | handoffs/T-136-D2.md · E-1122 | EDGE |  |
| 68 | 11-13 | T-135 | spec- | handoffs/T-135-D1.md · E-1123 | RUN | EVG,SHR,AMB |
| 69 | 11-13 | T-135 | spec- | handoffs/T-135-D2.md · E-1137 | SHR | RUN |
| 70 | 11-13 | T-140 | spec- | handoffs/T-140-D1.md · E-1157 | AMB | SHR |
| 71 | 11-13 | T-144 | adver | (trong detail E-1172) · E-1172 | SHR | RUN |
| 72 | 11-13 | T-145 | spec- | handoffs/T-145-D1.md · E-1183 | INV | EVG |
| 73 | 11-13 | T-145 | spec- | handoffs/T-145-D2.md · — | EVB |  |
| 74 | 11-13 | T-147 | spec- | handoffs/T-147-D1.md · E-1200 | SHR | RUN |
| 75 | 11-14 | T-153 | spec- | handoffs/T-153-D1.md · E-1236 | INV | SHR |
| 76 | 11-14 | T-152 | spec- | handoffs/T-152-D1.md · E-1241 | AMB | INV |
| 77 | 11-14 | T-159 | spec- | handoffs/T-159-D1.md · E-1271 | SHR |  |
| 78 | 11-14 | T-162 | spec- | handoffs/T-162-D1.md · E-1291 | INT | EDGE,EVG |
| 79 | 11-14 | T-163 | adver | handoffs/T-163-D1.md · E-1298 | INV |  |
| 80 | 11-14 | T-164 | spec- | handoffs/T-164-D1.md · E-1308 | SHR |  |
| 81 | 11-14 | T-164 | spec- | handoffs/T-164-D2.md · E-1312 | SHR |  |
| 82 | 11-14 | T-167 | spec- | handoffs/T-167-D1.md · E-1337 | EDGE | EVG |
| 83 | 11-14 | T-167 | spec- | handoffs/T-167-D2.md · E-1340 | EVB |  |
| 84 | 11-14 | T-166 | adver | eval/T-166/adv-01-da-luu-cuon-toi-hang.sh · E-1349 | EVB |  |
| 85 | 11-15 | T-171 | spec- | handoffs/T-171-D1.md · E-1370 | SHR | AMB,EVG |
| 86 | 11-15 | T-169 | spec- | handoffs/T-169-D1.md · E-1371 | SHR | RUN |
| 87 | 11-15 | T-170 | spec- | handoffs/T-170-D1.md · E-1372 | EDGE | EVG |
| 88 | 11-15 | T-169 | spec- | handoffs/T-169-D2.md · E-1380 | INV |  |
| 89 | 11-15 | T-172 | spec- | handoffs/T-172-D1.md · E-1396 | SHR |  |
| 90 | 11-15 | T-174 | adver | (trong detail E-1417) · E-1417 | EDGE | SHR |
| 91 | 11-15 | T-177 | spec- | handoffs/T-177-D1.md · E-1444 | EVG | AMB |
| 92 | 11-15 | T-179 | spec- | handoffs/T-179-D1.md · E-1462 | EDGE | EVG |
| 93 | 11-16 | T-185 | spec- | handoffs/T-185-D1.md · E-1488 | EVB |  |
| 94 | 11-16 | T-188 | spec- | handoffs/T-188-D1.md · E-1510 | EVG |  |
| 95 | 11-16 | T-187 | spec- | handoffs/T-187-D1.md · E-1511 | EDGE |  |
| 96 | 11-16 | T-192 | spec- | handoffs/T-192-D1.md · E-1537 | VD | AMB,EVG |
| 97 | 11-16 | T-194 | spec- | handoffs/T-194-D1.md · E-1551 | INV | AMB |
| 98 | 11-17 | T-194 | spec- | handoffs/T-194-D2.md · E-1554 | RUN |  |