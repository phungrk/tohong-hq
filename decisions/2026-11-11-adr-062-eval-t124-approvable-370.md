---
type: decision
id: ADR-062
date: 2026-11-11
decided_by: chief-of-staff
tasks: [T-124, T-125]
---
# Eval T-124: approvable đòi override rỗng (370, không phải 371)

**Bối cảnh:** gate T-125 đỏ đúng một eval (check_2): hàm chuẩn `eval/T-124/_t124.py::approvable` bỏ qua `override`, cho 371; spec T-124 Hành vi 2 ("override rỗng") và `eval/T-124/bat-bien-cho-merge/inv-001` (c) đòi 370. Dòng lệch `marry_f8b40ba4ddef` (override accept_place từ ADR-048). Code theo spec.

**Phân xử:** spec thắng. Đây là eval lệch spec, không phải sửa eval cho khớp code: Product (người viết eval) sửa hàm chuẩn, snapshot, check_1 (371→370), check_8, check_7 (ví dụ lấy từ dữ liệu sống, để PR tohong#83 không làm đỏ oan), và dòng 371 trong spec/handoff T-124-v2. Engineering không đổi code vì đã đúng spec.
