---
type: decision
id: ADR-033
date: 2026-11-07
decided_by: capu (ý định) / chief-of-staff (sửa bất biến)
tasks: [T-090]
---
# Nhân vật mô hình còn 1/2, khối giữ bề ngang, trang PC rộng tối đa 1400px; hạ ngưỡng INV-019 model

**Bối cảnh:** Capu (2026-11-07) "Thu nhỏ kích thước character còn 1/2 và kích thước khối tương ứng trên Mô hình Eval-Gated 2029"; trả lời câu hỏi mở của spec T-090: "giữ kích thước khối đồng thời tăng bề ngang của page trên PC — hiện tại max-width 1200px thì tăng lên max-width 1400px". INV-019 hq/dashboard/model ("nhân vật đủ to", ngưỡng T-035: thân ≥ 62u, ≥ 68px ở 1280, ≥ 19px ở 390) mâu thuẫn trực tiếp với ý định.

**Quyết định:**
1. Nhân vật còn 1/2 (rộng và cao) ở mọi viewport; khối chỉ thấp đi phần nhân vật bớt, bề ngang giữ (chữ không thu nhỏ — INV-033).
2. `.page` max-width 1200px → 1400px trên PC.
3. INV-019: hạ ngưỡng theo đề xuất Product T-090 (thân ≥ 29,7u; ≥ 33px ở 1280; ≥ 9px ở 390), áp khi PR T-090 merge (trước đó bản cũ vẫn xanh trên main). Không đổi phần khác của INV-019.

**Hệ quả:** eval cũ của việc đã đóng (T-031, T-035, T-047) ghi cỡ cũ: không chạy lại, không sửa.
