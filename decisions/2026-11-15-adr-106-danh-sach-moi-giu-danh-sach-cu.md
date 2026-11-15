---
type: decision
id: ADR-106
date: 2026-11-15
decided_by: capu
tasks: [T-171, T-174, T-179]
---
# Đổi dự toán: in danh sách vendor MỚI, giữ nguyên danh sách cũ (đảo H1/H4 T-171 về cập nhật tại chỗ)

Capu (2026-11-15, trả lời câu mở T-171): "mỗi lần số dự toán đổi so với lần trước, danh sách vendor mở bằng nút 'Tìm vendor' phải lấy lại danh sách mới, không cần tải lại trang và danh sách mới sẽ được in lại chứ không phải thay đổi lại nội dung danh sách cũ. Nội dung danh sách cũ vẫn giữ nguyên."

Hệ quả:
- T-174 (đã merge, cập nhật thẻ cũ tại chỗ) đổi hướng: danh sách cũ đóng băng nội dung; danh sách mới in thêm khi dự toán đổi so với danh sách gần nhất. Việc cài: T-179.
- Bất biến `planner/vendor/matching/inv-006-the-ghep-khong-hien-diem-cu.sh` ("thẻ ghép không hiện điểm tính trên dự toán cũ hơn bản đã lưu") mâu thuẫn với quyết định này cho thẻ cũ. Chief sẽ sửa/thay bất biến theo spec T-179 khi spec qua Spec Gate (ghi ADR khi đổi), không sửa trước để khớp code.
- Các phần T-174 vẫn giữ: báo lỗi lưu dự toán, ghi lại sau lỗi không xoá khoản (planner/front/budget/inv-005), back H7/H8.
