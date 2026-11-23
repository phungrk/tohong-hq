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
- Thân phản hồi được đọc như văn bản. Hai nhánh, loại trừ nhau:
  (i) Thân là JSON đối tượng có `error` là đối tượng: `R` = `error.status` nếu là chuỗi, ngược lại rỗng; `M` = `error.message` nếu là chuỗi (rỗng nếu là chuỗi rỗng), ngược lại (thiếu, null, số, đối tượng, mảng) `M` RỖNG. Trong nhánh này CLI KHÔNG BAO GIỜ rơi về thân thô, dù `message` thiếu hay vô dụng; chỉ `error.status` và `error.message` được in.
  (ii) Mọi trường hợp khác (thân không phải JSON; JSON không có `error` là đối tượng, kể cả `error` là chuỗi hay mảng; thân rỗng): `R` rỗng, `M` = thân thô (rỗng nếu thân rỗng), và `M` chịu đủ các luật che ở mục 2.
- Chuẩn hoá `R` và `M`, theo thứ tự: (1) che khoá (mục 2a-2d); (2) mọi chuỗi ký tự trắng liên tiếp (xuống dòng, tab, nhiều khoảng trắng) thành MỘT dấu cách rồi cắt hai đầu; (3) che dữ liệu đã gửi (mục 2e) trên văn bản đã gộp; (4) `M` cắt còn tối đa 300 ký tự đầu (cắt SAU khi che, để khoá/dữ liệu nằm sát vị trí 300 không để lại mảnh); (5) `R` còn dấu cách thì đổi thành `_` (để `reason=` là một từ).
- Ràng buộc BẮT BUỘC cho dòng này (kế thừa từ T-219, check_16 và mục 11 của spec T-219: stdout và log không chứa tên, địa chỉ, `place_id` hay nội dung Maps/Gemini): dòng `P0_HTTP_ERROR` không bao giờ chứa `place_id`, tên, địa chỉ, website hay truy vấn của vendor/place đã gửi trong CHÍNH lượt gọi đó, kể cả khi Google tự nhắc lại chúng trong `error.message` hay thân thô. Hai cơ chế bảo đảm: nhánh (i) không bao giờ in thân thô, và luật che 2e. Mọi trường khác của thân (`error.details`, `places`, …) bị bỏ. CLI không in thân lỗi ở bất cứ chỗ nào khác.
- Vị trí dòng: in NGAY SAU khi nhận phản hồi và TRƯỚC `P0_STOP` của chính lượt đó (kể cả `P0_STOP gemini_auth`, `P0_STOP http_<mã>`). Với Details lỗi mà lần chạy vẫn tiếp tục (mã khác 401/403/429), dòng vẫn được in, một dòng cho MỖI lượt Details lỗi, và không có `P0_STOP`.
- Không in dòng này cho: lỗi mạng (`network_error`), phản hồi 200, hay thân 200 hỏng JSON (`bad_response`): hành vi hiện có giữ nguyên.

### 2. Che khoá và che dữ liệu đã gửi
Trong `R` và `M`, trước khi cắt, thay bằng `[REDACTED]`: (a) mọi chuỗi khớp `AIza[0-9A-Za-z_-]{35}`; (b) `key=` (không phân biệt hoa thường) cùng giá trị đi sau đến ký tự trắng, `&`, `"` hoặc `'`; (c) `Bearer` (không phân biệt hoa thường), rồi MỘT hay nhiều ký tự trắng BẤT KỲ (dấu cách, tab, xuống dòng `\n`/`\r\n`), và token đi sau (`[A-Za-z0-9._~+/=-]+`); (d) giá trị chính xác của biến môi trường `GEMINI_API_KEY` và `GOOGLE_MAPS_API_KEY` đang chạy, bất kể hình dạng, CHỈ khi giá trị đó KHÁC RỖNG sau khi bỏ khoảng trắng hai đầu (giá trị rỗng không được che, để không chèn dấu che giữa mọi ký tự); (e) dữ liệu đã gửi trong CHÍNH lượt gọi sinh ra dòng, so khớp nguyên văn (phân biệt hoa thường) trên văn bản đã gộp ký tự trắng, mỗi giá trị cũng gộp ký tự trắng, bỏ giá trị ngắn hơn 4 ký tự (để không phá dấu che), che giá trị dài trước:
 - Place Details: `place_id` trong đường dẫn (nên cả `places/<id>` mất phần id);
 - Gemini phân loại (prompt 1c): mọi `id`, tên và địa chỉ trong lô đã gửi; Gemini enrich (prompt 2): tên, địa chỉ và website của vendor trong prompt; Gemini lưới: không có dữ liệu vendor để che;
 - Text Search: chuỗi truy vấn đã gửi (không phải dữ liệu vendor, nhưng cũng không vào dòng).
