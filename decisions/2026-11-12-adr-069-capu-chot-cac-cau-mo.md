---
type: decision
id: ADR-069
date: 2026-11-12
decided_by: capu
tasks: [T-126, T-128, T-130, T-124, T-125, T-122, T-123, T-129]
---
# Capu chốt các câu còn mở (2026-11-12)

1. **Tạm đóng cửa + < 2 đánh giá → ẩn vendor, kiểm lại ở lần chạy sau** (spec T-126 v3, T-130): giữ như spec.
2. **"Enrich 100%" = 98** (bắt buộc có ảnh Google; 7 vendor khớp mà không ảnh ở nhóm riêng): giữ mặc định spec T-124.
3. **Hàng "500+" onboarding bước 2**: giữ như hiện tại (cuộn mới thấy; không bỏ "Quay lại bước 1" khỏi footer). Không mở việc thu footer.
4. **Khoá máy `ENRICH_EXPORT_TOKEN` cho T-129**: đồng ý (mặc định có). Khoá ký `ENRICH_SIGNING_KEY` + `ENRICH_SIGNING_KEY_ID` theo ADR-066 đi cùng; Capu tự đặt secret khi code T-129 ship, Chief of Staff không đặt thay.
5. **ChatGPT review chéo T-125**: đã xong (kết quả ADR-068).
