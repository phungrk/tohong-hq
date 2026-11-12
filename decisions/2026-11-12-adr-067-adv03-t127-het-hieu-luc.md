---
type: decision
id: ADR-067
date: 2026-11-12
decided_by: chief-of-staff
tasks: [T-127, T-128, T-130]
---
# eval/T-127/adv-03 hết hiệu lực sau khi C-1 đổi thành False (ADR-065)

`eval/T-127/adv-03-c1-doi-bang-mot-dong.py` chứng minh "C-1 đổi được bằng một dòng" bằng cách tìm đúng chuỗi `FEW_REVIEWS_BEATS_CLOSED = True`. Sau T-130 (đổi cờ thành False theo ADR-065), nó FAIL vì diff 0 dòng và đối chứng "mặc định few_reviews thắng" không còn đúng. Đây không phải hồi quy. adv-03 chỉ thuộc T-127 (đã done), không ở trong bể; không đăng ký cho việc nào sau; không xoá file (lịch sử). Hành vi mới được khoá bởi eval/T-126/check_1 (v3) và INV-032.
