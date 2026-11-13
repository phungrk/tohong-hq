---
task: T-138
type: review-pr
priority: P1
status: open
assigned: 2026-11-13
due: 2026-11-15
source:
  - https://github.com/phungrk/tohong/pull/94
  - https://github.com/phungrk/tohong-back/pull/50
  - board/T-138.md
  - products/T-136-chat-vendor-theo-pool.md
---

# Giao ChatGPT: review chéo T-138 (chat chỉ đề xuất vendor trong pool + đồng bộ dữ liệu matcher)

**Việc:** Review chéo hai PR bậc C trước khi Capu merge; adversary đã accept.

**Đọc:** spec `products/T-136-chat-vendor-theo-pool.md` (v3), `handoffs/T-138-v2.md` (Diff hành vi), eval `eval/T-136/` + `eval/T-138/adv-01-*`, `eval/T-138/gate-latest.json`, bất biến `eval/invariants/planner/vendor/images/`, note accept trong `board/T-138.md`.

**Tiêu chí hoàn thành:**
- Mỗi PR một comment `[ChatGPT review]` theo mẫu `handbook/chatgpt.md`.
- Đặc biệt xem: workflow `sync-matcher-vendors.yml` (ghi GCS + Cloud Run revision — có đường nào ghi đè bucket bằng file lệch pool không); câu prompt A9 trong `lib/prompts.js`; `lib/poolFilter.js` với input lạ.

**Đầu ra mong đợi:** comment `[ChatGPT review]` trên tohong#94 và tohong-back#50.

**Giới hạn:** không sửa sổ cái, `main`, eval, bất biến; không merge, không chạy workflow. Bậc C: Capu tự quyết khi merge, review không chặn cổng.

**Kết quả (Chief of Staff ghi khi đóng):**
