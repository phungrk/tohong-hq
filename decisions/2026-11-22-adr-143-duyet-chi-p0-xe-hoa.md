# ADR-143: Capu duyệt chi lần chạy thật P0 xe hoa

Ngày: 2026-11-22 · Người quyết: Capu · Ghi bởi: Chief of Staff · Việc: T-219 / T-220 · Issue: phungrk/tohong#113

Capu: "đã merge PR 114, duyệt chi P0 xe hoa". Capu đã merge PR phungrk/tohong#114 (de98513).

Chief chạy `discover-vendors-p0.yml` một lần với `dry_run=false`, `stage=measure`, giữ các trần mặc định:

| Trần | Giá trị |
| --- | --- |
| Text Search | 288 lượt |
| Place Details | 120 lượt |
| Gemini | 100 lượt |
| USD net luỹ kế tháng | 3,00 |

`cap_basis` net, model `gemini-3-flash-preview`.

Kỳ vọng khoảng 1 USD net (đoán, tự tin ~50%). Chi thật ghi theo `GOOGLE_USAGE`/`GEMINI_USAGE` của lần chạy.

Sau lần chạy:
- Merge sớm PR `discover-p0/run-<id>`. Khi PR này còn mở, `OPEN_DATA_PR` chặn các workflow Google khác.
- Capu soát 30 mẫu trong 14 ngày. Chỉ commit 3 cột nhãn lên main.
