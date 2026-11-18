# ADR-125: T-202 merged, deploy back giữ biến dashboard (keep_vars)

Ngày: 2026-11-18 · Người quyết: Capu (merge), Chief of Staff (thực hiện) · Việc: T-201 (spec), T-202 (code)

## Bối cảnh
Sau khi merge T-199, cờ ADMIN_OPEN đặt trên dashboard Cloudflare bị mất (admin trả 403). Lý do nghi là `wrangler deploy` ghi đè biến theo `[vars]` (tự tin ~75%, chưa kiểm trên Cloudflare). Capu: "thêm một dòng cấu hình để deploy giữ lại biến admin_open".

## Quyết định
- Thêm `keep_vars = true` ở cấp gốc `wrangler.toml` tohong-back (PR phungrk/tohong-back#68, squash 703e726).
- Bậc C. Capu cho phép rõ ràng: "Hãy merge pr 68 đi". Chief merge sau khi qua Spec Gate (spec-critic), Code Gate (adversary accept, gate GREEN 19/19), PR sạch xung đột.
- Bất biến đưa vào bể `eval/invariants/planner/admin/`:
  - inv-005-deploy-khong-ghi-de-admin-open.py: rút từ spec-critic.
  - inv-006-deploy-that-giu-bien-dashboard.py: từ T-202 adv-01, chạy wrangler deploy thật vào API giả.

  Cả hai PASS trên main mới, kiểm bằng `env -i` từ /tmp.

## Diff hành vi
- Deploy không còn xoá biến hay secret đặt trên dashboard. ADMIN_OPEN=1 còn bật tới khi Capu tự tắt.
- Bỏ một khoá khỏi `[vars]` không còn xoá nó trên Cloudflare.

## Nợ
- check_3 của T-201 chụp danh sách 11 khoá `[vars]`. Không đưa vào bể, vì sẽ chặn những lần đổi biến hợp lệ về sau.
- Lệnh gate mẫu trong file agent adversary có `--cwd`. Với các việc dùng TOHONG_BACK_REPO, `--cwd` gây RED giả. Cần sửa file agent (qua PR).
