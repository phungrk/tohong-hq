---
type: decision
id: ADR-079
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-140, T-143]
---
# Đưa INV-A..E của T-140 vào bể sau khi Chief of Staff merge tohong-back#52 (Capu "đồng ý, merge 52 luôn")

Theo ADR-028 và ADR-078; cả năm xanh trên main 1e49e5a, chạy `python3 -I` từ /tmp không biến môi trường (dò gốc HQ tới scripts/gate.py):
- `planner/vendor/images/inv-037-chat-khong-goi-mang-van-co-ung-vien.py` (INV-A)
- `planner/vendor/images/inv-038-ung-vien-chat-dung-pool-overlay.py` (INV-B — thay inv-034 đã lưu trữ ở ADR-078; khoảng trống của ADR-078 đóng)
- `planner/vendor/images/inv-039-r8-sau-mmr-duong-chat-js.py` (INV-C)
- `planner/vendor/images/inv-040-duong-ghep-chat-khong-nem.py` (INV-D)
- `planner/vendor/images/inv-041-chat-cham-diem-bang-ngan-sach-goc.py` (INV-E, ca ADR-026 trên đường JS)
Bản trong `eval/T-140/bat-bien-cho-merge/` giữ làm lịch sử. Merge bậc B sớm hơn cửa sổ 48 giờ vì Capu đã đọc Diff hành vi và đồng ý (chấp nhận khớp gu 51% vs 57%, hợp ngân sách 80% vs 65%).
