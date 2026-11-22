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

## Bổ sung (2026-11-22): lần chạy đầu bị chặn trước Google, Capu chọn cách 1 để gỡ
- Run 45080523172 bị cổng sổ đăng ký chặn: MISSING_RUN_LOG 44412131387 và OPEN_DATA_PR 104. Chưa có lượt gọi Google hay Gemini nào, chi 0.
- Capu chọn cách 1. Chief mở phungrk/tohong#115: chỉ thêm 4 log của run 44412131387, chép nguyên văn từ nhánh của #104.
- Capu merge #115 và đóng #104, sau đó Chief chạy lại P0, vẫn trong phạm vi duyệt chi này.
- Dữ liệu 131 vendor của #104 sẽ dựng lại sau từ nhánh `resolve-overrides/run-44412131387`, không gọi Google.
