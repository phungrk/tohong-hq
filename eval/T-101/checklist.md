# T-101 tiêu chí 7: thử thật trong phiên cloud (checklist, vì cần một phiên Claude Code thật; không dựng được trong máy)

Làm sau khi PR của Engineering được Capu duyệt và `cost.py install-hook` đã chạy trong môi trường cloud. Mở phiên mới ở `/home/user` (không phải tohong-hq).

- [ ] Chạy `grep -c '"event": "cost"' ledger/events.jsonl`, ghi số N. Gọi một subagent bất kỳ (vd `insight`) giao việc có mã T-101, đợi nó xong. Chạy lại lệnh: số là N+1 (không N, không N+2). Cách xem: sự kiện mới nhất có `from` là tên subagent và `src.agent` là agent_id của nó.
- [ ] Kết thúc lượt chính (Stop). Số sự kiện tăng đúng 1 (phiên chính, `src.agent` = "main"), không thêm sự kiện cho subagent đã ghi ở bước trước.
- [ ] `python3 scripts/cost.py backfill <mã phiên này> --dry-run` in `PENDING msgs=0 usd=0.0000` và thoát 0.
- [ ] `python3 scripts/cost.py backfill 86243faa-8dbf-5631-b32b-051ad4d92b1e` (phiên đã mất cost) ghi phần thiếu; chạy lại thì `--dry-run` in `PENDING msgs=0`.
