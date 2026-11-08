---
type: decision
id: ADR-041
date: 2026-11-08
decided_by: capu
tasks: [T-104, T-068, T-070]
---
# Ảnh vendor từ Google Place Photos (thay phần 2 của ADR-030)

**Bối cảnh:** ADR-030 bỏ marry.vn. Phần 2 của nó ghi: "Không chạy mirror từ marry.vn hay Wayback nữa. Ảnh vendor hỏng hiển thị ảnh minh hoạ tự tạo (T-068)". Sau đó, trong session Cowork 07–08/11, Capu đã làm nguồn ảnh mới (T-104):
- PR đã merge: phungrk/tohong #65 #66 #67 #69; phungrk/tohong-back #40 #41.
- PR chưa merge: phungrk/tohong-front #64.

Kết quả run 2:
- place_id: ok 66/73, gỡ 3.
- 202 trên 1.000 request miễn phí.
- Pool 965 vendor, trong đó 68 có ảnh Google (132 ảnh).

**Quyết định (Capu):**
1. Ảnh vendor lấy từ Google Place Photos, lưu photoUri (`lh3.googleusercontent.com`) vào pool. Không lưu URL `places.googleapis.com`. Hiển thị tốn $0, không lộ key.
2. Làm mới photoUri hàng tháng.
3. Vendor có place_id Google trả 404 thì gỡ khỏi danh sách.
4. Mọi ảnh `source=google` phải mang `attribution` và được ghi công trên app (tohong-front #64).
5. **Giữ T-068 làm dự phòng:** vendor không có ảnh Google, hoặc ảnh hỏng, vẫn hiện ảnh minh hoạ tự tạo.
6. Phần 1 và 3 của ADR-030 giữ nguyên: bỏ lịch kiểm marry.vn; code mirror và ảnh đã tự host giữ nguyên.

**Bất biến:** hai bất biến được rút vào `eval/invariants/planner/vendor/images/`:
- INV-012: pool không chứa URL `places.googleapis.com`.
- INV-013: ảnh `source=google` có attribution.

Hai bất biến này do adversary rút trong Code Gate T-104.

**Xét lại khi:** photoUri hết hạn sớm hơn chu kỳ làm mới; vượt hạn mức miễn phí; vendor tự gửi ảnh (T-070 phương án B).
