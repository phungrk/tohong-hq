---
type: decision
id: ADR-048
date: 2026-11-08
decided_by: capu
tasks: [T-108, T-110]
---
# Capu duyệt tay 4 venue chưa có ảnh Google

**Bối cảnh:** sau khi T-108 merge (phungrk/tohong#72, phungrk/tohong-back#42), có 31/91 venue hiện ảnh minh hoạ. Capu tự tra Google Maps cho 4 venue trong danh sách Tìm vendor.

**Quyết định (Capu, 2026-11-08):**
1. **Én Banquet & Event Space** (`marry_d4380c0b3cf3`, lần enrich trước ra `no_match`): có trên Google Maps, link https://share.google/tYZdblcikIDPqVJX6. Lấy place_id từ link này rồi nhận khớp.
2. **Nhà hàng Tự Do – Khách sạn Viễn Đông** (`marry_e38f1e755f9c`, `no_match`): không có trên Google Maps, **loại khỏi danh sách**. Lưu vào `removed_vendors.json` để khôi phục được, giống ADR-044.
3. **Pergola** (`marry_2ee808943c08`, Google trả "Pergola Garden Restaurant" cùng 28A Trần Cao Vân): Google Maps ghi **tạm thời đóng cửa**. Đổi trạng thái để lần enrich sau thử lại vendor này. Không gỡ, không nhận ảnh lúc này.
4. **Thiskyhall** (`marry_f8b40ba4ddef`, Google trả "Trung tâm hội nghị Thiskyhall Sala" với độ tin 0,455): có trên Google Maps, link https://share.google/noYBKfSkxUtMoFmJD. Nhận khớp.

**Cách làm:** duyệt tay của Capu ghi vào một file dữ liệu (manual overrides). Lệnh enrich và lệnh áp lại luật phải tôn trọng file này. Việc hiện thực là T-110 (bậc C).

Ghi chú: phiên cloud không mở được link `share.google` (proxy chặn). Nếu cần gọi Place Details để đổi link thành place_id thì gọi từ workflow GitHub, trong hạn mức miễn phí.
