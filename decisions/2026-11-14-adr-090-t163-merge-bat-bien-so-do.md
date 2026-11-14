---
type: decision
id: ADR-090
date: 2026-11-14
decided_by: chief-of-staff
tasks: [T-162, T-163]
---
# T-163 merge trang (tohong-hq-dashboard#24, bậc A); inv-020/021 vào bể hq/dashboard; inv-022 chờ PR export

1. Adversary accept T-163 v2 (gate 36/36). Chief merge tohong-hq-dashboard#24 theo luật bậc A.
2. Vào bể `eval/invariants/hq/dashboard/` (kèm `lib/roster_luong_inv.cjs`), PASS trên main d7db39a (cần trình duyệt Playwright của môi trường):
   - `inv-020-moi-roster-co-mot-node-luong.sh`: mỗi phần tử roster và `done` có đúng một node, không chồng, trong khung, ở 1200px và 390px.
   - `inv-021-chu-node-theo-nhip-va-viec-giu.sh`: chữ và sprite node theo bảng Hành vi 3 (nhịp → hành động; giữ việc không nhịp → "Đang làm"; còn lại trống), kể cả lọc sản phẩm.
3. `inv-022-roster-xuat-theo-claude-md.py` CHƯA vào bể: nó đo `scripts/export_dashboard.py` đang nằm trong PR "Cần Capu duyệt" của tohong-hq. Vào bể sau khi Capu merge PR đó và nó xanh trên main.
4. Ghi nhận minor (adversary): cắt chữ theo ước lượng ~7px/ký tự; fence chỉ so loại, chưa so độ dài (đúng spec 4(d)); test model.js "Code Gate tắt màu khi dot đi ra" chập chờn có sẵn trên main.
