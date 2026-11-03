# ADR-020 · gate.py chạy lệnh có tham số; eval đọc PR qua REST

**Ngày:** 2026-11-03 · **Người quyết:** Chief of Staff · **Trạng thái:** đã chốt · **Việc:** T-049

## Bối cảnh

T-049 bàn giao với gate RED chỉ vì dòng eval thứ 6 (`cd /home/user/tohong-hq && D3=... bash eval/T-047/pr-body.sh`):

1. `scripts/gate.py` `classify()` xếp mọi chuỗi kết thúc bằng `.sh` vào loại "đường dẫn file", nên chạy `bash /home/user/tohong-hq/cd ...` và FAIL với mọi code.
2. `eval/T-047/pr-body.sh` đọc PR bằng `gh pr view` (GraphQL), phiên cloud trả HTTP 403.
3. Mô tả PR ghi bằng REST qua `gh` mất ký tự `!`; ghi lại bằng công cụ GitHub MCP thì giữ nguyên.

Cả ba là lỗi công cụ đo, không phải lỗi code hay tiêu chí.

## Quyết định

1. `classify()`: chuỗi có khoảng trắng luôn là lệnh shell (`cmd`). Chuỗi một từ giữ cách xếp cũ. File ngoài sổ cái → workflow mở PR cho Capu duyệt.
2. `pr-body.sh`: lấy mô tả qua REST (`gh api repos/.../pulls/<n>` hoặc `pulls?head=phungrk:<nhánh>`). Tiêu chí không đổi: vẫn đòi đủ 6 ảnh `![..](..)`; đã kiểm file không có ảnh vẫn FAIL. Cùng lỗi ở `eval/T-048/check_pr.py` (T-050): đổi sang `gh api repos/phungrk/tohong-front/pulls...`, tiêu chí không đổi; PR #57 PASS, PR #56 (không có ảnh T-048) vẫn FAIL.
3. Mô tả PR có ảnh nhúng: ghi bằng công cụ GitHub MCP (`update_pull_request`), không qua `gh api -f body=`. Ghi vào mẫu bàn giao của Engineering ở lần sửa file agent sau.

## Hệ quả

- Eval sau này viết lệnh có `cd ... &&` không còn bị xếp nhầm.
- Eval đọc GitHub phải dùng REST; spec mới nào gọi `gh pr view` sẽ bị Spec Gate trả.
