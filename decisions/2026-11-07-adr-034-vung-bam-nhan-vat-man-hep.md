---
type: decision
id: ADR-034
date: 2026-11-07
decided_by: chief-of-staff
tasks: [T-095, T-090, T-037]
---
# Vùng bấm nhân vật ở khung nhìn < 360px: lớn nhất có thể, sàn 36px

**Bối cảnh:** T-095 (nhân vật còn 1/2, ADR-033) làm khối thấp đi. Engineering đo (font thật): ở khung 320px, khoảng tối đa cho vùng bấm vừa chứa tâm thân bot, vừa không phủ tâm số đếm khối mình (adv-01), vừa không lấn khối phía trên (adv-05) chỉ còn 39,6px; 330 → 41,4; 340 → 43,0; từ 350 trở lên ≥ 44px (360 → 45,9). Spec T-037 yêu cầu vùng bấm ≥ 44×44px ở khung ≤ 480px. Ba ràng buộc không thể thoả cùng lúc dưới ~350px nếu không dời khối (chạm T-090 tiêu chí 2.3, inv-006/019/033).

**Quyết định:**
1. Khung ≥ 360px: giữ nguyên T-037 — vùng bấm ≥ 44×44px.
2. Khung < 360px: vùng bấm cao bằng khoảng lớn nhất không phủ số đếm khối mình và không lấn khối khác, không dưới 36px; rộng ≥ 44px. Ưu tiên đúng thứ bấm (số mở đúng thứ, khối trên không mở nhầm) hơn cỡ 44px ở màn rất hẹp. 36px vẫn trên mức tối thiểu 24px của WCAG 2.2 (2.5.8).
3. Không dời khối hay nhân vật cho riêng màn hẹp.

**Hệ quả:** eval T-037 chỉ đo vùng bấm ở 390 nên không đổi. adv-01 và adv-05 của T-095 thành bất biến model sau merge (inv-035, inv-036).
