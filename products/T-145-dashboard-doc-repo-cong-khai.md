# Spec T-145: Dashboard công khai đọc dữ liệu từ repo tohong-hq-dashboard

## Ý định
Capu đã chuyển `phungrk/tohong-hq` sang private nên trang https://phungrk.github.io/tohong-hq-dashboard/ không còn tải được `dashboard.json`. Capu chọn phương án A (ADR-080, `decisions/2026-11-13-adr-080-dashboard-du-lieu-qua-repo-dashboard.md`): giữ trang công khai, đẩy bản `--public` sang nhánh `dashboard-data` của repo công khai `phungrk/tohong-hq-dashboard`.

## Bằng chứng
- ADR-080 (Capu chọn A, 2026-11-13). `/home/user/tohong-hq-dashboard/index.html` dòng 436: `DATA_URL` trỏ `raw.githubusercontent.com/phungrk/tohong-hq/dashboard-data/dashboard.json`.
- `.github/workflows/publish-dashboard-data.yml` hiện chỉ đẩy lên nhánh `dashboard-data` của chính tohong-hq, bằng `github.token`.
- Bài học T-118/T-127/T-134: eval workflow phải chạy nguyên văn bước `run:` với git giả; ống `|` phải dưới pipefail (planner INV-006).

## Giả thuyết
Nếu thêm bước đẩy sang repo dashboard và đổi `DATA_URL` thì trang hiện lại việc/trạng thái/đội ngũ trong vòng vài phút sau mỗi lần main đổi. Chỉ số bảo vệ: bản công khai không lộ thêm khoá nào so với `export_dashboard.py --public` hiện tại; main của repo dashboard không bị chạm (không dựng lại Pages mỗi lần sổ cái đổi).

## Hành vi (người dùng thấy gì)
Workflow, bước mới đặt SAU bước "Đẩy lên nhánh dashboard-data" hiện có (bước cũ giữ nguyên):
1. Bước mới là MỘT step có `env` ánh xạ `secrets.DASHBOARD_DATA_TOKEN` vào một biến môi trường. Đó là nơi duy nhất trong workflow nhắc `secrets.DASHBOARD_DATA_TOKEN`. `run:` không chứa `${{ }}`, không `set -x`, không in môi trường, không in token. Không `continue-on-error`.
2. Khi biến token rỗng hoặc không có (chưa đặt secret): bước in một dòng bắt đầu bằng `::warning::`, thoát mã 0, không gọi `git push`. Job xanh.
3. Khi có token: bước dựng một thư mục riêng (không phải `$RUNNER_TEMP/out`) chỉ chứa đúng một file `dashboard.json`, sao nguyên bản từ `$RUNNER_TEMP/out/dashboard.json` do bước "Xuất dữ liệu" (`--public`) tạo ra. Không đẩy `tasks.json`, `events.json`, `roster.json` hay file nào khác. Thư mục đó `git init`, commit một lần, rồi đúng một lệnh `git push -f` tới `https://x-access-token:<token>@github.com/phungrk/tohong-hq-dashboard.git` với đích là nhánh `dashboard-data` (dạng `dashboard-data`, `HEAD:dashboard-data` hoặc `HEAD:refs/heads/dashboard-data`). Không `--all`, `--mirror`, `--tags`, `--delete`; không nhắc `main`; không `checkout/switch/fetch/pull/merge/rebase`.
4. Khi có token mà `git commit` hoặc `git push` lỗi: bước thoát khác 0, job đỏ. Không nuốt lỗi (`|| true`); nếu bước có ống `|` thì chạy dưới pipefail (`shell: bash` hoặc `set -o pipefail`).
5. Token không bao giờ xuất hiện trong stdout/stderr của bước, kể cả khi git lỗi.

Trang (`/home/user/tohong-hq-dashboard/index.html`):
6. `const DATA_URL='https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json'` (đúng chuỗi này). Trang không còn đọc dữ liệu từ `raw.githubusercontent.com/phungrk/tohong-hq/…`. Chân trang và thông báo lỗi tải nói nguồn là repo `tohong-hq-dashboard` (không ghi `tohong-hq` làm nguồn dữ liệu). Link tới thư mục `inbox/capu` của tohong-hq cho Capu giữ nguyên.
7. Không thêm tham số `?data=` (quyết định của spec: trang công khai không nạp dữ liệu từ URL tùy ý). `?live=` giữ nguyên.
8. Với fixture `dashboard.json` trả về từ URL trên, trang hiển thị bình thường: không banner lỗi, số trên khối Agent code / Spec rework đúng theo fixture, không lỗi console. README của repo dashboard cập nhật nguồn dữ liệu cho khớp.

