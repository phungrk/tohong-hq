---
task: T-139
type: review-pr
priority: P1
status: open
assigned: 2026-11-13
due: 2026-11-15
source:
  - https://github.com/phungrk/tohong-back/pull/51
  - https://github.com/phungrk/tohong/pull/95
  - board/T-139.md
  - products/T-135-resolve-tu-chay-pool-o-back.md
---

# Giao ChatGPT: review chéo T-139 (resolve tự chạy sau merge PR duyệt tay, cổng hạn mức Google, PR pool ở back)

**Việc:** Review chéo hai PR bậc C trước khi Capu merge; adversary đã accept.

**Đọc:** spec `products/T-135-resolve-tu-chay-pool-o-back.md` (v3), `handoffs/T-139-v2.md` (Diff hành vi), eval `eval/T-135/` + `eval/T-139/adv-*`, `eval/T-139/gate-latest.json`, bất biến `eval/invariants/planner/vendor/images/`, note accept trong `board/T-139.md`.

**Tiêu chí hoàn thành:**
- Mỗi PR một comment `[ChatGPT review]` theo mẫu `handbook/chatgpt.md`.
- Đặc biệt xem: mọi đường gọi Google trên luồng tự động có qua bước "Cổng: hạn mức" (plan_batch.py) không; run-name REAL/DRY khớp với lần thật gọi Google; quyền token mới; sync-vendor-pool.yml ở back.

**Đầu ra mong đợi:** comment `[ChatGPT review]` trên tohong-back#51 và tohong#95.

**Giới hạn:** không sửa sổ cái, `main`, eval, bất biến; không merge, không chạy workflow. Bậc C: Capu tự quyết khi merge, review không chặn cổng.

**Kết quả (Chief of Staff ghi khi đóng):**
