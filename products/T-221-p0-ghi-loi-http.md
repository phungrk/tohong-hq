# Spec T-221: discover_p0.py ghi lý do khi Google trả mã khác 200

## Ý định
Capu: "Ok hãy ghi log" (issue #113, ADR-143 bổ sung 2026-11-23). Ba lần chạy P0 xe hoa dừng ở `P0_STOP http_402` của lượt Gemini đầu mà log không nói vì sao; lần sau phải có căn cứ chẩn đoán.

## Bằng chứng
- `decisions/2026-11-22-adr-143-duyet-chi-p0-xe-hoa.md`: run 45082743113 và 45103764727 dừng `http_402`, chi 0, "chưa biết chính xác nguyên nhân".
- `tools/scraper/discover_p0.py` (đã đọc): `Client.search` (non-200 -> `stop("http_<mã>")`), `Client.details` (401/403/429 dừng; non-200 khác -> trả `error`, chạy tiếp), `Client.gemini` (non-200 -> `gemini_auth` nếu lượt đầu và 401/403, còn lại `http_<mã>`). Không nơi nào đọc thân lỗi.
- Dạng thân lỗi của Google `{"error":{"code":N,"status":"...","message":"..."}}`: hiểu biết chung, chưa kiểm với 402 thật, tự tin ~80%; vì thế spec có nhánh thân không chuẩn.

## Giả thuyết
Nếu in thông điệp lỗi đã che khoá thì lần chạy lỗi kế tiếp nêu được nguyên nhân 402 mà không phải đoán. Chỉ số bảo vệ: không lộ khoá, không lộ dữ liệu Maps, hành vi dừng/tiếp tục và sổ chi không đổi.

## Hành vi (người dùng thấy gì)
Người dùng ở đây là Capu/Chief đọc log lần chạy (stdout CLI, qua `tee` thành `run-logs/T-219/*.log`, đi vào PR `discover-p0/`).

### 1. Dòng chẩn đoán
- Với MỖI phản hồi HTTP mã khác 200 của một lượt gọi Gemini, Text Search hoặc Place Details, CLI in đúng một dòng stdout (có flush), định dạng chính xác:
  `P0_HTTP_ERROR kind=<gemini|text_search|details> status=<mã 3 chữ số> reason=<R> message=<M>`
- `kind`: `gemini` cho lượt Gemini (mọi vai: lưới, phân loại, enrich), `text_search` cho Text Search Pro, `details` cho Place Details.
- Thân phản hồi được đọc như văn bản. Nếu thân là JSON đối tượng có `error` là đối tượng:
  `R` = `error.status` nếu là chuỗi, ngược lại rỗng; `M` = `error.message` nếu là chuỗi KHÔNG rỗng, ngược lại thân thô.
  Mọi trường hợp khác (thân không phải JSON, JSON không có `error` đối tượng, thân rỗng): `R` rỗng, `M` = thân thô (rỗng nếu thân rỗng).
- Chuẩn hoá `R` và `M`, theo thứ tự: (1) che khoá (mục 2); (2) mọi chuỗi ký tự trắng liên tiếp (xuống dòng, tab, nhiều khoảng trắng) thành MỘT dấu cách rồi cắt hai đầu; (3) `M` cắt còn tối đa 300 ký tự đầu (cắt SAU khi che, để khoá nằm sát vị trí 300 không để lại mảnh); (4) `R` còn dấu cách thì đổi thành `_` (để `reason=` là một từ).
- Chỉ `error.status` và `error.message` (hoặc thân thô khi không có) được in. Mọi trường khác của thân (`error.details`, `places`, …) bị bỏ, nên tên/địa chỉ/`place_id`/nội dung Maps không bao giờ vào dòng này. CLI không in thân lỗi ở bất cứ chỗ nào khác.
- Vị trí dòng: in NGAY SAU khi nhận phản hồi và TRƯỚC `P0_STOP` của chính lượt đó (kể cả `P0_STOP gemini_auth`, `P0_STOP http_<mã>`). Với Details lỗi mà lần chạy vẫn tiếp tục (mã khác 401/403/429), dòng vẫn được in, một dòng cho MỖI lượt Details lỗi, và không có `P0_STOP`.
- Không in dòng này cho: lỗi mạng (`network_error`), phản hồi 200, hay thân 200 hỏng JSON (`bad_response`): hành vi hiện có giữ nguyên.

### 2. Che khoá
Trong `R` và `M`, trước khi cắt, thay bằng `[REDACTED]`: (a) mọi chuỗi khớp `AIza[0-9A-Za-z_-]{35}`; (b) `key=` (không phân biệt hoa thường) cùng giá trị đi sau đến ký tự trắng, `&`, `"` hoặc `'`; (c) `Bearer` (không phân biệt hoa thường), khoảng trắng, và token đi sau (`[A-Za-z0-9._~+/=-]+`); (d) giá trị chính xác của biến môi trường `GEMINI_API_KEY` và `GOOGLE_MAPS_API_KEY` đang chạy, bất kể hình dạng. Sau khi che, không đoạn nào của khoá (đủ hay 12 ký tự đầu) còn ở stdout, log, hay file CLI tạo ra.

### 3. Không đổi
Hành vi dừng/tiếp tục, mã thoát, số lượt gọi mỗi loại, thứ tự và nội dung mọi dòng khác (`GOOGLE_REQUEST`, `GEMINI_RESPONSE`, `P0_STOP`, `P0_SUMMARY`, `GOOGLE_USAGE`, `GEMINI_USAGE`), nội dung báo cáo và file ra: giống từng byte so với trước, NGOẠI TRỪ các dòng `P0_HTTP_ERROR` thêm vào. Dòng này không thay đổi số đếm sổ chi (`check_runs`/`usage.py` bỏ qua tiền tố lạ như hiện nay với dòng khác). Lần chạy không có phản hồi lỗi không có dòng nào mới.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (chỉ `tools/scraper/discover_p0.py`) · Nhánh: `t-221-p0-ghi-loi-http` · Vùng (`area`): `planner/vendor`
- Bất biến đã đọc: `eval/invariants/_shared/` (inv-001 không secret trong repo), `planner/` inv-006, `planner/vendor/` inv-010 (workflow Google trong sổ đăng ký), inv-011 (khoá chỉ qua env/secrets); không vi phạm. Không chạm workflow nên inv-010/011 vẫn xanh. Spec thêm ràng buộc mới: bất biến đề xuất bên dưới.
- Không chạm: workflow, `usage.py`, `check_runs.py`, prompt, trần, thử lại, model, dữ liệu pool, repo khác.
- Bậc lưới lọc: **C** (dịch vụ trả phí, đường khoá API) theo Chief of Staff; không đổi.

## Tiêu chí chấp nhận và eval
Tiêu chí 1 trên board tách thành 5 mệnh đề, mỗi mệnh đề một eval (chạy offline, `TOHONG_REPO` hoặc `../tohong`, không mạng):

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Gemini 402 kèm thân lỗi kiểu Google: đúng một dòng `P0_HTTP_ERROR kind=gemini status=402 reason=<error.status> message=<error.message>` trước `P0_STOP http_402`; 401 lượt đầu: dòng trước `P0_STOP gemini_auth`; message > 300 ký tự bị cắt đúng 300; chi 0 và mọi dòng khác, mã thoát, số lượt gọi y như cũ | `python3 eval/T-221/check_1_gemini_402_dong_chan_doan.py` |
| 2 | Thân lỗi có khoá giả (AIza…, `key=…`, `Bearer …`, khoá đang chạy, kể cả sát vị trí cắt 300 và thân thô) ở Gemini 402, Text Search 403, Details 429 thì không khoá nào còn ở stdout/log/file; dòng vẫn một dòng | `python3 eval/T-221/check_2_che_khoa_ca_ba_loai.py` |
| 3 | Thân không chuẩn (HTML nhiều dòng, JSON không có error.message, rỗng, kiểu lạ) vẫn ra đúng một dòng hợp lệ, `reason=` rỗng, gộp dòng, cắt 300, không sập; trường ngoài `error.status/message` (tên/địa chỉ vendor) không lộ; chạy toàn 200 không có dòng nào | `python3 eval/T-221/check_3_than_loi_khong_chuan_va_khong_lo_du_lieu.py` |
| 4 | Details 404 vẫn tiếp tục (một dòng mỗi lượt lỗi, không P0_STOP); Details 429/403, Text Search 403/500, Gemini lượt sau 429 vẫn dừng như cũ với dòng đứng trước P0_STOP; đầu ra khác dòng mới, mã thoát và số lượt gọi y hệt nền | `python3 eval/T-221/check_4_details_tiep_tuc_va_dung_giu_nguyen.py` |
| 5 | Mọi eval tầng 1 của T-219 và mọi eval đối kháng của T-220 (24 eval) vẫn xanh. Dạng wrapper vì tiêu chí đòi chính các eval cũ; GREEN cả trên main nên không tự chứng minh việc, chỉ chặn hồi quy | `python3 eval/T-221/check_5_eval_T219_T220_van_xanh.py` |

Dùng lại fake T-219 và T-220: `eval/T-221/_fake_err/sitecustomize.py` bọc fake T-219 và cho phép đặt mã + thân lỗi tuỳ ý cho từng loại lượt gọi; `_e.py` bọc helper `_t219.py`. Eval 1-4 ĐỎ trên main (chưa có dòng `P0_HTTP_ERROR`); đã kiểm chúng XANH với một bản vá tham chiếu viết nháp ngoài repo (không để lại).

## Bất biến đề xuất (tầng 2)
INV (vùng `planner/vendor`): mọi đường lỗi HTTP của `discover_p0.py` ghi chẩn đoán mà không lộ khoá. Eval: `eval/T-221/inv-proposed-loi-http-khong-lo-khoa.py` (chạy lại check 2). Nếu sau này có CLI Google khác in thân lỗi, bất biến đó mở rộng sang nó.

## Không làm
Đổi cách xử lý lỗi, thử lại, đổi model, đổi workflow hay `usage.py`, in thân lỗi ngoài `error.status`/`error.message`, thêm cờ cấu hình, che khoá ở các dòng khác (thuộc bất biến inv-011).

## Câu hỏi mở
Không. Giả định cần kiểm khi có 402 thật: thân Google có `error.message` (nếu không, dòng rơi về thân thô, vẫn che và cắt 300).
