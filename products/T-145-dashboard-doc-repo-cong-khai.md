# Spec T-145: Dashboard công khai đọc dữ liệu từ repo tohong-hq-dashboard

## Ý định
Capu đã chuyển `phungrk/tohong-hq` sang private nên trang https://phungrk.github.io/tohong-hq-dashboard/ không còn tải được `dashboard.json`. Capu chọn phương án A (ADR-080, `decisions/2026-11-13-adr-080-dashboard-du-lieu-qua-repo-dashboard.md`): giữ trang công khai, đẩy bản `--public` sang nhánh `dashboard-data` của repo công khai `phungrk/tohong-hq-dashboard`.

## Bằng chứng
- ADR-080 (Capu chọn A, 2026-11-13). `/home/user/tohong-hq-dashboard/index.html` dòng 436: `DATA_URL` trỏ `raw.githubusercontent.com/phungrk/tohong-hq/dashboard-data/dashboard.json`.
- `.github/workflows/publish-dashboard-data.yml` hiện chỉ đẩy lên nhánh `dashboard-data` của chính tohong-hq, bằng `github.token`.
- Bài học T-118/T-127/T-134: eval workflow phải chạy nguyên văn bước `run:` (git thật, URL đẩy chuyển vào bare repo cục bộ); ống `|` phải dưới pipefail (planner INV-006).

## Giả thuyết
Nếu thêm bước đẩy sang repo dashboard và đổi `DATA_URL` thì trang hiện lại việc/trạng thái/đội ngũ trong vòng vài phút sau mỗi lần main đổi. Chỉ số bảo vệ: bản công khai không lộ thêm khoá nào so với `export_dashboard.py --public` hiện tại; main của repo dashboard không bị chạm (không dựng lại Pages mỗi lần sổ cái đổi).

## Hành vi (người dùng thấy gì)
Workflow, bước mới đặt SAU bước "Đẩy lên nhánh dashboard-data" hiện có (bước cũ giữ nguyên):
1. Bước mới là MỘT step có `env` ánh xạ `secrets.DASHBOARD_DATA_TOKEN` vào một biến môi trường. Đó là nơi duy nhất trong workflow nhắc `secrets.DASHBOARD_DATA_TOKEN`. `run:` không chứa `${{ }}`, không `set -x`, không in môi trường, không in token. Không `continue-on-error`.
2. Khi biến token rỗng hoặc không có (chưa đặt secret): bước in một dòng bắt đầu bằng `::warning::`, thoát mã 0, không gọi `git push`. Job xanh.
3. Khi có token, kết quả đo trên repo đích (không đo thư mục làm việc lúc gọi git): sau bước, ref `refs/heads/dashboard-data` của `phungrk/tohong-hq-dashboard` tồn tại, có đúng một commit, cây của nó có đúng một file `dashboard.json`, giống từng byte `$RUNNER_TEMP/out/dashboard.json` do bước "Xuất dữ liệu" (`--public`) tạo ra (không `tasks.json`, `events.json`, `roster.json`, không file nào khác, kể cả đã commit rồi xoá ở cây sau). Mọi ref khác của repo đích không đổi (main giữ nguyên SHA, không ref mới). Đúng một lệnh `git push` tới `https://x-access-token:<token>@github.com/phungrk/tohong-hq-dashboard.git` (có hoặc không `.git`), không `--all/--mirror/--tags/--delete/--prune`. Bước phải tự đủ trên runner sạch: tự đặt danh tính commit (runner không có `user.name/user.email`) và tự tạo nhánh tên `dashboard-data` (không phụ thuộc nhánh mặc định của git). Cách cài là việc của Engineering; chỉ kết quả trên ref đích được đo.
4. Khi có token mà `git commit` hoặc `git push` lỗi: bước thoát khác 0, job đỏ. Không nuốt lỗi (`|| true`); nếu bước có ống `|` thì chạy dưới pipefail (`shell: bash` hoặc `set -o pipefail`).
5. Token không bao giờ xuất hiện trong stdout/stderr của bước, kể cả khi git lỗi.

