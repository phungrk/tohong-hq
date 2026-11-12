---
type: decision
id: ADR-074
date: 2026-11-12
decided_by: chief-of-staff
tasks: [T-135, T-129]
---
# T-135 đổi có chủ đích một mệnh đề của eval/T-129/check_5 (add-paths của apply-admin-reviews)

**Bối cảnh:** T-135 (gộp T-133) yêu cầu `apply-admin-reviews.yml` sinh lại `enrich-report.json` trong cùng commit, vì báo cáo đọc `manual_overrides.json`. Eval T-129 `check_5` đang ghim danh sách add-paths không có file đó. Spec Gate T-135 D1-B3: nếu spec không chỉ ai sửa, người sửa cuối cùng là Engineering — tức sửa eval cho khớp code (cấm).

**Quyết định (tiền lệ ADR-064, ADR-067):**
1. Mệnh đề add-paths trong `eval/T-129/check_5` được thêm đúng một đường dẫn `enrich-report.json` của workflow đó. **Product sửa trong lượt spec rework T-135**, trước Spec Gate — không phải Engineering.
2. Mọi mệnh đề khác của check_5 giữ nguyên. Eval 8 của T-135 ghim sha256 các file eval T-129 còn lại để bắt mọi đổi thêm.
3. Hành vi T-129 (chữ ký, Capu bấm là quyết) không đổi; chỉ thêm một file vào commit.
