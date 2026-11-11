---
type: decision
id: ADR-064
date: 2026-11-11
decided_by: chief-of-staff
tasks: [T-126, T-127]
---
# Fixture eval T-126 check_2 phải khớp dòng audit T-110 ghi cho duyệt tay

**Bối cảnh:** gate T-127 đỏ đúng một điểm của check_2 ("enrich.py thường làm đổi dữ liệu"). Nguyên nhân: `enrich.py` thường áp `manual_overrides.json` (T-110) trước, ghi lại dòng audit của vendor `accept_place` với `reason = "duyệt tay (accept_place) bởi capu: ..."`; fixture `audit_row(..., manual=True)` trong `eval/T-126/_t126.py` để `reason=""`. Hành vi này có từ T-110, không do luật T-126.

**Phân xử:** chọn (a) — Product sửa fixture cho `reason` khớp dòng T-110 sẽ ghi. Không chọn (b) đổi `overrides.py`: đó là đổi hành vi T-110 (không cập nhật `reason` khi Capu sửa lý do) ngoài phạm vi việc. Đây là eval lệch hành vi đã có và đã qua Code Gate, không phải sửa eval cho khớp code mới.
