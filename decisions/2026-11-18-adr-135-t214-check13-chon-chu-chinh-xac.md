# ADR-135: T-214: check_13 chập chờn vì bộ chọn chữ không chính xác; sửa bộ chọn, không tính spec rework

Ngày: 2026-11-18 · Người quyết: Chief of Staff · Việc: T-211 (spec) / T-214 (code)

## Bối cảnh
Adversary trả T-214 với `--kind spec`, chỉ vào `eval/T-211/check_13_giao_dien_hop_ket_noi.sh`. Trong khoảng 30 lần chạy, check_13 đỏ 2 lần.

Nguyên nhân: `eval/T-211/check_ui.mjs` (ca 2) chờ bằng `page.getByText("Liên hệ vendor")` mà không đặt `exact`. Playwright khi đó khớp theo chuỗi con, không phân biệt hoa thường. Nó trúng cả chip "Đã liên hệ vendor" và nút `Sang “Đã liên hệ vendor” →`, hai chỗ này đã có sẵn trên main. Kết quả là lúc thì không chờ panel, lúc thì lỗi strict mode.

## Quyết định
- Đây là lỗi dựng eval, cùng loại với ADR-128 và ADR-132. Không phải cách hiểu thứ hai. Spec giữ nguyên, không respec, không tính vòng spec rework.
- Chief sửa hai chỗ chờ thành `getByText("Liên hệ vendor", { exact: true })`. Điều kiện kiểm không đổi.
- Kiểm lại:
  - Trên PR (worktree /tmp/t214-back, /tmp/t214-front), check_13 PASS 12/12 lần.
  - Trên main vẫn FAIL đúng lý do: 400 `field_not_editable`.
- Minor gửi Engineering, cùng PR: test_admin.js dòng ~1096 phải kiểm cả hai số điện thoại mẫu, không chỉ số của vendor bị ẩn.
