# Spec T-201: Deploy back giữ biến đặt trên dashboard (keep_vars)

## Ý định
Capu: "thêm một dòng cấu hình để deploy giữ lại biến admin_open". Mỗi lần `wrangler deploy` (qua deploy.yml) không được xoá biến Capu đặt tay trên Cloudflare dashboard, nhất là ADMIN_OPEN.

## Bằng chứng
- Nghi vấn trong brief `board/T-201.md`: merge T-199 lúc 15:36 UTC 17/11 chạy deploy, ghi đè vars theo [vars], ADMIN_OPEN mất, 403 từ đó. Chưa kiểm trên Cloudflare: GIẢ ĐỊNH, tự tin ~75%.
- `wrangler` trong tohong-back có đọc `keep_vars` ở cấp gốc cấu hình (`node_modules/wrangler/wrangler-dist/cli.js`, `keepVars: args.keepVars || config.keep_vars`).

## Giả thuyết
Nếu đặt `keep_vars = true` thì deploy sau không xoá ADMIN_OPEN Capu đã đặt. Chỉ số bảo vệ: giá trị [vars] hiện có không đổi; mặc định TẮT của ADMIN_OPEN (ADR-116) không bị bật bởi file.

## Hành vi (người dùng thấy gì)
- Sau thay đổi, `wrangler.toml` của tohong-back có đúng một dòng mới `keep_vars = true` ở cấp gốc (trước mọi `[section]`, ví dụ ngay sau `compatibility_date`).
- Khi deploy, biến đặt trên dashboard mà KHÔNG có tên trong [vars] (như ADMIN_OPEN) được giữ.
- Lưu ý: biến dashboard TRÙNG TÊN với một khoá trong [vars] vẫn bị giá trị trong toml ghi đè; `keep_vars` chỉ giữ biến không có trong toml. Vì vậy ADMIN_OPEN không bao giờ được thêm vào [vars].
- Không file nào trong tohong-back đặt ADMIN_OPEN (wrangler*.toml, .dev.vars*, .env*, package.json, .github/**, scripts/**). Đọc `env.ADMIN_OPEN` trong code là không đổi.
- 11 khoá [vars] hiện có giữ nguyên tên và giá trị, không thêm khoá.
- `npx wrangler deploy --dry-run` vẫn thoát 0.

## Ràng buộc (vòi)
- Repo: `tohong-back` · Nhánh: `t-201-keep-vars` · Vùng: `planner/admin`
- Bất biến đã đọc: `eval/invariants/_shared/`, `eval/invariants/planner/admin/` (inv-001..004) — spec không vi phạm INV nào; inv-004 phải còn xanh.
- Không chạm: logic adminAuth, secret, deploy.yml (trừ khi bắt buộc), `[vars]`.
- Bậc đề xuất: C theo brief (cấu hình deploy tác động production, chạm cờ admin) — giữ C.

## Tiêu chí chấp nhận và eval
Một tiêu chí của brief, chia bốn vế, mỗi vế một eval (chạy từ gốc tohong-hq; repo qua `TOHONG_BACK_REPO`, mặc định `/home/user/tohong-back`):
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1a | `keep_vars` là boolean `true` ở cấp gốc wrangler.toml, không nằm trong bảng con | `python3 -I eval/T-201/check_1_keep_vars_cap_goc.py` |
| 1b | Không file cấu hình/workflow/script nào đặt ADMIN_OPEN; inv-004 xanh | `python3 -I eval/T-201/check_2_khong_dat_admin_open.py` |
| 1c | [vars] y hệt bản chụp trước thay đổi (11 khoá) | `python3 -I eval/T-201/check_3_vars_giu_nguyen.py` |
| 1d | `wrangler deploy --dry-run` offline thoát 0, không cảnh báo về keep_vars | `python3 -I eval/T-201/check_4_dry_run.py` |

1b-1d đòi thêm `keep_vars = true` có mặt (nếu không FAIL) để cả bốn đỏ trước thay đổi. Eval không kiểm hành vi Cloudflare thật (cần deploy thật, ngoài phạm vi); việc Capu xác nhận ADMIN_OPEN còn sau deploy đầu tiên là bước tay, ngoài eval.

## Bất biến đề xuất (tầng 2)
`planner/admin`: `wrangler.toml` có `keep_vars = true` ở cấp gốc (chống tái phát xoá biến dashboard) — viết được từ check_1.

## Không làm
Không đặt/bật biến hay secret; không đổi adminAuth; không đổi [vars]; không đổi deploy.yml ngoài mức cần.

## Câu hỏi mở
Không. (Capu cần tự đặt lại ADMIN_OPEN trên dashboard nếu đã mất; đó là thao tác tay ngoài spec.)
