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

## Bổ sung (2026-11-22): lần chạy thứ hai dừng ở lượt Gemini đầu (HTTP 402)
- Run 45082743113 qua cổng sổ đăng ký (CHECK_RUNS_OK). Lượt gọi Gemini đầu tiên (sinh lưới truy vấn, cũng là lần kiểm khoá) bị trả `HTTP 402 Payment Required`, nên workflow dừng (`P0_STOP http_402`).
- Lần chạy không gọi Maps lượt nào. Gemini được tính 1 lượt, 0 token. Chi phí: 0.
- Workflow đã mở PR phungrk/tohong#116 (`discover-p0/run-45082743113`), chỉ chứa log và báo cáo. PR này phải merge, nếu không OPEN_DATA_PR sẽ chặn mọi lần chạy Google sau.
- Nguyên nhân có khả năng cao (đoán, tự tin ~80
## Bổ sung (2026-11-22): lần chạy thứ hai dừng ở lượt Gemini đầu (HTTP 402)
- Run 45082743113 qua cổng sổ đăng ký (CHECK_RUNS_OK). Lượt gọi Gemini đầu tiên trả `HTTP 402 Payment Required`, nên workflow dừng (`P0_STOP http_402`). Lượt này dùng để sinh lưới truy vấn và cũng là lần kiểm khoá.
- Không gọi Maps lượt nào. Gemini ghi 1 lượt, 0 token. Chi phí: 0.
- Workflow đã mở PR phungrk/tohong#116 (`discover-p0/run-45082743113`), chỉ chứa log và báo cáo. Phải merge PR này, nếu không OPEN_DATA_PR sẽ chặn mọi lần chạy Google sau.
- Nguyên nhân có khả năng cao (đoán, tự tin ~80%): project Google của `GEMINI_API_KEY` chưa bật thanh toán hoặc chưa nạp tín dụng trả trước. Grounding không dùng được ở bậc miễn phí. Bật thanh toán là việc của Capu.

## Bổ sung (2026-11-23): lần chạy thứ ba vẫn HTTP 402
- Capu báo đã bật thanh toán và đã merge #116. Run 45103764727 vẫn trả HTTP 402 ở lượt Gemini đầu tiên. Không gọi Maps lượt nào, chi 0. PR log: phungrk/tohong#117.
- `discover_p0.py` không ghi nội dung lỗi của Gemini khi gặp mã khác 200, nên chưa biết chính xác nguyên nhân. Có thể là: (a) khoá thuộc một project khác với project vừa bật thanh toán; (b) tài khoản trả trước chưa có số dư; (c) thanh toán vừa bật nhưng chưa có hiệu lực. Chief không đoán tiếp.
- Đề xuất: (1) Capu kiểm khoá trong Google AI Studio; (2) mở một việc nhỏ để CLI ghi thông điệp lỗi của Gemini (đã che khoá) vào log khi gặp mã khác 200, nhờ vậy lần sau có căn cứ chẩn đoán.

## T-221: Chief phân xử D2 để không có lần trả thứ ba (2026-11-23)
- **Thân lỗi là JSON** (đọc được bằng json.loads): không bao giờ in thô. Có đối tượng `error` thì in `error.status` và `error.message`; trường nào không phải chuỗi thì để rỗng. Không có đối tượng `error` thì để `reason` và `message` đều rỗng.
- **Thân lỗi không phải JSON** (HTML, chữ thường): không in nội dung. Chỉ in `message=non_json_body bytes=<độ dài> content_type=<content-type đã che>`. Như vậy không còn đường lọt qua `\uXXXX`, qua thực thể HTML, hay qua bước cắt.
- **Che dữ liệu đã gửi (2e)**:
  - Che trên `error.message` sau khi giải mã JSON.
  - Chỉ chạy một lượt regex hợp nhất, giá trị dài đứng trước, không phân biệt hoa thường. Dấu che đã chèn không bị quét lại.
  - Ngưỡng tối thiểu hạ xuống 2 ký tự.
- **Eval** phải có các ca:
  - chữ viết hoa khác bản gốc;
  - vendor giữa và cuối lô;
  - thân JSON không có `error` mà có dữ liệu thoát;
  - HTML có thực thể số.

  Thêm vào đó, check_6 phải giải mã dòng log trước khi tìm.
- Nếu spec bị trả lần ba vì cùng câu ý định này thì tự động leo thang lên Capu.
