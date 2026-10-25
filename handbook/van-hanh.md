# Sổ tay vận hành

## Máy trạng thái của một việc

```
Mới ──start──▶ Đang làm ──handoff──▶ Chờ review ──accept──▶ Xong
                 │  ▲                   │   ▲
           block │  │ unblock    reject │   │ handoff (bản sửa)
                 ▼  │                   ▼   │
               Bị chặn               Rework ──(vòng 3)──▶ Leo thang ──decide──▶ Đang làm / Xong
```

Bất kỳ trạng thái nào chưa Xong đều có thể `escalate` lên Capu khi chạm mức "Hỏi trước".

## Bảng lệnh

| Ai | Lệnh | Khi nào |
| --- | --- | --- |
| Chief of Staff | `task.py new --title … --to … --criteria …` | Capu giao việc |
| Bộ phận | `task.py start T-xxx --by <bộ phận>` | Bắt đầu hoặc bắt đầu sửa |
| Bộ phận | `task.py handoff T-xxx --by <bộ phận> --link handoffs/…` | Làm xong, chuyển review |
| Reviewer | `task.py accept T-xxx --by reviewer` | Mọi tiêu chí đạt |
| Reviewer | `task.py reject T-xxx --by reviewer --against "…" --severity blocker` | Có tiêu chí không đạt |
| Bất kỳ ai | `task.py block T-xxx --by … --note "…"` | Bị chặn |
| Chief of Staff | `task.py escalate T-xxx --by chief-of-staff --note "…"` | Cần Capu quyết |
| Chief of Staff | `task.py decide T-xxx --note "…" [--close]` | Ghi lại quyết định của Capu |
| Bất kỳ ai | `task.py summary` | Đầu mỗi phiên |

## Nhịp vận hành

| Nhịp | Khi nào (giờ Sài Gòn) | Cách chạy | Đầu ra |
| --- | --- | --- | --- |
| Standup sáng | 8:00 thứ Hai–Sáu | Routine `routines/morning-standup.md` | `reports/daily/…-standup.md` |
| Wrap-up chiều | 18:00 thứ Hai–Sáu | Routine `routines/evening-wrapup.md` | `reports/daily/…-wrapup.md` |
| Báo cáo chất lượng | 17:00 thứ Sáu | Routine `routines/weekly-quality.md` | `reports/weekly/…-quality.md` |
| Review tuần | Thứ Bảy | Capu mở một phiên với Chief of Staff | Ưu tiên tuần sau, ghi vào `decisions/` |
| Retro tháng | Thứ Bảy cuối tháng | Capu + Chief of Staff + Reviewer | Sửa `CLAUDE.md`, file agent, mẫu |

## Tuyển thêm bộ phận

1. Tạo `.claude/agents/<tên>.md` theo khuôn của `product.md`: sứ mệnh, cách làm một việc, quyền hạn, KPI. Nếu vị trí đã có trong `org/roster.json`, dashboard tự đổi từ "Need Hiring" sang "Hired"; vị trí mới hoàn toàn thì thêm một dòng vào `org/roster.json`.
2. Thêm tên bộ phận vào mục "Bạn là ai trong phiên này" của `CLAUDE.md`.
3. Giao một việc nhỏ để chạy thử trước khi giao việc thật.

## Thông báo Slack

Workflow `.github/workflows/notify-slack.yml` đọc sổ cái mỗi khi `main` thay đổi và gửi lên Slack:

| Biểu tượng | Sự kiện | Kênh |
| --- | --- | --- |
| 🆕 | Giao việc mới | Chính |
| 📥 | Bàn giao, kèm link pull request nếu có | Chính |
| ↩️ | Reviewer trả về, kèm vòng và lỗi | Chính |
| ✅ | Reviewer chấp nhận; nếu có PR thì báo "PR sẵn sàng để anh merge" | Cần anh |
| ⛔ | Bị chặn | Cần anh |
| 🙋 | Leo thang, cần Capu quyết | Cần anh |
| 🚨 | Agent sửa tay sổ cái | Cần anh |
| 📋 | Báo cáo mới trong `reports/` (standup, wrap-up, chất lượng) | Chính |

Secrets của repo (Settings → Secrets and variables → Actions):

- `SLACK_WEBHOOK_URL` (bắt buộc): Incoming Webhook của kênh chính.
- `SLACK_WEBHOOK_DECISIONS` (tùy chọn): webhook của kênh "cần anh". Không có thì mọi tin vào kênh chính.

Trạng thái "đã báo tới đâu" nằm trên nhánh `notify-state`. Lần chạy đầu chỉ gửi một tin chào, không gửi lại lịch sử cũ.
Chạy thử không gửi: `python3 scripts/notify_slack.py --state /tmp/state --dry-run`.

## Đường truyền realtime

Git là sổ cái gốc nhưng chậm (chỉ lên GitHub khi agent commit). Để dashboard đổi ngay khi việc xảy ra, có thêm một đường truyền trực tiếp:

```
task.py, log_hook.py, activity_hook.py ──POST──▶ Cloudflare Worker tohong-live ──WebSocket──▶ dashboard
```

- `scripts/live.py` gửi trong tiến trình nền, không bao giờ làm chậm hay làm hỏng việc của agent. Thiếu cấu hình thì tự bỏ qua.
- Chỉ phát các trường công khai: không có nội dung defect, ghi chú hay đường dẫn file.
- `scripts/activity_hook.py` (PreToolUse) phát nhịp "đang làm gì" của từng agent, tối đa một nhịp mỗi 10 giây: đọc tài liệu, sửa file, chạy lệnh, tra cứu, giao việc. Không gửi lệnh hay nội dung.
- Mã Worker nằm trong `live/`. Workflow `deploy-live` tự deploy khi `live/` thay đổi.

Cấu hình:

| Ở đâu | Tên | Giá trị |
| --- | --- | --- |
| GitHub Secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Để deploy Worker |
| GitHub Secrets | `TOHONG_LIVE_TOKEN` | Mã bí mật để gửi sự kiện |
| Biến môi trường của môi trường cloud (claude.ai/code) | `TOHONG_LIVE_TOKEN` | Cùng mã ở trên |
| Truy cập mạng của môi trường cloud | domain `tohong-live.<subdomain>.workers.dev` | Cho phép phiên agent gửi tới Worker |
| `.claude/settings.json` → `env` | `TOHONG_LIVE_URL` | `https://tohong-live.<subdomain>.workers.dev` |
