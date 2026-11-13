---
type: decision
id: ADR-080
date: 2026-11-13
decided_by: capu
tasks: [T-145]
---
# Dashboard công khai đọc dashboard.json từ repo tohong-hq-dashboard (tohong-hq đã private)

**Bối cảnh:** Capu đã chuyển phungrk/tohong-hq sang private. Trang https://phungrk.github.io/tohong-hq-dashboard/ đọc `https://raw.githubusercontent.com/phungrk/tohong-hq/dashboard-data/dashboard.json` (index.html dòng 436) nên không còn tải được dữ liệu. Riêng đường realtime tohong-live đứng từ 7/11 vì phiên mở ở thư mục cha không nạp `.claude/settings.json` — đã sửa trong scripts/live.py + activity_hook.py và gửi bù 504 sự kiện.

**Quyết định (Capu chọn A, 2026-11-13):** Giữ dashboard công khai. Workflow `publish-dashboard-data.yml` đẩy thêm bản công khai `dashboard.json` (như hiện nay, `export_dashboard.py --public`) sang nhánh `dashboard-data` của repo công khai `phungrk/tohong-hq-dashboard` bằng secret `DASHBOARD_DATA_TOKEN` (Capu tự tạo: fine-grained, Contents read/write chỉ trên tohong-hq-dashboard). Trang đổi DATA_URL sang nhánh đó. Thiếu secret thì workflow vẫn xanh, chỉ cảnh báo. Không đẩy vào nhánh main của repo dashboard (tránh dựng lại Pages mỗi lần sổ cái đổi).
