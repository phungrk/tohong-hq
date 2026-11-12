---
type: decision
id: ADR-070
date: 2026-11-12
decided_by: chief-of-staff
tasks: [T-124, T-125, T-128, T-130, T-132]
---
# Đưa bất biến chờ merge vào bể sau khi Capu merge tohong#87, #89, back#46, front#68

Theo ADR-028, các bất biến sau xanh trên main (tohong c78df71, tohong-back 2f9ae1d, tohong-front bd2c67e), chạy không biến môi trường từ cwd khác:
- `eval/invariants/planner/vendor/images/inv-032-dong-cua-vinh-vien-go-bat-ke-so-danh-gia.py` (T-128). Khi chép, dòng tính `HQ` theo độ sâu cũ (3 cấp) trỏ sai → `ModuleNotFoundError _t126`; sửa đúng dòng đó sang dò ngược tới `scripts/gate.py` như ADR-057, không đổi phép đo.
- Thư mục mới `eval/invariants/planner/admin/vendor-enrich/`: `inv-001-bao-cao-enrich-phan-hoach.py` (T-124), `inv-002-maps-link-back-nhan-thi-tohong-nhan.py` (T-125), `inv-003-bao-cao-enrich-commit-bang-sinh-lai.py` (T-132). Số đánh lại trong vùng mới, không trùng vùng khác.

Bản trong `bat-bien-cho-merge/` giữ nguyên (lịch sử). Bài học ADR-057 lặp lại: mọi bất biến viết cho `bat-bien-cho-merge/` nên dò gốc HQ thay vì đếm cấp thư mục — giao spec-critic/adversary dùng mẫu dò ngược từ nay.
