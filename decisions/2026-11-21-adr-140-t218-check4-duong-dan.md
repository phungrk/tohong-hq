# ADR-140: T-218: sửa đường dẫn trong check_4 của T-217 sau khi v2 của pool/inv-001 đã vào bể

Ngày: 2026-11-21 · Người quyết: Chief of Staff · Việc: T-217 / T-218

`eval/T-217/check_4` chạy v2 của pool/inv-001 qua đường dẫn chờ merge `eval/T-215/bat-bien-cho-merge/thay-inv-001-...-v2.py`. Theo ADR-137, Chief đã đưa v2 vào bể ở `eval/invariants/planner/vendor/pool/inv-001-pool-khop-van-ban-nguon.py`. Từ đó đường dẫn cũ không còn file, và check_4 đếm thiếu một bất biến.

Đây là lỗi dựng eval do bể thay đổi, không phải lỗi spec. Chief chỉ đổi đường dẫn sang file trong bể, nội dung vẫn là cùng một v2. Không đổi điều kiện kiểm nào, không tính spec rework.
