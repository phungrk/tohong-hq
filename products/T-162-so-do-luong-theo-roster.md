# Spec T-162: Sơ đồ luồng dashboard theo roster; "đang làm" theo việc đang giữ

## Ý định
Capu (2026-11-14, giao qua Chief of Staff): dashboard phản ánh đúng tình trạng hoạt động của team (insight, product, spec-critic, engineering, adversary), không còn bộ phận cũ.

## Bằng chứng
- `/home/user/tohong-hq-dashboard/index.html` dòng 439-440: `POS_WIDE`/`POS_NARROW` viết cứng vị trí cho `product, engineering, vendor-ops, growth, finance, reviewer, done`; không có `insight`, `spec-critic`, `adversary`.
- Cùng file, `drawFlow`: `flows`/`act` lọc bỏ luồng có đầu nào không có vị trí, nên việc ở insight/spec-critic/adversary không hiện.
- Cùng file, `drawFlow`: nhãn "đang làm" chỉ có khi `activeAgents()` (nhịp tohong-live, hạn `ACT_TTL` 120 giây) có agent đó.
- `scripts/export_dashboard.py` dòng ~490: roster lấy nguyên `org/roster.json`, còn `vendor-ops`, `growth`, `finance`.
- Đã chạy 5 eval trên bản trang hiện tại: tiêu chí 1, 2, 3, 4 đỏ, tiêu chí 5 xanh (đúng như kỳ vọng).

## Giả thuyết
Nếu node sơ đồ sinh từ roster và "đang làm" lấy theo việc đang giữ thì Capu nhìn sơ đồ thấy đủ 5 bộ phận và biết ai đang làm mà không cần nhịp live. Chỉ số bảo vệ: T-145 (DATA_URL, realtime) và các bất biến `hq/dashboard` không đỏ.

## Hành vi (người dùng thấy gì)
1. **Node theo roster.** Sơ đồ luồng có đúng một node cho mỗi phần tử của `roster` trong dashboard.json (thêm bộ phận vào roster thì có node, không sửa trang). Không có node cho id ngoài roster, ngoại lệ duy nhất: node "Hoàn thành" (`done`) được giữ hoặc bỏ tùy cài đặt. Ở khung rộng (1200px) và hẹp (390px): các node không chồng nhau (tâm cách nhau ít nhất 40px), nằm trong khung sơ đồ, trang không cuộn ngang. Cách xếp vị trí do cài đặt quyết định.
2. **Luồng đủ.** Mọi luồng có đầu nào là bộ phận trong roster đều hiện, kể cả luồng tới và đi từ `insight`, `spec-critic`, `adversary`: đường lịch sử (bàn giao, trả về) và đường đang chạy (`.run-edge`). Luồng có đầu là id ngoài roster (vd `vendor-ops`) thì không vẽ.
3. **"Đang làm".** Chữ "Đang làm" nằm trong node của agent khi và chỉ khi agent đó giữ (`holder`) ít nhất một việc ở trạng thái `doing`, `review`, `spec` hoặc `rework` (việc `new`, `escalated`, `blocked`, `done` không tính), hoặc có nhịp hoạt động còn hạn. Khi có nhịp còn hạn (trong `ACT_TTL`), node hiện hành động của nhịp mới nhất theo trường `at` (không theo thứ tự trong danh sách) thay cho chữ "Đang làm". Nhịp quá hạn không hiện; agent giữ việc vẫn hiện "Đang làm". Khi không có nhịp nào (tohong-live im), agent giữ việc vẫn hiện "Đang làm".
4. **Roster xuất ra.** `export_dashboard.py` chỉ đưa vào `roster` (trong `dashboard.json` và `roster.json`): `capu`, `chief-of-staff`, và các id có trong danh sách bộ phận của `CLAUDE.md` (các dòng dạng ``- `id` — mô tả``). Bỏ phần còn lại của `org/roster.json` (hiện: `vendor-ops`, `growth`, `finance`). `chatgpt` (bộ phận ngoài phiên, chỉ nêu trong đoạn văn của CLAUDE.md, không ở danh sách ``- `id` —``) không vào roster. Danh sách đọc lúc chạy từ CLAUDE.md, không viết cứng trong script.
5. **Không đổi.** `DATA_URL` vẫn là `https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json` (INV-019); trang vẫn nối WebSocket `tohong-live` mặc định và `?live=` vẫn đổi host; `#live` hiện "Trực tiếp" khi kênh mở.

