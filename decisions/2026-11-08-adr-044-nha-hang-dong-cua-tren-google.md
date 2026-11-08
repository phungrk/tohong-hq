---
type: decision
id: ADR-044
date: 2026-11-08
decided_by: chief-of-staff
tasks: [T-106, T-108]
---
# Vendor khớp Google nhưng `businessStatus` đóng cửa: xử lý như thế nào

**Bối cảnh:** Code Gate T-108 (adversary, adv-01) tìm ra ca spec T-106 không nói: Google trả nhà hàng khớp tên và địa chỉ
nhưng `businessStatus` = `CLOSED_PERMANENTLY` hoặc `CLOSED_TEMPORARILY`. Code hiện ghi `status=business_closed`, không
`place_id`, không `formatted_address`, và đặt vendor deprecated — vừa lệch spec (ứng viên được nhận phải có `place_id`),
vừa là quyết định sản phẩm chưa ai chốt.

**Quyết định (Chief of Staff, theo tinh thần quyết định của Capu 2026-11-08 "vendor không tồn tại thì gỡ khỏi danh sách"):**
1. `CLOSED_PERMANENTLY` → xử lý **giống place_id 404** của spec 005: gỡ vendor khỏi `vendors.json`, lưu bản ghi vào
   `removed_vendors.json` cùng thư mục (khôi phục được), audit ghi `status=closed_permanently` kèm `place_id` và
   `formatted_address`. Không vào pool, không vào review (không có gì để Capu so).
2. `CLOSED_TEMPORARILY` → nhà hàng vẫn tồn tại: **nhận khớp bình thường** (`place_id`, ảnh, `formatted_address`, status
   `ok`/`enriched`), thêm flag `temporarily_closed` vào vendor để UI có thể hiện nhãn sau (ngoài phạm vi T-108).
3. Spec T-106 Hành vi 1 "không vendor nào biến mất trừ 404" đọc là "trừ 404 **hoặc** `CLOSED_PERMANENTLY`"; product cập
   nhật một dòng khi có dịp sửa spec, không mở spec rework riêng.

**Vì sao không hỏi Capu:** đảo ngược được (file removed_vendors.json), không chạm tiền, cùng hướng với quyết định Capu đã
đưa cho ca 404. Capu đọc lại khi duyệt diff hành vi T-108 (bậc C); không đồng ý thì sửa ở vòng đó.

**Xét lại khi:** có dữ liệu cho thấy Google đánh dấu đóng cửa sai với nhà hàng tiệc cưới (hay đóng theo mùa).
