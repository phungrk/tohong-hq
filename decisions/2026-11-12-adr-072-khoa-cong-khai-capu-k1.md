---
type: decision
id: ADR-072
date: 2026-11-12
decided_by: capu
tasks: [T-129, T-134]
capu_signing_keys: k1=BJILwN9hUFjcLR7yHiX8yWKcjiAqDX/rrhL1TbeeZDY=
---
# Khoá công khai Ed25519 của Capu (k1) cho cú bấm trên admin enrich; thay INV-020/015 bản v2

**Capu, 2026-11-12:** tự sinh cặp khoá Ed25519 trên máy (Node `crypto.generateKeyPairSync('ed25519')`), gửi Chief of Staff đúng khoá công khai `k1` ở trên (32 byte base64). Khoá bí mật `ENRICH_SIGNING_KEY` chỉ Capu giữ và đặt ở Worker cùng `ENRICH_SIGNING_KEY_ID=k1`; không bao giờ vào repo.

**Hiệu lực (ADR-065, ADR-066, spec T-129 v3):**
1. Mục `manual_overrides.json` với `decision = admin-review:…` hợp lệ khi chữ ký Ed25519 kiểm được bằng khoá trong dòng `capu_signing_keys` của file này (hoặc ADR `decided_by: capu` sau thay thế). Nguồn (A) cũ (`decisions/*.md` có `decided_by: capu`) giữ nguyên.
2. INV-020 và INV-015 trong `eval/invariants/planner/vendor/images/` thay bằng bản v2 (`eval/T-129/inv-proposed-*`), định nghĩa chữ ký chuẩn ở `eval/lib/capu_decision.py`. Bản v2 xanh trên main hiện tại (chỉ có nguồn A).
3. `tools/scraper/admin_review_keys.json` ở tohong phải chỉ chứa khoá có trong ADR này (INV-020 v2 kiểm).
4. Xoay khoá: thêm `k2=` vào một ADR `decided_by: capu` mới, giữ `k1` cho tới khi mọi mục cũ đã áp. Khoá bí mật lộ: Capu quyết bằng ADR riêng.

**Clerk user id của Capu** không ghi vào repo; Capu đặt ở Worker biến `CAPU_USER_IDS`.
