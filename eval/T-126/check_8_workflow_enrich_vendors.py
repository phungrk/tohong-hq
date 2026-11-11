#!/usr/bin/env python3
"""T-126 tiêu chí 8 (workflow chạy thật `.github/workflows/enrich-vendors.yml`: hai cờ mới, báo cáo vào PR, cổng cũ giữ nguyên). KHÔNG mạng, KHÔNG Google: chạy NGUYÊN VĂN `run:` của các bước trong bash với `python` giả
(in tham số rồi thoát 0), như INV-023/024.
Mong:
  (a) `on.workflow_dispatch.inputs` có `apply_review_rule` và `confirm_review_count`, mặc định "false" (chuỗi)
  (b) bước dry-run và bước "Google: ..." thật: không input nào = lệnh python KHÔNG có `--apply-review-rule`/`--confirm-review-count` (giữ hành vi cũ); apply_review_rule=true -> có `--apply-review-rule`, không có
      `--confirm-review-count`; cả hai true -> có cả hai; bước dry-run luôn có `--dry-run` ở cuối lệnh
  (c) bước tên "Cổng: confirm_review_count cần apply_review_rule": confirm=true mà apply!=true thoát khác 0; các tổ hợp khác thoát 0 (bước đứng TRƯỚC mọi bước dry-run/Google)
  (d) `add-paths` của bước Open PR có `tools/scraper/output/HCMC/**/low-review-demoted.csv` (cạnh name-match-accepted.csv); bước Summary có `REVIEW_SCOPE` trong biểu thức lọc dòng; bước Test chạy `python test_t126_review_rule.py`
  (e) cổng cũ không đổi: bước 1 vẫn là "Cổng: không Re-run workflow Google"; INV-023 và INV-024 (chạy script thật) PASS
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, subprocess, sys, tempfile, yaml
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
t = k.t
bad = []
repo = t.c.tohong()
p = os.path.join(repo, ".github", "workflows", "enrich-vendors.yml")
if not os.path.isfile(p):
    t.fail("không thấy %s" % p)
wf = yaml.safe_load(open(p, encoding="utf-8"))
on = wf.get("on") or wf.get(True) or {}
ins = (on.get("workflow_dispatch") or {}).get("inputs") or {}
for nm in ("apply_review_rule", "confirm_review_count"):
    if str((ins.get(nm) or {}).get("default")) != "false":
        bad.append("input %s thiếu hoặc mặc định khác chuỗi 'false' (thấy %r)" % (nm, (ins.get(nm) or {}).get("default")))
steps = wf["jobs"]["enrich-vendors"]["steps"]
byname = {s.get("name", ""): s for s in steps}
first = steps[0].get("name")
if first != "Cổng: không Re-run workflow Google":
    bad.append("bước 1 không còn là cổng Re-run (thấy %r)" % first)
gate = byname.get("Cổng: confirm_review_count cần apply_review_rule")
dry = next((s for s in steps if str(s.get("name", "")).startswith("Dry run")), None)
real = next((s for s in steps if str(s.get("name", "")).startswith("Google:")), None)
if not (gate and dry and real):
    t.fail("thiếu bước: cổng confirm=%s, dry-run=%s, Google thật=%s" % (bool(gate), bool(dry), bool(real)))
idx = {id(s): i for i, s in enumerate(steps)}
if not (idx[id(gate)] < idx[id(dry)] and idx[id(gate)] < idx[id(real)]):
    bad.append("cổng confirm/apply phải đứng trước bước dry-run và bước Google thật")
FAKE_PY = "#!/bin/sh\necho \"ARGS: $*\"\nexit 0\n"


def run_step(step, env_over, expect_rc0=True):
    with tempfile.TemporaryDirectory() as ws:
        wd = os.path.join(ws, "tools", "scraper")
        os.makedirs(wd)
        bind = os.path.join(ws, "bin")
        os.makedirs(bind)
        open(os.path.join(bind, "python"), "w").write(FAKE_PY)
        os.chmod(os.path.join(bind, "python"), 0o755)
        env = {"PATH": bind + os.pathsep + os.environ["PATH"], "HOME": ws, "RUNNER_TEMP": ws, "GITHUB_STEP_SUMMARY": os.path.join(ws, "s.md")}
        for kk, vv in (step.get("env") or {}).items():
            m = re.search(r"github\.event\.inputs\.(\w+)", str(vv))
            if m:
                env[kk] = env_over.get(m.group(1), "")
            elif "secrets." in str(vv):
                env[kk] = "fake-not-a-key"
            elif "github.run_id" in str(vv):
                env[kk] = "777"
        for kk, vv in env_over.items():
            env.setdefault(kk, vv)
        script = step["run"].replace("${{ github.run_id }}", "777").replace("${{ github.run_attempt }}", "1")
        r = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", script], cwd=wd, env=env, capture_output=True, text=True, timeout=60)
        return r.returncode, (r.stdout or "") + (r.stderr or "")


for ap, cf, want_gate_ok in (("false", "false", True), ("true", "false", True), ("true", "true", True), ("false", "true", False)):
    ov = {"apply_review_rule": ap, "confirm_review_count": cf, "dry_run": "true", "budget_usd": "30", "categories": "all", "max_photos": "2", "cap_basis": "net", "include_non_pool": "false", "recheck_name_match": "false"}
    rc, out = run_step(gate, ov)
    if (rc == 0) != want_gate_ok:
        bad.append("cổng confirm/apply với apply=%s confirm=%s thoát %d, mong %s" % (ap, cf, rc, "0" if want_gate_ok else "khác 0"))
    if not want_gate_ok:
        continue
    for label, step in (("dry-run", dry), ("Google thật", real)):
        rc, out = run_step(step, ov)
        line = next((l for l in out.splitlines() if l.startswith("ARGS:") and "enrich.py" in l), "")
        if rc != 0 or not line:
            bad.append("%s (apply=%s confirm=%s): không chạy được lệnh enrich.py (rc=%d): %s" % (label, ap, cf, rc, out.strip().splitlines()[-1:] or [""]))
            continue
        has_a, has_c = "--apply-review-rule" in line, "--confirm-review-count" in line
        if has_a != (ap == "true") or has_c != (cf == "true"):
            bad.append("%s (apply=%s confirm=%s): lệnh có apply=%s confirm=%s: %s" % (label, ap, cf, has_a, has_c, line[:160]))
        if label == "dry-run" and not line.rstrip().endswith("--dry-run"):
            bad.append("dry-run: `--dry-run` phải ở cuối lệnh (thấy %r)" % line[-60:])
        if label == "Google thật" and "--dry-run" in line:
            bad.append("bước Google thật có --dry-run")
openpr = next((s for s in steps if "create-pull-request" in str(s.get("uses", ""))), None)
paths = str(((openpr or {}).get("with") or {}).get("add-paths", ""))
if "tools/scraper/output/HCMC/**/low-review-demoted.csv" not in paths or "name-match-accepted.csv" not in paths:
    bad.append("add-paths của bước Open PR thiếu tools/scraper/output/HCMC/**/low-review-demoted.csv (Capu không thấy sổ trong PR dữ liệu)")
summ = byname.get("Summary") or {}
if "REVIEW_SCOPE" not in str(summ.get("run", "")):
    bad.append("bước Summary không lọc dòng REVIEW_SCOPE")
if "python test_t126_review_rule.py" not in str((byname.get("Test (không gọi Google)") or {}).get("run", "")):
    bad.append("bước Test không chạy `python test_t126_review_rule.py`")
for n_ in (23, 24):
    pth = t.inv_scripts(n_)
    if len(pth) != 1:
        bad.append("thiếu INV-0%d" % n_)
        continue
    r = subprocess.run([sys.executable, "-I", pth[0]], cwd=t.HQ, env=dict(os.environ, TOHONG_REPO=repo), capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        bad.append("INV-0%d đỏ sau khi sửa workflow: %s" % (n_, ((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1:]))
t.done(bad, "enrich-vendors.yml: hai input mặc định false, cờ truyền đúng ở dry-run và chạy thật, cổng confirm cần apply, add-paths có low-review-demoted.csv, Summary lọc REVIEW_SCOPE, INV-023/024 xanh")
