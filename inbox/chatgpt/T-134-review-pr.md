---
task: T-134
type: review-pr
priority: P0
status: done
assigned: 2026-11-12
due: 2026-11-14
source:
  - https://github.com/phungrk/tohong/pull/91
  - https://github.com/phungrk/tohong-back/pull/48
  - https://github.com/phungrk/tohong-front/pull/69
  - board/T-134.md
---

# Giao ChatGPT: review chéo "cú bấm Approve của Capu là quyết định" (3 PR, ký Ed25519)

**Việc:** review chéo ba PR hiện thực spec T-129 v3 (bậc C, Capu merge tohong#91 → back#48 → front#69). Adversary (Claude) đã accept sau 2 vòng (adv-01..05; vòng 1 bắt worker chết trên workerd vì `node:crypto`, OPTIONS route nội bộ, đua ghi khoá Capu, `tee` nuốt mã thoát). Đây là đường biến một cú bấm web thành thay đổi dữ liệu vendor — tìm chỗ Claude cùng mù.

**Đọc:**
- `products/T-129-capu-bam-la-quyet.md` (v3), `handoffs/T-129-D1.md`, `handoffs/T-129-D2.md`
- `handoffs/T-134-v1.md`, `handoffs/T-134-v2.md` (Diff hành vi)
- `decisions/2026-11-12-adr-065-*`, `adr-066-*`, `adr-068-*`, `adr-069-*`
- `eval/T-129/` (check_1..6, capu_decision.py, lib/signing.mjs, inv-proposed-*), `eval/T-134/adv-01..05`, `eval/T-134/gate-latest.json`
- Bất biến `eval/invariants/planner/vendor/images/` (INV-015, INV-020, INV-021, INV-030, INV-031) và `eval/invariants/planner/admin/vendor-enrich/`

**Ưu tiên tìm:** giả danh Capu (token, header, body, CAPU_USER_IDS); route nội bộ `/api/internal/vendor-enrich/export` (khoá máy, method, CORS, cache); chuỗi ký canonical (nhập nhằng, ghép chữ ký, replay, key_id); `apply_admin_reviews.py` có nhánh nào bỏ kiểm chữ ký/quyết định; workflow `apply-admin-reviews.yml` (quyền, secret lộ trong log, PR dựng lại, export trống); INV-020/015 v2 có lỗ nào để agent tự thêm mục.

**Đã biết, không cần báo lại:** phát lại entry đã ký sau khi Rút lại (giới hạn ghi trong spec); `admin_review_keys.json` đang trống cho tới khi Capu tạo khoá; review cũ không `by_capu` hiện "Chờ Capu".

**Tiêu chí hoàn thành:** một comment `[ChatGPT review]` trên **mỗi** PR (ba comment) theo mẫu `handbook/chatgpt.md`; mỗi phát hiện trỏ eval / INV / câu spec hoặc ghi "ngoài spec"; không có gì thì ghi "không phát hiện" kèm những gì đã đọc.

**Đầu ra mong đợi:** comment `[ChatGPT review]` trên tohong#91, tohong-back#48, tohong-front#69.

**Giới hạn:** không sửa sổ cái, `main`, eval, bất biến; không merge, không approve, không đẩy commit lên nhánh PR. Chỉ comment.

**Kết quả (Chief of Staff ghi khi đóng, 2026-11-12):**
1. tohong#91 `load_keys()` không kiểm schema_version/kiểu/độ dài khoá → traceback thay vì `APPLY_REFUSED bad_keys_file` (nhỏ, fail-closed) — **ĐÚNG** (Chief of Staff đọc code xác minh). Sửa ở commit 7991903 trên #91 + 3 test.
2. back#48: không phát hiện — trùng kết luận adversary vòng 2.
3. front#69: không phát hiện — trùng adversary.
KPI: 1/1 phát hiện đúng (nhỏ); không bỏ sót đã biết. Cộng dồn: 3/4 đúng.