Sau khi che, không đoạn nào của khoá (đủ hay 12 ký tự đầu) còn ở stdout, log, hay file CLI tạo ra, và không giá trị nào ở (e) còn trong dòng.

### 3. Không đổi
Hành vi dừng/tiếp tục, mã thoát, số lượt gọi mỗi loại, thứ tự và nội dung mọi dòng khác (`GOOGLE_REQUEST`, `GEMINI_RESPONSE`, `P0_STOP`, `P0_SUMMARY`, `GOOGLE_USAGE`, `GEMINI_USAGE`), nội dung báo cáo và file ra: giống từng byte so với trước, NGOẠI TRỪ các dòng `P0_HTTP_ERROR` thêm vào. Dòng này không thay đổi số đếm sổ chi (`check_runs`/`usage.py` bỏ qua tiền tố lạ như hiện nay với dòng khác). Lần chạy không có phản hồi lỗi không có dòng nào mới.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` (chỉ `tools/scraper/discover_p0.py`) · Nhánh: `t-221-p0-ghi-loi-http` · Vùng (`area`): `planner/vendor`
- Bất biến đã đọc: `eval/invariants/_shared/` (inv-001 không secret trong repo), `planner/` inv-006, `planner/vendor/` inv-010 (workflow Google trong sổ đăng ký), inv-011 (khoá chỉ qua env/secrets); không vi phạm. Không chạm workflow nên inv-010/011 vẫn xanh. Spec thêm ràng buộc mới: bất biến đề xuất bên dưới.
- Không chạm: workflow, `usage.py`, `check_runs.py`, prompt, trần, thử lại, model, dữ liệu pool, repo khác.
- Bậc lưới lọc: **C** (dịch vụ trả phí, đường khoá API) theo Chief of Staff; không đổi.

## Tiêu chí chấp nhận và eval
Tiêu chí 1 trên board tách thành 6 mệnh đề, mỗi mệnh đề một eval (chạy offline, `TOHONG_REPO` hoặc `../tohong`, không mạng):

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Gemini 402 kèm thân lỗi kiểu Google: đúng một dòng `P0_HTTP_ERROR kind=gemini status=402 reason=<error.status> message=<error.message>` trước `P0_STOP http_402`; 401 lượt đầu: dòng trước `P0_STOP gemini_auth`; message > 300 ký tự bị cắt đúng 300; chi 0 và mọi dòng khác, mã thoát, số lượt gọi y như cũ | `python3 eval/T-221/check_1_gemini_402_dong_chan_doan.py` |
| 2 | Thân lỗi có khoá giả (AIza…, `key=…`, `Bearer …` kể cả `Bearer` + xuống dòng/tab/nhiều dấu cách + token, khoá đang chạy, kể cả sát vị trí cắt 300 và thân thô) ở Gemini 402, Text Search 403, Details 429 thì không khoá nào còn ở stdout/log/file; dòng vẫn một dòng | `python3 eval/T-221/check_2_che_khoa_ca_ba_loai.py` |
| 3 | Thân không chuẩn (HTML nhiều dòng, JSON không có đối tượng error, rỗng, kiểu lạ) vẫn ra đúng một dòng hợp lệ, `reason=` rỗng, gộp dòng, cắt 300, không sập; trường ngoài `error.status/message` (tên/địa chỉ vendor) không lộ; chạy toàn 200 không có dòng nào | `python3 eval/T-221/check_3_than_loi_khong_chuan_va_khong_lo_du_lieu.py` |
| 4 | Details 404 vẫn tiếp tục (một dòng mỗi lượt lỗi, không P0_STOP); Details 429/403, Text Search 403/500, Gemini lượt sau 429 vẫn dừng như cũ với dòng đứng trước P0_STOP; đầu ra khác dòng mới, mã thoát và số lượt gọi y hệt nền | `python3 eval/T-221/check_4_details_tiep_tuc_va_dung_giu_nguyen.py` |
| 6 | Google nhắc lại dữ liệu đã gửi: Details 404 có message chứa place_id của lượt đó; Gemini phân loại 400 trích id/tên/địa chỉ của lô; Gemini enrich 400 trích tên/địa chỉ/website; Text Search 403 trích truy vấn: dòng không chứa giá trị nào, có `[REDACTED]`, còn chữ lành. JSON có `error` là đối tượng nhưng thiếu/null/số/rỗng/đối tượng message (kèm tên, địa chỉ, place_id ở `error.details`, `places`): dòng là `reason=<error.status> message=` rỗng, không thân thô. Thân dự phòng (HTML, JSON không có `error`, `error` là chuỗi) nhắc dữ liệu đã gửi: bị che. Stdout không chứa tên/địa chỉ/place_id (mẫu của T-219 check_16) | `python3 eval/T-221/check_6_khong_lo_du_lieu_vendor_khi_google_nhac_lai.py` |
| 5 | Mọi eval tầng 1 của T-219 và mọi eval đối kháng của T-220 (24 eval) vẫn xanh. Dạng wrapper vì tiêu chí đòi chính các eval cũ; GREEN cả trên main nên không tự chứng minh việc, chỉ chặn hồi quy | `python3 eval/T-221/check_5_eval_T219_T220_van_xanh.py` |

Dùng lại fake T-219 và T-220: `eval/T-221/_fake_err/sitecustomize.py` bọc fake T-219 và cho phép đặt mã + thân lỗi tuỳ ý cho từng loại lượt gọi, thân lỗi có thể nhắc lại dữ liệu đã gửi qua ký hiệu `<<PID>>`, `<<NAME>>`, `<<ADDR>>`, `<<WEB>>`, `<<QUERY>>` (fake thay bằng giá trị thật của lượt đó); `_e.py` bọc helper `_t219.py`. Eval 1-4 và 6 ĐỎ trên main (chưa có dòng `P0_HTTP_ERROR`); đã kiểm chúng XANH với một bản vá tham chiếu viết nháp ngoài repo (không để lại), và kiểm check_6 ĐỎ với hai bản vá sai (không che dữ liệu đã gửi; rơi về thân thô khi `error` không có message).

## Bất biến đề xuất (tầng 2)
1. INV (vùng `planner/vendor`): mọi đường lỗi HTTP của `discover_p0.py` ghi chẩn đoán mà không lộ khoá. Eval: `eval/T-221/inv-proposed-loi-http-khong-lo-khoa.py` (chạy lại check 2).
2. INV (vùng `planner/vendor`, bổ sung theo defect D1): đường lỗi HTTP của `discover_p0.py` không bao giờ in `place_id`, tên, địa chỉ, website hay truy vấn đã gửi, kể cả khi Google nhắc lại, và không rơi về thân thô khi JSON có đối tượng `error`. Eval: `eval/T-221/inv-proposed-loi-http-khong-lo-du-lieu-vendor.py` (chạy lại check 6).
Nếu sau này có CLI Google khác in thân lỗi, hai bất biến mở rộng sang nó.

## Không làm
Đổi cách xử lý lỗi, thử lại, đổi model, đổi workflow hay `usage.py`, in thân lỗi ngoài `error.status`/`error.message` (thân thô chỉ ở nhánh (ii)), thêm cờ cấu hình, che khoá ở các dòng khác (thuộc bất biến inv-011).

## Câu hỏi mở
Không. Giả định cần kiểm khi có 402 thật: thân Google có `error.message` (nếu không, `message=` rỗng, vẫn có `reason=`).

## Lịch sử sửa (spec rework vòng 1, defect T-221-D1)
- Câu "Chỉ error.status và error.message (hoặc thân thô khi không có) được in ... không bao giờ vào dòng này" cho phép hai cách hiểu: in nguyên văn `error.message`/thân thô mà Google có thể nhắc lại place_id, tên, địa chỉ. Đã sửa theo phán quyết của Chief (gộp B và C): (B) mục 2e che dữ liệu đã gửi trong chính lượt gọi; (C) JSON có đối tượng `error` thì không bao giờ rơi về thân thô (message thiếu/không phải chuỗi thì `M` rỗng); thân thô chỉ ở nhánh (ii) và chịu mọi luật che.
- Ràng buộc stdout của T-219 (check_16) ghi tường minh là bắt buộc cho dòng này.
- Điểm nhỏ: (d) chỉ che giá trị khoá KHÁC RỖNG; (c) `Bearer` + mọi ký tự trắng kể cả xuống dòng.
- Eval thêm: check_6 (mới), check_2 thêm ca `Bearer\n<token>`; check_3 cập nhật mô tả (JSON có `error` không còn rơi về thân thô).
