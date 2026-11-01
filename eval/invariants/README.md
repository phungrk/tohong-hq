# Bất biến (eval tầng 2)

Mỗi thư mục con là một **vùng** sản phẩm (`area` trong brief), ví dụ `front/vendor-list`, `back/matching`, `front/budget`.
Mỗi file là một bất biến: tính chất phải đúng mãi trong vùng đó, viết thành eval chạy được (`.py` hoặc `.sh`, mã thoát 0 = đạt), tên `inv-<nnn>-<tên-ngắn>`.
Đầu file ghi: nguồn (spec `T-xxx` đã qua Spec Gate, eval đối kháng `T-xxx/adv-nn`, hay sự cố ngày nào), và một câu nói bất biến là gì.

`scripts/gate.py T-xxx` tự chạy mọi bất biến của vùng việc chạm. Bất biến đỏ nghĩa là **spec** của việc mâu thuẫn với vùng, không phải code sai: `reject --kind spec`.

Ai được thêm: `spec-critic` (từ spec qua cổng), `adversary` (từ eval đối kháng tổng quát), `insight` (từ sự cố). Sửa hoặc xoá: qua Chief of Staff, ghi `decisions/`.