Trang (`/home/user/tohong-hq-dashboard/index.html`):
6. `const DATA_URL='https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json'` (đúng chuỗi này). Trang không còn đọc dữ liệu từ `raw.githubusercontent.com/phungrk/tohong-hq/…`. Chân trang có link `https://github.com/phungrk/tohong-hq-dashboard` và nhắc nhánh `dashboard-data`; khi tải dữ liệu lỗi, banner nhắc `tohong-hq-dashboard` (không chỉ về repo `tohong-hq`). Link tới thư mục `inbox/capu` của tohong-hq giữ nguyên.
7. Không thêm tham số `?data=` (trang công khai không nạp dữ liệu từ URL tùy ý). Đường realtime giữ nguyên: mặc định `#live` nối `wss://tohong-live.phungnc.workers.dev/ws` và sang "Trực tiếp" khi kênh mở; `?live=https://host` vẫn đổi host WebSocket.
8. Với fixture `dashboard.json` trả về từ URL trên, trang hiển thị bình thường: không banner lỗi, số trên khối Agent code / Spec rework đúng theo fixture, không lỗi console.
8b. README của repo trang: dòng nói dữ liệu đọc từ `dashboard.json` ở nhánh `dashboard-data` trỏ repo `phungrk/tohong-hq-dashboard` và không còn nhắc raw/repo `phungrk/tohong-hq` làm nguồn.

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
| 1 | Bước đẩy (chạy nguyên văn `run:` bằng git thật, đo trên ref đích): thiếu secret → xanh + `::warning::` + không push; có secret → đúng 1 push tới `phungrk/tohong-hq-dashboard`; nhánh `dashboard-data` đích có đúng 1 commit, chỉ `dashboard.json` giống từng byte output `--public`, main không đổi; push/commit lỗi → đỏ; không đẩy main; token không vào log | `python3 -I eval/T-145/check_1_workflow.py` |
| 2 | `DATA_URL` đúng chuỗi mới, không còn đọc raw của tohong-hq, không có `?data=`; trang hiển thị với fixture; chân trang và banner lỗi nhắc nguồn mới; `#live` nối tohong-live và `?live=` còn tác dụng | `bash eval/T-145/check_2_trang.sh` |
| 3 | `dashboard.json` trên nhánh đích không có khoá nào ngoài bản `--public`, `public:true`, không `detail`/`link`, không token | `python3 -I eval/T-145/check_3_cong_khai.py` |
| 4 | README của repo trang nói nguồn dữ liệu là `tohong-hq-dashboard` | `python3 -I eval/T-145/check_4_readme.py` |

Ghi chú eval: `eval/T-145/_wf.py` là thư viện dùng chung (không phải eval). Eval 1 và 3 chạy nguyên văn `run:` bằng git THẬT; URL đẩy được chuyển sang một bare repo cục bộ qua `GIT_CONFIG_COUNT` (`url.<bare>.insteadOf`), HOME giả không có `user.email` (kèm `user.useConfigOnly`), wrapper mỏng ghi argv và tiêm lỗi `commit`/`push`; đo trên ref đích. Token thử sinh lúc chạy (không có chuỗi khớp `_shared/inv-001` trong mã nguồn). `T145_WORKFLOW` trỏ tới bản workflow khác để thử. Đã thử: bản mẫu xanh; đỏ với các bản đẩy main, thiếu `exit 0`, sai repo, `|| true`, `set -x`, và ba bản D1 (commit rồi xoá file, `git init` không `-b`, thiếu git config).

## Sửa sau Spec Gate (v2, D1)
- INV-001: token thử trong eval nay ghép lúc chạy. Câu 3: bỏ mô tả "thư mục lúc push" (có ba cách hiểu a/b/c), thay bằng kết quả trên ref đích. Câu 6, 7: thêm kiểm dương cho chân trang, banner, `#live`, `?live=`. Câu 8b + eval 4 mới cho README.

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
