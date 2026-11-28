# Bất biến từ Insight — 2026-11-27

- `eval/invariants/hq/ledger/inv-009-mot-issue-404-khong-chan-phan-chieu-cac-viec-khac.py` — bắt lỗi: một issue trả 404 (số issue của kho khác hoặc issue đã xoá) làm chết cả lượt `scripts/mirror_issue.py`, state không lưu, các việc khác không được phản chiếu. Áp cho vùng `hq/ledger`. Hiện ĐỎ trên main đúng với bug (workflow phản chiếu lỗi liên tiếp từ 22/11); sẽ chặn việc chạm `hq/ledger` tới khi `mirror_issue.py` được sửa. Chief of Staff cần quyết: giữ nguyên hoặc dời vào eval của việc sửa. Nguồn: insights/2026-11-27-feedback.md.
