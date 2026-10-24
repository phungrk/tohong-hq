# PRD T-002: Bản đồ luồng thể hiện việc đang chạy

## Vấn đề
Capu mở dashboard để biết việc nào đang nằm ở đâu, nhưng `drawFlow` (`/home/user/tohong-hq-dashboard/index.html`, dòng 219-252) chỉ vẽ tổng bàn giao/trả về cộng dồn lịch sử từ `x.flows`. Line của việc đã xong và việc đang chạy giống hệt nhau. Bằng chứng: code, `scripts/export_dashboard.py`, `dashboard.json`.

## Giả thuyết
Nếu line của việc đang chạy được highlight và chảy theo hướng bàn giao thì Capu biết "việc nào đi từ ai sang ai" trong <= 5 giây (ĐOÁN, tự tin trung bình, cần Capu thử). Bảo vệ: 0 trường riêng tư mới.

## Dữ liệu: đã đủ chưa?
Đủ để suy ra, bản đầu không cần xuất thêm. `tasks[]` có `id, state, holder, owner, reviewer`; `events[]` bản công khai còn `task, event, from, to, t` (chỉ bỏ `detail`, `link`). Với mỗi việc chưa `done`, cạnh = sự kiện `assigned | handoff | rejected` gần nhất của việc đó, theo `from` → `to`:
- `new`: Chief of Staff → holder. `review`: owner → reviewer. `rework`: reviewer → owner. `doing`: người giao gần nhất → holder.
- `blocked`, `escalated`: không vẽ flow.

Điểm yếu: client phải quét cả nhật ký, và dễ vỡ khi có loại sự kiện mới. Đề xuất xuất thêm vào mỗi `tasks[]`: `flow_from`, `flow_to`, `flow_since` (chỉ id vai trò và giờ, không nội dung). Chạm `scripts/` nên thành pull request cho Capu duyệt.

## Phạm vi
Làm: highlight, animation, tooltip, chú giải. Không làm: lộ `detail`, `link`, ghi chú, đường dẫn; không viết code; không đổi bố cục node.

## Hành vi
- Line thường (xám) và line trả về lịch sử (đỏ gạch tĩnh) giữ nguyên.
- Line đang chạy: dày hơn 1,5px, màu `--accent`, mũi tên đậm; line khác mờ còn khoảng 45% khi có việc đang chạy.
- Animation: nét đứt chạy từ node giao tới node nhận, cùng chiều mũi tên. `new/review/rework` chảy nhanh (khoảng 1 giây/chu kỳ), `doing` chảy chậm (khoảng 3 giây) và node nhận viền sáng. `rework` đang chạy dùng `--bad`, liền nét dày, khác line trả về gạch tĩnh.
- Nhiều việc: mỗi cạnh vẽ một lần, cùng cạnh hiện huy hiệu "×n". Tối đa 6 cạnh chảy; vượt thì cạnh cũ nhất chỉ highlight tĩnh.
- Không việc nào chạy: không animation, hiện "Không có việc nào đang chạy".

## Tiêu chí chấp nhận (có/không)
1. Mỗi việc ở `new/doing/review/rework` cho đúng một cạnh theo quy tắc trên; `blocked/escalated/done` không cho cạnh nào.
2. Cạnh đang chạy khác line thường và line trả về ở ít nhất hai thuộc tính (màu, độ dày), vẫn nhận ra khi tắt animation.
3. Nét chảy đi từ node giao sang node nhận, trùng chiều mũi tên, với cả bốn trạng thái.
4. Hai việc cùng cạnh hiện một line với huy hiệu "×2"; không việc nào chạy thì SVG không có phần tử animation.
5. Với `prefers-reduced-motion: reduce`, không animation nào chạy; highlight tĩnh, mũi tên đậm và huy hiệu vẫn còn.
6. Sáng và tối: line đang chạy tương phản >= 3:1 với nền panel, chỉ dùng biến CSS sẵn có.
7. Tooltip chỉ có mã việc, tiêu đề, trạng thái; `dashboard.json` công khai không thêm `detail`, `link` hay đường dẫn.
8. Cạnh có node ngoài `pos` bị bỏ qua, không gây lỗi.

## Rủi ro và câu hỏi mở
- `doing` có tính là "chuyển" không? Giả định: chảy chậm; Capu có thể đổi thành chỉ viền sáng node.
- Dữ liệu làm mới mỗi 60 giây nên có thể trễ.

## Mức leo thang
Tự làm. Không chạm tiền, pháp lý, dữ liệu người dùng. Xuất thêm trường sẽ có pull request cho `scripts/`.
