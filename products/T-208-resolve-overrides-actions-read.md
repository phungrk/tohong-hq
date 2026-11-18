# Spec T-208: resolve-overrides.yml cấp actions: read cho cổng sổ đăng ký

## Ý định
Capu cần chạy thật Resolve overrides (dry_run=false) để áp 133 mục PR #93 (ADR-130, duyệt chi 140 request). Cổng "Cổng: sổ đăng ký lần chạy" đang chết 403 nên chưa gọi được Google.

## Bằng chứng
- Run 44332847247 (2026-11-18) fail ở bước cổng: `gh run list --workflow ...` trả "HTTP 403: Resource not accessible by integration"; 0 chi. Nguồn: board/T-208.md.
- `/home/user/tohong/.github/workflows/resolve-overrides.yml` dòng 39-41: `permissions` chỉ có `contents: write`, `pull-requests: write`. Dòng 81-92: bước cổng chạy `gh run list` và `check_runs.py`.
- `enrich-vendors.yml` dòng 53-56 có `actions: read`; bước cổng giống hệt ở dòng 152-164.
- Khảo sát 7 workflow trong tohong (grep `gh run|gh api|check_runs|/actions/`, đã chạy 2026-11-18): chỉ `enrich-vendors.yml` (đã có) và `resolve-overrides.yml` (thiếu) gọi Actions API qua `gh run list`/`check_runs.py`. Không workflow nào có `permissions` cấp job. `apply-admin-reviews`, `apply-review-rule`, `enrich-venue`, `refresh-vendor-photos` không gọi; `scrape-vendors.yml` chỉ nhắc check_runs.py trong comment, không có `permissions`, không gọi. Workflow ngoài tohong (tohong-back, tohong-front, tohong-hq) chưa khảo sát: ngoài phạm vi, ghi ở "Câu hỏi mở".
- Tự tin ~95% nguyên nhân là thiếu `actions: read` (cùng bước, cùng lệnh, chỉ khác quyền).

## Giả thuyết
Nếu thêm `actions: read` thì bước cổng của resolve-overrides qua được `gh run list` (đạt tới `check_runs.py`) và chạy thật không còn chết 403. Chỉ số bảo vệ: tập quyền ghi của mọi workflow không đổi (chỉ `contents`, `pull-requests`).

## Hành vi (người dùng thấy gì)
- Khi Capu bấm Resolve overrides với dry_run=false (hoặc mở PR kích hoạt cổng), bước "Cổng: sổ đăng ký lần chạy" không còn lỗi 403 ở `gh run list`; kết quả cổng do `check_runs.py` quyết như thiết kế (có thể vẫn từ chối vì MISSING_RUN_LOG / OPEN_DATA_PR, đó là hành vi đúng, không thuộc việc này).
- Mọi workflow của tohong có step gọi `gh run ...`, `gh workflow list|view`, `gh api .../actions/...`, `check_runs.py` hoặc `uses: actions/github-script` có quyền hiệu lực `actions: read`. Quyền hiệu lực của một job là `permissions` cấp job nếu có (thay hẳn cấp workflow), không thì cấp workflow. `read-all` coi là đủ; `write-all` bị cấm.
- Quyền hiệu lực của mọi job, ở mọi scope khác `actions`, giữ nguyên như trước T-208. Riêng mọi job có step mở PR hoặc đẩy nhánh (`uses: peter-evans/create-pull-request`, `gh pr create|edit|merge|close`, `git push`; trong đó có `resolve-overrides`) vẫn có `contents: write` và `pull-requests: write` hiệu lực. Vì `permissions` cấp job thay hẳn cấp workflow, thêm `permissions: {actions: read}` hay `read-all` cấp job, hoặc thay khối cấp workflow bằng chỉ `actions: read`, đều làm mất hai quyền ghi này và bị cấm (sửa đúng: thêm một dòng `actions: read` vào khối cấp workflow đang có). Không có job nào được thêm, bớt hay đổi tên.
- Không workflow nào có thêm quyền ghi: scope `write` chỉ được là `contents` và `pull-requests`. `actions: write` không được dùng để "cho chắc".

## Ràng buộc (vòi)
- Repo: `phungrk/tohong` · Nhánh: `t-208-resolve-overrides-actions-read` · Vùng (`area`): `planner/admin/vendor-enrich`
- Bất biến đã đọc: `eval/invariants/_shared/` và `eval/invariants/planner/admin/vendor-enrich/`, `planner/admin/`, `planner/`: spec này không vi phạm INV nào (hq/inv-002 về context workflow: chỉ thêm một khoá `permissions`, không đụng `if`/`env`/`secrets`).
- Không chạm: logic cổng hạn mức, `check_runs.py`, danh sách workflow trong vòng `for wf in ...`, secret, bất kỳ quyền ghi nào, cài đặt Settings > Actions.
- Bậc lưới lọc: C (Chief of Staff đã đặt) — sửa quyền của workflow có chi tiêu Google; Capu tự merge.

