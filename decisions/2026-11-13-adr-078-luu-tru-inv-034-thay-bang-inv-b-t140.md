---
type: decision
id: ADR-078
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-140, T-143]
---
# Cất inv-034 (planner/vendor/images) vào lưu trữ; thay bằng INV-B của T-140 sau merge

**Bối cảnh:** ADR-077 (Capu): chat ghép vendor bằng computeMatches trong Worker, không gọi matcher Cloud Run. inv-034 (T-136) đo "match ngoài pool không vào prompt" bằng matcher giả qua `fetch` — vế dương của nó giả định chat gọi mạng, nên đỏ trên mọi bản cài đúng ADR-077 (Spec Gate T-140 D1 đã dựng lại: FAIL "vendor trong pool không vào prompt"). Để nguyên thì tầng 2 đỏ trên PR bước 1 → bị phân loại spec rework sai.

**Quyết định:**
1. `inv-034-match-ngoai-pool-khong-vao-prompt.py` chuyển sang `eval/invariants/planner/vendor/images/_luu-tru/` (gate chỉ chạy file trực tiếp trong thư mục vùng, nên bản lưu trữ không chạy). Không xoá — giữ lịch sử.
2. Bản thay: `eval/T-140/bat-bien-cho-merge/inv-B-thay-inv-034-ung-vien-chat-dung-pool-overlay.py` (Spec Gate soạn ở D1, giữ ý cũ "chỉ vendor trong pool, đúng tên/giá overlay" và thêm không gọi mạng, ngân sách, rating, không lộ liên hệ). Trong lúc chờ merge, nó cùng INV-A, INV-E được đăng ký làm eval tầng 1 của việc Engineering T-143, nên vẫn bị ép.
3. Khoảng trống: từ nay tới khi PR bước 1 merge, bể không có bất biến "chat chỉ đề xuất vendor trong pool". Chấp nhận vì matcher Cloud Run đang tắt ("Service is disabled") — chat hiện không có ứng viên nào. Sau merge và xanh trên main, đưa INV-A..E vào bể (đánh số tiếp), ghi ADR.
