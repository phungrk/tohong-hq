# ADR-128: T-206: sửa hai lỗi trong eval, không tính là spec rework

Ngày: 2026-11-18 · Người quyết: Chief of Staff · Việc: T-203 / T-206

## Bối cảnh
Engineering báo gate T-206 RED ở một eval duy nhất, check_9, và một bất biến chờ merge bị hỏng. Chief đã tự đọc lại file và xác nhận cả hai.
1. `eval/T-203/check_9_hop_ket_noi_admin.mjs`: cùng một cặp đôi gửi yêu cầu r2 cho vendor T trong khi yêu cầu r1 cho T vẫn đang mở. Luật chống trùng sẵn có trả 200 kèm r1. Với vendor Ẩn cũng vậy. Spec ghi luồng cặp đôi cho vendor đã xoá phải "như vendor Ẩn", nên eval đang đòi một hành vi trái spec.
2. `eval/T-203/bat-bien-cho-merge/inv-xoa-khoi-phuc-…mjs` dòng 55: một chú thích `//` nuốt mất khoá `deleted:` ở cuối dòng. Vì vậy `deleted` luôn undefined và 6 kiểm "không còn cờ xoá" không bao giờ đạt.

## Quyết định
- Đây là lỗi cách dựng eval, không phải cách hiểu thứ hai của ý định. Spec giữ nguyên, không `respec`, không tính vòng spec rework.
- Product sửa check_9 chỉ ở phần dựng tình huống: r2 do một cặp đôi khác gửi, hoặc đóng r1 trước khi gửi r2. Mọi điều kiện kiểm giữ nguyên.
- Spec-critic, tác giả bất biến, sửa dòng 55: tách chú thích ra để khoá `deleted` có hiệu lực. Các điều kiện kiểm khác giữ nguyên.
- Luật "không sửa eval cho khớp code" vẫn đứng. Ở đây eval được sửa cho khớp spec và luật chống trùng có sẵn, không phải cho khớp code mới. Code T-206 không đổi.
