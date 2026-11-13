---
type: decision
id: ADR-075
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-135, T-129]
---
# Bổ sung ADR-074: check_5 của T-129 được thay thêm biểu thức `vars.AUTO_RESOLVE_OVERRIDES`

**Bối cảnh:** Khi sửa `eval/T-129/check_5` theo ADR-074, product thấy bộ thay biểu thức `${{ … }}` của eval không biết `vars.AUTO_RESOLVE_OVERRIDES`. Tiêu chí 11 của T-135 (thân PR duyệt tay báo trạng thái tự chạy) cần biểu thức này, nên nếu không thay được thì eval chết vì `KeyError` — tức đỏ vì giới hạn của eval, không vì hành vi.

**Quyết định:** Chấp nhận thay đổi thứ hai này của check_5, do product làm trong lượt spec rework (không phải Engineering): bộ thay biểu thức nhận thêm `vars.AUTO_RESOLVE_OVERRIDES`. Không mệnh đề hành vi nào của T-129 đổi. Eval 8 của T-135 ghim sha256 bản check_5 đã sửa cùng các file eval cũ khác (`eval/T-135/pins_eval_cu.json`); mọi đổi thêm phải có ADR mới.
