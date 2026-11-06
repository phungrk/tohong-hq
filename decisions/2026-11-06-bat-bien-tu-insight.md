# Bất biến mới từ Insight — 2026-11-06

- `eval/invariants/hq/dashboard/inv-014-issue-tu-do-khong-sinh-link-sai.py` — bắt lỗi `export_dashboard.py --public` sinh link Issue sai hoặc dừng khi trường `issue` trong board mang giá trị độc hại (nháy lẻ, `0`, `#12`, chữ số Ả Rập, URL…). Áp cho vùng `hq/dashboard`. Nguồn: T-063/adv-03 và T-086/adv-01. Mở: ca U+00A0 cuối giá trị chưa kiểm vì spec T-081 chưa chốt, cần Spec Writer chốt.
