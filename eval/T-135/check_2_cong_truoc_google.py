#!/usr/bin/env python3
"""T-135 tiêu chí 2 (repo tohong): lần chạy TỰ ĐỘNG bị chặn TRƯỚC mọi bước Google bởi hai cổng, chạy NGUYÊN VĂN bước workflow trên bản sao git của repo thật (gh giả đúng cách gh thật chọn repo):
  1. bước đầu tiên "Cổng: không Re-run workflow Google" (run_attempt > 1 thì đỏ; Re-run giữ run id nên log lần trước lọt khỏi sổ);
  2. một bước "Cổng: …" đứng TRƯỚC bước "Google: …" đầu tiên chạy `gh run list` cho mọi workflow Google (enrich-vendors, enrich-venue, refresh-vendor-photos, scrape-vendors, resolve-overrides)
     + `gh pr list --state open` rồi `check_runs.py` (sổ đăng ký, ADR-049: mọi lần chạy thật trước đó phải có log trên main, và không còn PR dữ liệu đang mở).
Tình huống (sự kiện pull_request merged, công tắc bật):
  (A) run_attempt=2 -> job đỏ, mọi bước "Google:" skipped, 0 lần gọi resolve_overrides.py / enrich.py / refresh_photos.py;
  (B) còn PR dữ liệu mở nhánh enrich-vendors/run-1 -> đỏ ở cổng sổ đăng ký, in OPEN_DATA_PR, 0 lần gọi script Google;
  (C) có lần chạy REAL trước đó (conclusion failure) mà không có log trên main -> đỏ, in MISSING_RUN_LOG, 0 lần gọi script Google;
  (D) sạch -> cổng qua, bước Google đầu tiên được chạy (không bị skip).
Không mạng (kết nối bị chặn), không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None:
    print("FAIL thiếu .github/workflows/resolve-overrides.yml"); sys.exit(1)
job = next(iter(wf["jobs"].values()))
steps = job["steps"]
names = [s.get("name", "") for s in steps]
bad = []
if not names or names[0] != "Cổng: không Re-run workflow Google":
    bad.append("bước đầu tiên phải là 'Cổng: không Re-run workflow Google'; thấy %r" % (names[:1],))
gi = next((i for i, n in enumerate(names) if n.startswith("Google:")), None)
reg = [i for i, s in enumerate(steps) if s.get("name", "").startswith("Cổng:") and "check_runs.py" in str(s.get("run", ""))]
quo = [i for i, n in enumerate(names) if n.startswith("Cổng: hạn mức")]
if gi is None: bad.append("không có bước nào tên bắt đầu 'Google:'")
if not quo: bad.append("thiếu bước 'Cổng: hạn mức…' (tiêu chí 10)")
elif gi is not None and quo[0] > gi: bad.append("cổng hạn mức đứng SAU bước Google đầu tiên")
if not reg: bad.append("thiếu bước 'Cổng: …' chạy check_runs.py (sổ đăng ký) — enrich-vendors.yml đã có, resolve-overrides.yml chưa")
elif gi is not None and reg[0] > gi: bad.append("cổng sổ đăng ký đứng SAU bước Google đầu tiên")
if bad:
    t.done(bad, "")
GOOGLE_PY = re.compile(r"(resolve_overrides\.py|enrich\.py|refresh_photos\.py)")
def google_calls(box):
    out = []
    for cwd, args in box.py_calls():
        m = GOOGLE_PY.search(args)
        if m and "--probe" not in args and "--dry-run" not in args and "--apply-review-rule" not in args:
            out.append(args[:80])
    return out
box = t.Box(t.TOHONG)
try:
    def run(attempt="1", prs=None, runs=None):
        box.reset()
        box.gh_db({"prs": prs or [], "runs": {"resolve-overrides.yml": runs or []}})
        c = t.gh_ctx(box, "pull_request", event=t.pr_event(), attempt=attempt, vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets={"GOOGLE_MAPS_API_KEY": "fake-key-not-real"})
        res = t.run_job(box, wf, next(iter(wf["jobs"])), c, uses={"actions/": lambda w, s: {}, "peter-evans/": lambda w, s: {}})
        return res
    for label, kw, want_text in (("(A) run_attempt=2", {"attempt": "2"}, None),
                                 ("(B) PR dữ liệu còn mở", {"prs": [{"number": 5, "headRefName": "enrich-vendors/run-1"}]}, "OPEN_DATA_PR"),
                                 ("(C) lần chạy REAL trước không có log", {"runs": [{"databaseId": 999, "displayTitle": "REAL Resolve overrides (run 999)", "workflowName": "Resolve overrides", "status": "completed", "conclusion": "failure"}]}, "MISSING_RUN_LOG")):
        res = run(**kw)
        gsteps = [(n, o) for n, o in res["order"] if n.startswith("Google:")]
        if res["status"] != "failure": bad.append("%s: job phải đỏ ở cổng, thấy %s" % (label, res["status"]))
        if any(o != "skipped" for _, o in gsteps): bad.append("%s: có bước Google không bị skip: %s" % (label, [n for n, o in gsteps if o != "skipped"]))
        if google_calls(box): bad.append("%s: đã gọi script Google: %s" % (label, google_calls(box)))
        if want_text and want_text not in res["log"]: bad.append("%s: log thiếu %s" % (label, want_text))
    res = run()
    ran = [(n, o) for n, o in res["order"] if n.startswith("Google:") and o != "skipped"]
    if not ran: bad.append("(D) sạch: không bước Google nào chạy (cổng chặn nhầm): %s" % res["log"][-300:])
    wfs = {c["argv"][c["argv"].index("--workflow") + 1] for c in box.gh_calls() if c["argv"][:2] == ["run", "list"] and "--workflow" in c["argv"]}
    need = {"enrich-vendors.yml", "enrich-venue.yml", "refresh-vendor-photos.yml", "scrape-vendors.yml", "resolve-overrides.yml"}
    if need - wfs: bad.append("(D) gh run list thiếu workflow %s (lần chạy REAL của chúng lọt khỏi sổ đăng ký)" % sorted(need - wfs))
    if not any(c["argv"][:2] == ["pr", "list"] for c in box.gh_calls()): bad.append("(D) không gọi gh pr list --state open")
finally:
    box.cleanup()
t.done(bad, "Cổng Re-run và cổng sổ đăng ký chặn trước mọi bước Google ở run_attempt 2, PR dữ liệu mở và lần chạy thiếu log; tình huống sạch thì qua")
