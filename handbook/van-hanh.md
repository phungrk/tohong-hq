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

1. Tạo `.claude/agents/<tên>.md` theo khuôn của `product.md`: sứ mệnh, cách làm một việc, quyền hạn, KPI.
2. Thêm tên bộ phận vào mục "Bạn là ai trong phiên này" của `CLAUDE.md`.
3. Giao một việc nhỏ để chạy thử trước khi giao việc thật.
