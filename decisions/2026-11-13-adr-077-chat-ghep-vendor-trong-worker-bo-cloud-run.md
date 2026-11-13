---
type: decision
id: ADR-077
date: 2026-11-13
decided_by: capu
tasks: [T-140]
---
# Chat AI ghép vendor bằng computeMatches trong Worker; bỏ hẳn matcher Cloud Run

**Bối cảnh:** Sau T-138, workflow sync-matcher-vendors ghi được bucket (Capu cấp quyền gha-deployer) nhưng health 503: Cloud Run trả "Service is disabled" — matcher-service đã bị tắt từ trước, chat không có ứng viên từ matcher. Chief of Staff so sánh: (A) bật lại matcher Python trên Cloud Run; (B) chat dùng `computeMatches` (lib/vendorMatcher.js) đã chạy trong Worker cho tab Vendor. Python có thêm nới điều kiện khi < top_k và đa dạng MMR; JS không có.

**Quyết định (Capu, 2026-11-13: "B giữ được chất lượng của A và bỏ hẳn Cloud Run"):**
1. Chat lấy ứng viên từ `computeMatches` trong Worker, cùng pool + overlay admin với tab Vendor; không gọi mạng.
2. Chuyển sang JS hai phần Python có mà JS chưa có: nới điều kiện dần khi ít hơn top_k, và đa dạng MMR — để chất lượng không kém A. Đo bằng eval so với matcher Python trên cùng hồ sơ.
3. Bỏ hẳn Cloud Run: gỡ đường `callMatcher`, workflow `sync-matcher-vendors.yml`, `deploy-matcher.yml`, `matcher-data/` khỏi repo sau khi (1)(2) chạy ổn. Xoá service Cloud Run và bucket là việc Capu tự làm (không đảo ngược), Chief of Staff đưa lệnh.
4. Giữ từ T-138: bộ lọc pool, câu prompt A9, khối khoảng trống.
