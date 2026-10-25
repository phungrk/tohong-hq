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
| Chief of Staff | `task.py cost [T-xxx] --by <agent> --cost <USD> --note "<nguồn>" [--adjusts E-xxxx]` | Ghi tay hoặc điều chỉnh chi phí; không đổi trạng thái việc |

## Chi phí: tính từ token thật

Chi phí trong sổ cái là tiền đã tiêu, đo từ usage token mà API trả về, không do agent tự khai. Hook gọi `scripts/cost.py hook` (cấu hình ở `.claude/settings.json`):

| Hook | Tính gì | Ghi cho |
| --- | --- | --- |
| `SubagentStop` | Transcript của subagent vừa xong (`agent_transcript_path`) | `agent_type` (vd `engineering`), task = mã `T-xxx` đầu tiên trong lời giao việc; không có thì task rỗng |
| `Stop`, `SessionEnd` | Phần tăng thêm của transcript phiên chính (`transcript_path`), rồi quét `subagents/` của phiên để bắt phần còn sót | `chief-of-staff`, task rỗng |

Cách tính một sự kiện:

1. Đọc transcript (JSONL). Mỗi lượt gọi API có một `message.id`, ghi thành nhiều dòng cùng `usage`: gộp theo `message.id`. Tin `<synthetic>` (usage 0) bỏ qua.
2. Tiền mỗi lượt = input × giá input + output × giá output + cache đọc × giá cache hit + cache ghi 5 phút × giá ghi 5m + cache ghi 1 giờ × giá ghi 1h (theo `usage.cache_creation`), tất cả theo đúng `message.model`. `inference_geo: us` nhân 1.1; `speed: fast` dùng giá fast; web search $10/1.000 lượt.
3. Giá nằm trong `scripts/pricing.json`, có nguồn (trang Pricing chính thức của Anthropic) và ngày kiểm. Model không có trong bảng: phần đó tính $0 nhưng sự kiện mang `severity: warning` và ghi rõ model lạ, số token. Khi Anthropic đổi giá hoặc dùng model mới: sửa file này, cập nhật `checked`.
4. Không đếm trùng: phiên chính và mỗi subagent nằm ở file transcript riêng. Mỗi sự kiện chi phí mang con trỏ `src = {session, agent, msgs, last}`; lần sau chỉ tính các tin sau tin `last`. Con trỏ nằm trong chính `ledger/events.jsonl`, nên phiên bị dừng hay mở lại không làm đếm lại. Con trỏ không khớp transcript thì không tính, ghi cảnh báo.
5. Sự kiện: `event: cost`, `from = to = <agent>` (dashboard cộng theo `from`; `from == to` nên không vẽ thành luồng bàn giao), không có `state`/`holder` (không đụng trạng thái việc), cost làm tròn 4 chữ số. Có mã việc thì cộng vào trường `cost` của `board/T-xxx.md` qua script.
6. Hook không bao giờ chặn agent: không in gì ra stdout, luôn thoát mã 0. Lỗi thì ghi `event: cost_warning` (cost 0, mỗi nội dung một lần mỗi phiên) rồi bỏ qua.

Giới hạn đã biết:

- Transcript ghi không đồng bộ, lượt cuối có thể chưa có lúc hook chạy; lần `Stop`/`SessionEnd` sau sẽ tính bù. Lượt cuối cùng của một phiên bị tắt đột ngột (không có `SessionEnd`) có thể không được ghi.
- Chỉ chạy khi phiên mở ở thư mục repo (`/home/user/tohong-hq`). Phiên mở ở `/home/user` không nạp `.claude/settings.json`, hook không chạy; khi đó ghi bù bằng `python3 scripts/cost.py sync <transcript phiên chính .jsonl>` (cùng con trỏ, chạy lại không đếm trùng).
- Đối chiếu: Claude Code ghi dòng `cost-state` (`totalCostUSD`, `modelUsage`) vào transcript phiên chính; tổng theo `cost.py` phải khớp số đó tại cùng thời điểm. Xem nhanh không ghi gì: `python3 scripts/cost.py report <file.jsonl>...`.
- `--cost` trên các lệnh `task.py` khác vẫn còn để tương thích, nhưng không dùng để khai chi phí token nữa (sẽ đếm trùng với hook). Ngân sách ghi bằng `--budget`.

## Nhịp vận hành

| Nhịp | Khi nào (giờ Sài Gòn) | Cách chạy | Đầu ra |
| --- | --- | --- | --- |
| Standup sáng | 8:00 thứ Hai–Sáu | Routine `routines/morning-standup.md` | `reports/daily/…-standup.md` |
| Wrap-up chiều | 18:00 thứ Hai–Sáu | Routine `routines/evening-wrapup.md` | `reports/daily/…-wrapup.md` |
| Báo cáo chất lượng | 17:00 thứ Sáu | Routine `routines/weekly-quality.md` | `reports/weekly/…-quality.md` |
| Review tuần | Thứ Bảy | Capu mở một phiên với Chief of Staff | Ưu tiên tuần sau, ghi vào `decisions/` |
| Retro tháng | Thứ Bảy cuối tháng | Capu + Chief of Staff + Reviewer | Sửa `CLAUDE.md`, file agent, mẫu |

## Model của từng bộ phận

| Bộ phận | Model | Lý do |
| --- | --- | --- |
| Chief of Staff (phiên chính) | Capu chọn khi mở phiên | Không đặt bằng file |
| `reviewer` | `opus` | Người gác cổng cuối cùng, cần kiểm kỹ nhất |
| `product`, `engineering` | `sonnet` | Ưu tiên chi phí; đã có reviewer gác chất lượng |

- Đặt bằng dòng `model:` trong frontmatter của `.claude/agents/<tên>.md`. Dùng alias (`sonnet`, `opus`, `haiku`) để tự lên bản mới nhất; cần ghim cố định thì ghi ID đầy đủ, vd `claude-opus-5-5`. Ghi `inherit` để dùng model của phiên chính. Nguồn: https://code.claude.com/docs/en/sub-agents (mục "Choose a model").
- Cách đổi: sửa dòng `model:` đó; vì đây là file trong `.claude/`, workflow sẽ mở PR để Capu duyệt.
- Thứ tự ưu tiên của Claude Code: tham số `model` truyền lúc gọi subagent thắng frontmatter. Chief of Staff không truyền `model` khi giao việc, trừ khi Capu yêu cầu.

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
- `python3 scripts/live.py --done T-xxx` gửi nhịp `status: done` của Chief of Staff: dashboard tắt sáng node và hiện "Task [tên] đã hoàn thành"; Worker giữ thông báo này 10 phút, nhịp mới của agent sẽ ghi đè.
- Mã Worker nằm trong `live/`. Workflow `deploy-live` tự deploy khi `live/` thay đổi.

Cấu hình:

| Ở đâu | Tên | Giá trị |
| --- | --- | --- |
| GitHub Secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Để deploy Worker |
| GitHub Secrets | `TOHONG_LIVE_TOKEN` | Mã bí mật để gửi sự kiện |
| Network secret của môi trường cloud (claude.ai/code) | host `tohong-live.phungnc.workers.dev`, header `Authorization`, prefix `Bearer` | Cùng mã ở trên. Proxy tự gắn mã, agent không thấy mã, không cần mở thêm domain |
| (Dự phòng nếu không dùng được Network secret) | biến `TOHONG_LIVE_TOKEN` + Network access **Custom** có domain trên | Agent đọc được biến này |
| `.claude/settings.json` → `env` | `TOHONG_LIVE_URL` | `https://tohong-live.phungnc.workers.dev` |
