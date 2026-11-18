# ADR-127: T-203: `vendor_deleted_at_create` tính từ Nhật ký, không ghi vào yêu cầu kết nối

Ngày: 2026-11-18 · Người quyết: Chief of Staff · Việc: T-203 (spec), engineering kế tiếp

## Bối cảnh
Spec-critic cho spec T-203 bản 2 qua Spec Gate. Còn một điểm phải chọn cách cài: cờ `vendor_deleted_at_create` của yêu cầu kết nối lấy từ đâu. Có hai cách:
(a) Thêm một trường vào tài liệu yêu cầu kết nối, nằm cạnh `vendor_hidden_at_create`.
(b) Suy ra từ Nhật ký: tìm dòng `vendor.delete` / `vendor.restore` gần nhất trước `created_at`.
Cả hai cách đều qua check_9.

## Quyết định
Chọn (b). Tài liệu yêu cầu kết nối là dữ liệu người dùng. Spec ghi "Không chạm: … yêu cầu kết nối" và "Chỉ thêm khoá deleted* vào tài liệu overlay admin". Ghi trường mới vào đó là chạm ranh giới cứng, kéo việc lên bậc C. Cách (b) chỉ đọc Nhật ký, nên bậc vẫn là B.

Hệ quả: nếu Nhật ký thiếu dòng (chẳng hạn vendor bị xoá trước khi có tính năng này, trường hợp không thể xảy ra), cờ trả `false`.
