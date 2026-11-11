---
type: decision
id: ADR-061
date: 2026-11-11
decided_by: chief-of-staff
tasks: [T-121, T-120]
---
# Kết quả chạy thật lượt "chạy lại theo tên" (run 43026321789)

**Run:** https://github.com/phungrk/tohong/actions/runs/43026321789 (ADR-060), PR dữ liệu https://github.com/phungrk/tohong/pull/83.

**Kết quả:** 49 vendor hỏi lại: 36 nhận theo tên (32 có ảnh Google), 6 gỡ vì Google báo đóng cửa vĩnh viễn (Chau Anh Bridal — gỡ ở cả 3 hạng mục, TanArt Studio, Lemon Tree Wedding Stylist, Bánh Cưới Minh Tâm, Halady Makeup, Boniva chocolatier), 7 lần này Google trả nơi khác không qua luật tên (đánh dấu recheck_done, không hỏi lại). Request: Text Search 49, ảnh 62; chi ước tính net cả đợt tháng 11 $12,60 / trần $30.

**Dự kiến vs thật:** spec ước 49 nhận; thật 36 — vì 6 đã đóng cửa và 7 Google trả kết quả khác lần trước (spec 4c cho phép).

**Tiếp theo:** Capu soát 36 dòng (bản gộp gửi Capu), merge #83, rồi PR pool tohong-back merge liền sau (INV-021/022).
