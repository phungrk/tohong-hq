#!/usr/bin/env python3
"""T-139 adv-01 (tầng 3, adversary): lần chạy resolve-overrides do một PR KHÔNG phải lô duyệt tay (job bị `if` bỏ qua) không được làm sổ đăng ký chặn lần chạy thật.

Vì sao: T-135 thêm `pull_request: closed` nên MỌI PR merge vào main (T-138, PR dữ liệu, PR code...) đều tạo một lần chạy resolve-overrides, và `run-name`
đánh giá ra "REAL ..." cho mọi sự kiện pull_request (kể cả nhánh khác, công tắc tắt). Workflow có `concurrency: google-places` ở CẤP WORKFLOW, nên lần chạy đó
xếp hàng trong nhóm Google: khi một workflow Google khác đang chạy thì nó ở trạng thái `queued`/pending (conclusion rỗng), và nếu thêm một PR nữa được merge thì GitHub
HUỶ lần đang chờ (conclusion `cancelled`, không có job nào). `check_runs.py` coi mọi lần REAL trừ `skipped` là phải có log; lần chạy này không có job nên
`blocked_before_google` trả False -> MISSING_RUN_LOG. Hậu quả: (a) Capu merge PR duyệt tay rồi merge thêm một PR khác trong lúc lần tự chạy đang cài thư viện ->
cổng sổ đăng ký của chính lần tự chạy thấy lần "REAL" đang chờ và từ chối; (b) lần bị huỷ khi chờ làm MỌI workflow Google (kể cả Run workflow tay) bị chặn mãi cho tới khi
Capu ghi runs_accounted + ADR. Không tốn tiền (an toàn phía chi) nhưng làm hỏng tính năng chính của T-135 và đẩy quyết định lên Capu.

Chạy NGUYÊN VĂN các bước "Cổng: ..." của resolve-overrides.yml (gh giả, jobs API trả {"jobs": []} như lần chạy chưa có job), với displayTitle của lần chạy kia
tính bằng chính biểu thức `run-name` của workflow trên sự kiện của nó. Kỳ vọng:
  (1)-(4) lần chạy không khớp (PR nhánh khác đang chờ / bị huỷ khi chờ; PR admin-reviews/capu khi công tắc tắt bị huỷ khi chờ; PR đóng không merge bị huỷ) -> cổng sổ đăng ký QUA;
  (5) đối chứng: lần chạy REAL đã thật sự chạy bước "Google: ..." (success) mà không có log -> cổng vẫn ĐỎ MISSING_RUN_LOG (sửa không được mở lỗ chi).
Cách sửa nào cũng được (run-name không REAL cho sự kiện không khớp, concurrency ở cấp job, hoặc check_runs coi lần chạy chưa có job nào là chưa gọi Google), miễn (5) còn đỏ.
In PASS / FAIL; thoát 0/1. Không mạng, không Google."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-135"))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None:
    print("FAIL thiếu resolve-overrides.yml"); sys.exit(1)
jname = next(iter(wf["jobs"]))
REPO = "phungrk/tohong"
bad = []
box = t.Box(t.TOHONG)


def title_for(event, vars_):
    c = t.gh_ctx(box, "pull_request", event=event, vars_=vars_, run_id="555")
    return t.interp(wf.get("run-name") or "", c)


def gate(other, jobs_for_other):
    """Chạy các bước Cổng của lần tự chạy hợp lệ (run 4242) khi sổ có thêm lần chạy `other`. Trả (outcome bước sổ đăng ký, log)."""
    box.reset()
    box.gh_db({"prs": [], "runs": {"resolve-overrides.yml": [other]},
               "api": {"repos/%s/actions/runs/%s/jobs" % (REPO, other["databaseId"]): jobs_for_other}})
    c = t.gh_ctx(box, "pull_request", event=t.pr_event(), vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets={"GOOGLE_MAPS_API_KEY": "fake-key-not-real"})
    res = t.run_job(box, wf, jname, c, uses={"actions/": lambda w, s: {}}, only=lambda s: str(s.get("name", "")).startswith("Cổng:") and "hạn mức" not in str(s.get("name", "")))
    reg = next((v for k, v in res["steps"].items() if "check_runs.py" in str(next((s.get("run") for s in wf["jobs"][jname]["steps"] if (s.get("id") or s.get("name")) == k), ""))), None)
    return (reg or {}).get("outcome"), res["log"]


try:
    on = {"AUTO_RESOLVE_OVERRIDES": "true"}
    off = {"AUTO_RESOLVE_OVERRIDES": "false"}
    cases = [
        ("(1) PR feat/t138 merge, lần chạy đang chờ trong nhóm google-places", t.pr_event(number=94, ref="feat/t138"), on, "queued", None),
        ("(2) PR feat/t138 merge, lần chạy bị huỷ khi chờ (PR thứ hai merge ngay sau)", t.pr_event(number=94, ref="feat/t138"), on, "completed", "cancelled"),
        ("(3) PR admin-reviews/capu merge khi công tắc TẮT, bị huỷ khi chờ", t.pr_event(number=93), off, "completed", "cancelled"),
        ("(4) PR đóng không merge, bị huỷ khi chờ", t.pr_event(number=96, ref="feat/x", merged=False), on, "completed", "cancelled"),
    ]
    for label, ev_, vars_, status, concl in cases:
        title = title_for(ev_, vars_)
        other = {"databaseId": 555, "displayTitle": title, "workflowName": "Resolve overrides (duyệt tay của Capu)", "status": status, "conclusion": concl}
        out, log = gate(other, {"jobs": []})
        if out != "success":
            bad.append("%s: displayTitle %r -> cổng sổ đăng ký %s (lần chạy này chưa có job nào, không thể đã gọi Google): %s" % (label, title, out, log.strip().splitlines()[-1][:160] if log.strip() else ""))
    # (5) đối chứng: lần REAL đã chạy bước Google mà không có log thì vẫn phải chặn
    other = {"databaseId": 556, "displayTitle": "REAL Resolve overrides (run 556)", "workflowName": "Resolve overrides (duyệt tay của Capu)", "status": "completed", "conclusion": "failure"}
    jobs = {"jobs": [{"name": jname, "conclusion": "failure", "steps": [
        {"name": "Cổng: không Re-run workflow Google", "status": "completed", "conclusion": "success"},
        {"name": "Cổng: sổ đăng ký lần chạy (gh run list + gh pr list)", "status": "completed", "conclusion": "success"},
        {"name": "Google: Resolve (đổi link/place_id thành place_id)", "status": "completed", "conclusion": "success"}]}]}
    out, log = gate(other, jobs)
    if out != "failure" or "MISSING_RUN_LOG" not in log:
        bad.append("(5) đối chứng: lần REAL đã chạy bước Google, thiếu log -> cổng phải ĐỎ MISSING_RUN_LOG, thấy %s" % out)
finally:
    box.cleanup()
t.done(bad, "lần chạy không khớp (đang chờ / bị huỷ khi chờ / công tắc tắt) không chặn sổ đăng ký; lần REAL thiếu log vẫn bị chặn")
