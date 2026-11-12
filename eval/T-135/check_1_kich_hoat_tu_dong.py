#!/usr/bin/env python3
"""T-135 tiêu chí 1 (repo tohong): resolve-overrides.yml TỰ chạy thật khi và CHỈ KHI Capu merge PR `admin-reviews/capu` (PR duyệt tay của apply-admin-reviews), có công tắc của Capu.
Đo bằng đánh giá biểu thức `if:` cấp job và `run-name` theo ngữ nghĩa GitHub (so sánh lỏng: `true == 'true'` là sai) trên các sự kiện:
  merged + head admin-reviews/capu + cùng repo + vars.AUTO_RESOLVE_OVERRIDES='true'  -> CHẠY, run-name bắt đầu "REAL " (sổ đăng ký check_runs chỉ đếm tên REAL)
  công tắc vắng / 'false' / 'TRUE ' không phải 'true'                                  -> KHÔNG chạy (mặc định tắt; Capu bật bằng Settings > Variables, không đặt thay Capu)
  PR đóng không merge; PR từ nhánh khác (feat/x); `admin-reviews/capu-x`; PR từ fork cùng tên nhánh -> KHÔNG chạy
  PR dữ liệu cuối `resolve-overrides/run-N` được merge (đổi cả manual_overrides.json!)            -> KHÔNG chạy (không vòng lặp tự gọi Google)
  workflow_dispatch (Capu bấm tay, dry_run mặc định true)                                          -> CHẠY, run-name DRY khi dry_run=true, REAL khi false
Tĩnh: `on` chỉ gồm workflow_dispatch và pull_request{types:[closed], branches:[main]} (không push, schedule, pull_request_target, workflow_run); inputs cũ còn nguyên (dry_run mặc định "true").
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None:
    print("FAIL thiếu .github/workflows/resolve-overrides.yml"); sys.exit(1)
bad = []
on = t.on_of(wf)
if set(on) != {"workflow_dispatch", "pull_request"}:
    bad.append("on = %s, mong đúng {workflow_dispatch, pull_request}" % sorted(on))
else:
    pr = on["pull_request"] or {}
    if list(pr.get("types") or []) != ["closed"] or list(pr.get("branches") or []) != ["main"]:
        bad.append("pull_request phải có types: [closed] và branches: [main]; thấy %r" % (pr,))
    if (((on["workflow_dispatch"] or {}).get("inputs") or {}).get("dry_run") or {}).get("default") != "true":
        bad.append("workflow_dispatch.inputs.dry_run phải còn mặc định \"true\"")
jobs = wf.get("jobs") or {}
if len(jobs) != 1:
    bad.append("mong đúng một job")
if bad:
    t.done(bad, "")
job = next(iter(jobs.values()))
box = type("B", (), {"ws": "/w", "rt": "/r"})()
def go(ev, var="true", name="pull_request", inputs=None, repo="phungrk/tohong"):
    c = t.gh_ctx(box, name, event=ev, inputs=inputs, repo=repo, vars_={} if var is None else {"AUTO_RESOLVE_OVERRIDES": var})
    try:
        return t._truthy(t.ev(str(job["if"]).strip().strip("${}").strip(), c)) if job.get("if") is not None else True, c
    except Exception as e:  # noqa: BLE001
        bad.append("`if` cấp job không đánh giá được (%s): viết bằng && || == và các context github./vars., không hàm lạ" % e); return None, c
CASES = [
    ("merge PR duyệt tay, công tắc bật", t.pr_event(), "true", True),
    ("công tắc vắng (mặc định tắt)", t.pr_event(), None, False),
    ("công tắc 'false'", t.pr_event(), "false", False),
    ("PR duyệt tay đóng KHÔNG merge", t.pr_event(merged=False), "true", False),
    ("PR nhánh khác (feat/x)", t.pr_event(ref="feat/x"), "true", False),
    ("nhánh admin-reviews/capu-x", t.pr_event(ref="admin-reviews/capu-x"), "true", False),
    ("PR từ fork cùng tên nhánh", t.pr_event(repo="evil/tohong"), "true", False),
    ("PR dữ liệu cuối resolve-overrides/run-5 được merge (không vòng lặp)", t.pr_event(ref="resolve-overrides/run-5"), "true", False),
]
for label, e, var, want in CASES:
    got, _ = go(e, var)
    if got is not None and got != want:
        bad.append("%s: job %s, mong %s" % (label, "chạy" if got else "không chạy", "chạy" if want else "không chạy"))
got, _ = go({}, var=None, name="workflow_dispatch", inputs={"dry_run": "true"})
if got is False: bad.append("workflow_dispatch (Capu bấm tay) phải luôn chạy được, kể cả công tắc tắt")
rn = str(wf.get("run-name", ""))
for label, name, ev_, inp, want in (("pull_request merged", "pull_request", t.pr_event(), {}, "REAL "), ("dispatch dry_run=true", "workflow_dispatch", {}, {"dry_run": "true"}, "DRY "),
                                     ("dispatch dry_run=false", "workflow_dispatch", {}, {"dry_run": "false"}, "REAL "), ("dispatch không nhập dry_run", "workflow_dispatch", {}, {}, "DRY ")):
    c = t.gh_ctx(box, name, event=ev_, inputs=inp, vars_={"AUTO_RESOLVE_OVERRIDES": "true"})
    try:
        out = t.interp(rn, c)
    except Exception as e:  # noqa: BLE001
        bad.append("run-name không đánh giá được: %s" % e); break
    if not out.startswith(want):
        bad.append("run-name của %s = %r, phải bắt đầu %r (check_runs.py đếm lần chạy thật theo tiền tố REAL)" % (label, out, want))
t.done(bad, "resolve-overrides.yml tự chạy thật đúng khi merge PR admin-reviews/capu (cùng repo, công tắc bật), không chạy ở 8 tình huống còn lại, không vòng lặp, run-name REAL/DRY đúng")