## Tiêu chí chấp nhận và eval
Tiêu chí 1 của board tách thành ba ý (tiêu chí 4 thêm ở spec rework vòng 1, theo D1) để mỗi ý có đúng một eval.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Mọi job của `resolve-overrides.yml` chạy cổng sổ đăng ký (và vẫn còn ít nhất một job như vậy) có quyền hiệu lực `actions: read` | `python3 -I eval/T-208/check_1_resolve_overrides_co_actions_read.py` |
| 2 | Mọi job của mọi workflow trong `tohong/.github/workflows` có step `run:` gọi `gh run`, `gh api .../actions/...` hoặc `check_runs.py` có `actions: read` hiệu lực (và có ít nhất một job như vậy) | `python3 -I eval/T-208/check_2_moi_workflow_goi_actions_api_co_actions_read.py` |
| 3 | Không workflow/job nào có scope `write` ngoài `contents`, `pull-requests`; không `write-all` | `python3 -I eval/T-208/check_3_khong_mo_quyen_ghi_moi.py` |
| 4 | Mọi job có step mở PR/đẩy nhánh giữ `contents: write` + `pull-requests: write` hiệu lực; quyền hiệu lực từng job (trừ scope `actions`) bằng ảnh chụp main trước T-208; `actions` chỉ vắng hoặc `read`, chỉ thêm ở job gọi Actions API | `python3 -I eval/T-208/check_4_giu_quyen_ghi_job_mo_pr.py` |

Cả bốn: tĩnh, đọc YAML, không mạng, không Google; repo qua `TOHONG_REPO` hoặc `../tohong` (dò ngược tới `scripts/gate.py`, ADR-070). Trên main hiện tại: check_1 RED, check_2 RED, check_3 GREEN, check_4 GREEN (3 và 4 là chốt chặn chống sửa quá tay, không đỏ trước khi code). Đã thử trên bảy bản sao (scratchpad, TOHONG_REPO): (a) `actions: read` thêm vào khối workflow: cả bốn PASS; (b) job-level chỉ `actions: read`, (c) job-level `read-all`, (d) workflow-level chỉ `actions: read`, (f) job-level `actions: read`+`contents: write` (mất pull-requests): check_1-3 PASS nhưng check_4 FAIL; (e) `actions: write`: check_3 và check_4 FAIL; (g) thêm `issues: write`: check_3 và check_4 FAIL.
Giới hạn thừa nhận: eval tĩnh không chứng minh 403 hết trên GitHub thật; việc đó chỉ biết khi Capu chạy thật. Mẫu dò thấy `gh run`, `gh workflow list|view`, `gh api` có `actions/`, `check_runs.py` trong `run:` và step `uses: actions/github-script` (chưa có workflow nào dùng hai dạng sau; giữ cho bền); `gh workflow run` (kích hoạt cross-repo sang tohong-back) cố ý không tính, vì nó đi bằng token khác (không phải việc này).

## Bất biến đề xuất (tầng 2)
Vùng `planner/admin/vendor-enrich` (hoặc `planner/` nếu spec-critic thấy rộng hơn): "Mọi job của workflow tohong gọi Actions API có `actions: read` hiệu lực; mọi job mở PR hoặc đẩy nhánh giữ `contents: write` và `pull-requests: write` hiệu lực." Dùng `eval/T-208/proposed-inv_actions_read_va_quyen_mo_pr.py` (gộp hai vế, không chứa ảnh chụp riêng việc; dò ngược theo ADR-070, PASS 'chưa áp dụng' khi không có repo). Ảnh chụp main chỉ nằm trong check_4 (riêng T-208), không đưa vào bất biến. Đề xuất thêm: `check_3` thành bất biến "tập quyền ghi workflow tohong = {contents, pull-requests}" — chỉ nếu Capu muốn khoá cứng; mặc định không, vì nó chặn mọi nhu cầu quyền ghi mới hợp lệ.

## Không làm
- Đổi logic cổng hạn mức hay `check_runs.py`; gọi Google trong eval.
- Thêm quyền ghi nào; đổi Settings của repo; sửa `enrich-vendors.yml` (đã đúng).
- Sửa workflow ngoài tohong.

## Câu hỏi mở
Không. (Ghi chú: chưa khảo sát workflow của tohong-back/tohong-front/tohong-hq; nếu Capu muốn bất biến phủ các repo đó thì mở việc riêng.)

## Nhật ký spec rework (vòng 1, defect T-208-D1)
Đã sửa: câu "Không workflow nào có thêm quyền ghi" chỉ cấm thêm, không đòi giữ; nay thêm câu "quyền hiệu lực mọi scope khác `actions` giữ nguyên; job mở PR/đẩy nhánh giữ contents+pull-requests write" và eval check_4. Lý do: cách sửa (b)(c)(d) thoả cả ba eval cũ nhưng làm bước "Open PR" chết 403 sau khi đã chi Google. Chief of Staff đã chốt dạng so ảnh chụp cho riêng việc này, quy tắc chung cho bất biến.
