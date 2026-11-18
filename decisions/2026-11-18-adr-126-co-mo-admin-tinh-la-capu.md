# ADR-126: Khi cờ ADMIN_OPEN bật, thao tác admin được tính là của Capu

Ngày: 2026-11-18 · Người quyết: Capu · Ghi bởi: Chief of Staff · Việc: T-204

## Bối cảnh
T-200 đã ghi 132 review accept_place. Các review này mang danh tính "admin-khong-dang-nhap" nên không bao giờ được tính là của Capu, và export ký bỏ qua chúng. Điều này đúng theo inv-002 của planner/admin (T-188, ADR-116). Capu không muốn tắt cờ ("hiện chỉ mỗi mình anh đang test web app này").

Chief đưa hai cách:
1. Tắt cờ, đăng nhập, duyệt lại từng hàng.
2. Đổi luật: khi cờ bật, người dùng admin được tính là Capu.

Capu chọn: "cách 2, merge luôn khi xong".

## Quyết định
- Khi `ADMIN_OPEN === "1"`, mọi thao tác admin (kể cả review đã ghi dưới danh tính cố định khi cờ đang bật) được tính là quyết định của Capu, và đi vào export ký.
- Khi cờ tắt, mọi thứ giữ như cũ: chỉ tài khoản Clerk nằm trong cả ADMIN_USER_IDS và CAPU_USER_IDS mới là Capu.
- Bất biến planner/admin inv-002 ("danh tính cố định không bao giờ là Capu") hết hiệu lực khi PR của T-204 merge. Nó được thay bằng bất biến mới do T-204 rút ra. Không sửa inv-002 cho khớp code: inv-002 được gỡ khỏi bể kèm ADR này, và việc gỡ chỉ diễn ra lúc merge.
- Bậc C (chạm xác thực, tức danh tính Capu). Capu cho phép rõ: "merge luôn khi xong". Chief merge sau Spec Gate, Code Gate GREEN và adversary accept.

## Rủi ro đã nêu với Capu
Ai mở được trang admin khi cờ bật thì được tính là Capu. Trước khi mở web app cho người khác, phải tắt cờ.

## Bổ sung (Chief, 2026-11-18): inv-002 ở Code Gate
inv-002 cũ đo đúng hành vi mà Capu đã quyết bỏ. Vì vậy ở Code Gate của T-204, inv-002 đỏ là đỏ có chủ đích, không phải lý do spec rework. Cách làm:
- Adversary chạy gate như thường và ghi nhận đỏ của inv-002 cùng case B của `lib/admin_open_back.mjs`, kèm ADR này. Mọi bất biến khác phải xanh.
- Trước khi merge, Chief chạy lại gate với bể đã đổi trên bản làm việc cục bộ: gỡ inv-002 cũ, thêm inv-002 mới và inv-007 từ `eval/T-204/bat-bien-cho-merge/`. Gate phải GREEN thì mới merge.
- Ngay sau merge, Chief commit việc đổi bể cùng ghi chú "superseded by ADR-126" cho các eval đã đóng: T-188 check_2 và check_back case 2, T-190 adv-01 (b), T-199 adv-01 (e). Các eval đó không bị sửa.