## Ràng buộc (vòi)
- Hai PR, hai repo:
  - **`phungrk/tohong-hq-dashboard`** (trang công khai), nhánh `t-162-so-do-luong-theo-roster`: `index.html` (bỏ `POS_WIDE`/`POS_NARROW` viết cứng, "đang làm" theo việc giữ, lọc luồng theo roster) và `tests/` nếu cần.
  - **`phungrk/tohong-hq`** (sổ cái, private), nhánh `agents/engineering/T-162-export-roster`: chỉ `scripts/export_dashboard.py`. File này nằm ngoài sổ cái nên workflow tự mở PR để Capu duyệt (không tự merge).
- Vùng `hq/dashboard`. Bất biến đã đọc: `eval/invariants/_shared/`, `eval/invariants/hq/dashboard/` (inv-001..017, `model/`: đặc biệt `inv-003` hình #model không đổi, `model/inv-006` không cuộn ngang 390px, `model/inv-037` tải lần đầu ở màn hẹp, `model/inv-010` nhân vật khớp khối sáng) và INV-019 của T-145. Spec không vi phạm bất biến nào. Chỗ cần lưu ý: sprite nhân vật (`ROLES`) có thể chưa có vai cho bộ phận mới; đã có nhánh dự phòng `_`, giữ nguyên.
- Không chạm: `org/roster.json` (nguồn sơ đồ tổ chức; chỉ lọc ở đầu ra), `dashboard-data`, payment, auth, DB, dữ liệu người dùng.
- Bậc đề xuất: A (UI dashboard, eval tự động phủ đủ). Riêng PR của `export_dashboard.py` nằm ngoài sổ cái nên Capu duyệt theo workflow.

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; trang đọc `${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}`, d3 qua biến `D3`.
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mỗi phần tử roster (kể cả một id mới thêm trong fixture) có node, không node ngoài roster, không chồng nhau, trong khung, không cuộn ngang, ở 1200px và 390px | `bash eval/T-162/check_1.sh` |
| 2 | Luồng lịch sử và đang chạy tới/đi từ insight, spec-critic, adversary hiện ở cả hai khung; luồng của agent cũ không vẽ | `bash eval/T-162/check_2.sh` |
| 3 | Giữ việc doing/review/spec/rework thì node hiện "Đang làm" khi không có nhịp; giữ new/escalated hoặc không giữ thì không; có nhịp thì hiện hành động mới nhất; nhịp quá hạn không hiện | `bash eval/T-162/check_3.sh` |
| 4 | Roster xuất ra = capu, chief-of-staff + bộ phận trong CLAUDE.md; bỏ vendor-ops, growth, finance; danh sách đọc từ CLAUDE.md | `python3 eval/T-162/check_4.py` |
| 5 | `DATA_URL` đúng, banner lỗi ẩn, WebSocket `tohong-live` mở, `#live` = "Trực tiếp", `?live=` đổi host | `bash eval/T-162/check_5.sh` |

Mỗi tiêu chí đúng một eval. Dạng 2 (script) vì kiểm được bằng trình duyệt giả lập. Tiêu chí 5 xanh sẵn: là eval giữ nguyên hành vi T-145, không phải tính năng mới.

## Bất biến đề xuất (tầng 2)
- `hq/dashboard`: "Mọi phần tử roster có node trong sơ đồ luồng ở 1200px và 390px, không node ngoài roster" (= `check_1`, đổi fixture về roster 7 bộ phận).
- `hq/dashboard`: "Agent giữ việc doing/review/spec/rework luôn hiện đang làm kể cả khi không có nhịp" (= phần không nhịp của `check_3`).
Spec Critic quyết rút vào bể hay không.

## Không làm
- Không đổi hình #model (khối, đường, cổng), nhân vật, KPI, kanban.
- Không đổi cách tohong-live phát nhịp hay hook ghi nhịp.
- Không sửa `org/roster.json`; không đổi định dạng `dashboard.json` ngoài việc bớt phần tử roster.
- Không thêm sprite mới cho bộ phận mới.
- "Đang làm" theo việc giữ tính trên toàn công ty, không theo bộ lọc sản phẩm.

## Câu hỏi mở
Không. (Giả định đã chọn: `chatgpt` không vào roster vì không phải node của luồng việc trong sổ cái; đổi ý thì thêm một dòng ``- `chatgpt` — …`` vào danh sách bộ phận của CLAUDE.md. Tự tin ~75%.)
