---
type: decision
id: ADR-068
date: 2026-11-12
decided_by: chief-of-staff
tasks: [T-125, T-129, T-132]
---
# Kết quả review chéo ChatGPT đầu tiên (T-125) và việc tiếp nối

**Kết quả** (`inbox/chatgpt/T-125-review-pr.md`, adversary xác minh): 2/3 phát hiện đúng, 1 sai một phần. Phát hiện đúng quan trọng nhất (back#46 nuốt file R2 sai schema rồi ghi đè) là lỗi adversary đã bỏ sót qua 2 vòng Code Gate → review chéo có giá trị.

**Quyết định:**
1. Mở T-132 (Engineering, bậc C) sửa back#46 (schema R2 sai → 500 `reviews_corrupt`, không ghi đè; eval adv-04), sinh lại `enrich-report.json` từ main hiện tại (PR tohong mới: report trên main đang cũ — dựng trước #83/#86) và file nhúng ở #46. Thứ tự merge: PR tohong mới → #46 → #68. `task.py` không cho evalplus từ `done`, nên dùng việc tiếp nối thay vì mở lại T-125.
2. Luật tạm tới khi T-129 ship: Chief of Staff chỉ chạy `apply_admin_reviews.py` với `--hq` (spec T-124 để cờ tuỳ chọn; T-129 bỏ hẳn đường này). Eval T-129 phải bảo đảm đường áp mới không có nhánh bỏ qua kiểm quyết định.
3. Đề xuất bất biến vùng (adversary): báo cáo enrich đã commit phải bằng báo cáo sinh lại từ dữ liệu cùng commit — giao adversary rút khi Code Gate T-132.
