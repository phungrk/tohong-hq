# Tơ Hồng HQ

Trụ sở của công ty Tơ Hồng AI: một người (Capu, CEO) và các agent AI, vận hành trên Claude Code in the cloud.

- `CLAUDE.md` — hiến pháp công ty. Phiên chính đóng vai Chief of Staff.
- `.claude/agents/` — các bộ phận: `product`, `reviewer`.
- `board/` — mỗi việc một file. Trạng thái chỉ đổi bằng `scripts/task.py`.
- `ledger/events.jsonl` — nhật ký sự kiện, nguồn dữ liệu cho dashboard.
- `handbook/van-hanh.md` — máy trạng thái, bảng lệnh, nhịp vận hành.
- `templates/` — 5 mẫu thông điệp.
- `routines/` — prompt cho các Routine chạy theo lịch.

## Bắt đầu

1. Đẩy repo này lên GitHub (private) và cài Claude GitHub App cho repo.
2. Mở claude.ai/code, chọn repo `tohong-hq`, nói với Chief of Staff việc đầu tiên.
3. Tạo 3 Routine theo các file trong `routines/`.

## Xem tình hình nhanh

```bash
python3 scripts/task.py summary
python3 scripts/task.py list --state review
```
