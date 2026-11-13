# Bất biến mới từ Insight — 2026-11-13

- `eval/invariants/_shared/inv-004-bat-bien-khong-dem-cap-sai-tim-goc-hq.py` — bắt bất biến tự đếm cấp thư mục để tìm gốc tohong-hq mà ra sai thư mục sau khi chép sang độ sâu khác (lỗi ADR-057, ADR-070, ADR-076). Áp cho `_shared` (mọi việc). Nguồn: sự cố lặp lại 3 lần trong 4 ngày, `insights/2026-11-13-feedback.md`.
- Mở: `eval/invariants/_shared/mien-tru-inv-004.txt` liệt kê 1 nợ, `planner/vendor/images/inv-031-gh-biet-repo-o-moi-buoc.py` dòng 16 đếm 3 cấp thay vì 5 (đo rỗng khi không đặt `TOHONG_REPO`). Chief of Staff sửa dòng đó sang dò ngược tới `scripts/gate.py` rồi xoá dòng miễn trừ (INV-004 tự đỏ nếu để sót).
