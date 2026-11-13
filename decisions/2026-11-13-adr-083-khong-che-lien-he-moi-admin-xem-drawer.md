---
type: decision
id: ADR-083
date: 2026-11-13
decided_by: capu
tasks: [T-147, T-148, T-149, T-150]
---
# Không che liên hệ trong dữ liệu vendor; mọi admin xem được drawer enrich

**Capu trả lời (2026-11-13):**
1. "không che số điện thoại và link": số điện thoại, URL, zalo nằm trong `description` (81/69 vendor) và `marry.address` giữ nguyên như vendor tự công bố trên marry.vn. T-148 đóng, không làm. Bất biến `planner/admin/vendor-enrich/inv-007` (báo cáo không mang KHOÁ liên hệ/địa chỉ trong pool_input) vẫn giữ — nó đo cấu trúc dữ liệu drawer, không đo nội dung chữ.
2. "drawer: ai là admin thì đều xem được": route chi tiết drawer đổi từ chỉ Capu (ADMIN_USER_IDS ∩ CAPU_USER_IDS) sang mọi platform admin (ADMIN_USER_IDS), giống các route admin khác. Approve/xuất ký Ed25519 vẫn chỉ Capu (T-129, không đổi). Làm ở T-150 — chạm auth nên bậc C, Capu merge.
3. "thêm nhãn lý do: ok": field_notes thêm `reviews` (2 vendor lệch chưa có nhãn) — T-150.
4. "sửa 2 câu chữ: ok": câu "tay cầm > 560px" và "chỉ có hai tệp nguồn" trong spec T-147 — T-150.