Dữ liệu:
9. `dashboard.json` được đẩy có tập khoá (đệ quy) là tập con của bản `export_dashboard.py --public` mới sinh; `public` là `true`; sự kiện không có `detail`/`link`; không chứa chuỗi giống token.

Việc của Capu (không ai khác làm): tạo token fine-grained, quyền Contents read/write, chỉ trên repo `phungrk/tohong-hq-dashboard`; đặt secret `DASHBOARD_DATA_TOKEN` ở repo `phungrk/tohong-hq`. Engineering và agent không tạo token, không đặt secret.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq` (workflow) và `phungrk/tohong-hq-dashboard` (trang, README) · Nhánh: `t-145-dashboard-repo-cong-khai` · Vùng (`area`): `hq/dashboard`
- Bất biến đã đọc: `_shared/` (inv-001 không secret trong repo), `hq/inv-002` (context workflow: secret chỉ qua `env`, không `if: secrets`, không dump env), `hq/dashboard/inv-009` (bản `--public` an toàn), planner INV-006 (pipefail, áp dụng như luật chung cho ống) — spec không vi phạm.
- Không chạm: `export_dashboard.py` (đầu ra `--public` giữ nguyên), nhánh `main` của repo dashboard, payment/auth/DB/dữ liệu người dùng.
- Bậc đề xuất: A — eval tự động phủ cả 3 tiêu chí; secret là của Capu đặt, không có migration. Lưu ý: việc có đụng secret của Capu nên nếu Chief of Staff thấy "dịch vụ trả phí/quyền ghi repo ngoài" là ranh giới cứng thì nâng bậc (không hạ).

## Tiêu chí chấp nhận và eval
Chạy từ gốc tohong-hq. Repo trang: `${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}`; tiêu chí 2 cần Playwright và `D3=/đường/dẫn/d3.min.js` (như bất biến hq/dashboard).

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Bước đẩy (chạy nguyên văn `run:` với git giả): thiếu secret → xanh + `::warning::` + không push; có secret → đúng 1 push `-f` tới `phungrk/tohong-hq-dashboard` nhánh `dashboard-data`, thư mục lúc push chỉ có `dashboard.json` bằng đúng output `--public`; push/commit lỗi → đỏ; không đẩy main; token không vào log | `python3 -I eval/T-145/check_1_workflow.py` |
| 2 | `DATA_URL` đúng chuỗi mới, không còn đọc raw của tohong-hq, không có `?data=`, trang hiển thị với fixture | `bash eval/T-145/check_2_trang.sh` |
| 3 | `dashboard.json` đã đẩy không có khoá nào ngoài bản `--public`, `public:true`, không `detail`/`link`, không token | `python3 -I eval/T-145/check_3_cong_khai.py` |

Ghi chú eval: `eval/T-145/_wf.py` là thư viện dùng chung (không phải eval). Biến `T145_WORKFLOW` cho phép trỏ tới bản workflow khác để thử. Eval đã được thử trên workflow mẫu (xanh) và 6 bản hỏng (đỏ: đẩy main, thiếu exit 0, sai repo, đẩy cả 4 file, `|| true`, `set -x`).

## Bất biến đề xuất (tầng 2)
- hq/dashboard: "mọi bước workflow đẩy dữ liệu ra repo/nhánh công khai chỉ đẩy đúng `dashboard.json` bản `--public`, không đẩy main, thiếu secret thì xanh + `::warning::`" — rút từ `check_1_workflow.py` + `check_3_cong_khai.py` (chạy với workflow thật, không cần repo trang).
- hq/dashboard: "`DATA_URL` của trang trỏ nhánh `dashboard-data` của repo công khai, không phải repo sổ cái" — rút từ phần đầu `check_2_trang.cjs` (tĩnh, không cần Playwright).

## Không làm
- Không tạo token, không đặt secret, không đẩy gì lên GitHub trong lúc làm spec.
- Không đổi `export_dashboard.py`, không đổi nội dung bản `--public`.
- Không bỏ bước đẩy cũ lên nhánh `dashboard-data` của tohong-hq.
- Không thêm `?data=`; không xử lý đường realtime tohong-live (đã sửa riêng theo ADR-080).
- Không tắt link `inbox/capu` trong `capu_queue` của bản `--public` (đang trỏ repo private; thuộc inv-009, nếu cần đổi là việc khác).

## Câu hỏi mở
Không. (Ghi nhận cho Chief of Staff: `capu_queue` công khai chứa link `github.com/phungrk/tohong-hq/blob/main/inbox/capu/…` nay sẽ 404 với người ngoài; không chặn việc này.)
