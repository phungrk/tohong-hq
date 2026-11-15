---
type: defect
id: T-174-spec-gate-v3
task: T-174
round: 0
from: spec-critic
to: product
severity: blocker
kind: spec
against: "câu H5 '(2) chỉ đè lên bản đó các trường dự toán người dùng đã đổi mà chưa lưu: `allocated_tr` theo hạng mục (theo `id`), `total_tr`, `guests`' trong products/T-171-the-vendor-theo-du-toan-hien-tai.md v3"
---
Kết luận: TRẢ (spec T-171 v3). Một lỗi chặn, còn lại đã qua. Theo lệnh của Chief, spec-critic KHÔNG chạy task.py cho T-174; Chief ghi sổ cái. Chưa rút bất biến `planner/front/budget` vì spec chưa qua.

Máy: `python3 scripts/gate.py T-174` RED, không ERROR, không MANUAL. Tầng 1: check_1-5, 7, 8, 9 và adv-01/02/03 FAIL trên main, check_6 PASS (lưới, như v2); tầng 2: không bất biến nào đỏ; tầng 3: adv-04/05 FAIL trên main. Trên bản cài giả của Product: check_2, check_4, adv-01, adv-02, adv-03 PASS (front `scratchpad/fix`); check_9 PASS với `TOHONG_BACK_REPO=scratchpad/backfix` (đỏ trên back main vì thật sự thiếu tính năng, không phải lỗi khung). adv-01: chỉ thêm route giả `match?ids=` (dòng 20-22), các câu `bad(...)` giữ ý định cũ. Xác nhận không đổi ý định hay assert.

## Lỗi chặn · H5 không nói gì về khoản/mục con NGƯỜI DÙNG tự thêm, sửa, xoá trong lúc có câu báo
Câu: "Mỗi lần ghi lại sau lỗi: (1) GET bản server; (2) chỉ đè lên bản đó các trường dự toán người dùng đã đổi mà chưa lưu: `allocated_tr` ..., `total_tr`, `guests`; (3) ghi bản ghép." Và "Màn tải lại ... ghép các giá trị chưa lưu lên bản server vừa tải".
Danh sách sau dấu hai chấm chỉ có ba trường số. Nhưng ở màn Ngân sách, người dùng còn sửa được khoản/mục con (nút "Thêm mục con", eval 3d), tên, số tiền khoản, `mung_tr`. Nếu lần ghi đầu tiên lỗi vì chính thao tác thêm khoản, hoặc người dùng thêm khoản khi câu báo đang hiện, thì ba cách cài đều thoả câu này:
1. Đọc nguyên văn: chỉ ghép ba trường số. Bấm `Thử lại` thì server nhận bản server cũ + 40, khoản người dùng vừa thêm KHÔNG được ghi. "Màn hiện bản ghép" làm khoản đó biến mất khỏi màn, và câu báo cũng biến mất. Người dùng mất dữ liệu mà không được báo, đúng loại lỗi "lưu lỗi im lặng" spec này sinh ra để chặn. Cách này cũng trái câu đầu H5 "không làm mất việc vừa làm".
2. Ghép thêm thay đổi khoản của người dùng theo `id` (thêm/sửa/xoá do người dùng làm trên màn), vẫn giữ khoản do lần ghi khác thêm (`vendor_<id>`). Khoản được giữ.
3. Khoá chỉnh khoản khi đang có câu báo (nút "Thêm mục con" vô hiệu). Không thêm được.
Người dùng thấy ba kết quả khác nhau (khoản mất / còn / không thêm được). Không eval nào phân biệt. Probe của tôi (`/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/t174probe/probe-mat-muc-con.cjs`, chạy trên khung adv_khung: lưu 40 lỗi → "Thêm mục con" (lỗi) → server tốt → "Thử lại" → đếm khoản trên server) PASS trên bản cài giả, nhưng một bản cài đúng nguyên văn cách 1 vẫn qua cả 12 eval. Đây là đường dữ liệu người dùng của việc bậc B.
Cần: một câu chọn 1 trong 3 (tôi đề xuất 2: "khoản/mục con người dùng thêm, sửa, xoá trên màn mà chưa lưu cũng được ghép theo `id`; khoản không do người dùng đổi thì lấy theo server"), cộng một eval (có thể dùng probe trên làm khung). Nếu chọn 2 thì câu bất biến đề xuất thứ hai giữ nguyên ý; nếu chọn 3 thì thêm chữ cố định cho trạng thái khoá.
Ghi chú leo thang: nếu Chief tính đây là lần spec rework thứ ba cho cùng ý định (D1, reject spec của T-174, lần này) thì việc tự `escalated`. Câu hỏi cho Capu chỉ là: "Khoản cặp đôi tự thêm/sửa trong lúc chưa lưu được dự toán: giữ lại và ghi cùng (đề xuất), hay khoá không cho thêm tới khi lưu được?"

## Đã kiểm, không chặn
- H5 "trường người dùng đã đổi" so với bản nào (bản front biết là đã lưu / bản server vừa GET / tập trường người dùng đã chạm): trong phạm vi spec, ba cách cho cùng kết quả. Lý do: `VendorCtx.syncBudgetItem` GET mới rồi chỉ đổi `items` (tohong-front `src/screens/VendorCtx.jsx:67-90`); action chat `add_budget_item` chỉ thêm khoản; `update_profile` không ghi tài liệu dự toán. Chỉ khác ở trường hợp tab/thiết bị khác, mà spec đã để ngoài phạm vi. Minor: thêm một câu "so với giá trị front biết là đã lưu (như định nghĩa Sự kiện đổi số)" cho thống nhất.
- H6 (`Chưa có điểm cho vendor này`, không có nút Thử lại; bảng so sánh hiện `—`) khớp H8 (id ẩn/không qua lọc thì vắng) và với vendor `hidden` giữ cách báo cũ. Có adv-01.
- H7: rõ, có check_9 (a), so `match` giống danh sách.
- H8 thứ tự trả về: spec không hứa thứ tự, và check_9 so theo tập id (dòng 29), nên front phải tra theo id. Không có hành vi người dùng thấy khác nhau. Minor: ghi một câu "thứ tự không bảo đảm; front tra theo id". Giới hạn 50: các ca `ids=` rỗng, id trùng (tính trùng vào 50 hay không) chưa nói. Minor, không ảnh hưởng người dùng vì front chỉ gửi id của bảng so sánh (≤ vài vendor).
- H8 không gọi LLM, `whyThoseVendors` null, quyền đọc như cũ: rõ, có check_9.
- Bất biến: không vi phạm `planner/vendor` INV-001..005, `matching` INV-001..005, `planner/front/budget` INV-001..004 (ghép sau GET không thêm/xoá khoản lúc mở màn; INV-003 chỉ nói mở màn không bấm gì). Bất biến gác `eval/T-171/bat-bien-cho-merge/inv-006` vẫn hợp với v3.
- Back nay đổi (H7, H8): bậc B Chief đã đặt là đủ; không chạm ranh giới cứng.
