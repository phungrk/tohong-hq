---
type: decision
id: ADR-022
date: 2026-11-04
decided_by: chief-of-staff (theo ý định Capu, T-054)
tasks: [T-054, T-055]
---
# Cuộn ở cấp document thay khung cao bằng viewport

**Bối cảnh:** Capu muốn Safari iPhone thu gọn thanh địa chỉ và ẩn thanh dưới khi cuộn, như mặc định, mà vẫn giữ hành vi Back (T-027/T-030). Safari chỉ làm vậy khi document cuộn; app đang dùng `.app-frame { height: 100dvh; overflow: hidden }` với khung con cuộn (có từ `ed18f26`, 23/10). Spec T-054 qua Spec Gate v3 (`products/T-054-cuon-cap-trang.md`).

**Quyết định:**
1. Bỏ điều khoản "Không làm: đổi chiều cao khung" của spec T-025. Khung cao theo nội dung, tối thiểu bằng vùng nhìn thấy; document là thứ cuộn. Khung vẫn rộng tối đa `--app-max` 768px.
2. Cơ chế `contain: layout` (khung là containing block của `position: fixed`, `src/index.css:187`) được phép thay. Hành vi giữ nguyên: sheet, scrim, toast rộng đúng bằng khung, chạm ngoài khung đóng lớp trên cùng (layout INV-003/005/006 không đổi).
3. Khối gợi ý cài app (ADR-011) ẩn khi cuộn lên ≥ 8px, hiện khi cuộn xuống ≥ 8px hoặc về đầu trang; scrollY kẹp, kéo quá đà không tính; đổi trang thắng (Capu chọn 2026-11-04: "Ẩn khi cuộn lên").
4. Bất biến mới layout inv-007..009, navigation inv-007 bật khi lịch sử repo front có commit `[T-054]`; bỏ điều kiện này sau khi ship phải qua `decisions/`.

**Hệ quả:** không bất biến cũ nào bị sửa. `nav.js` không đổi. Kiểm Safari thật bằng `eval/T-054/checklist.md` (22 dòng) trên iPhone của Capu.
