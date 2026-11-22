#!/usr/bin/env python3
"""T-219 tiêu chí 1 (tĩnh, offline): hình dạng workflow `discover-vendors-p0.yml` của repo tohong. Chỉ đọc YAML, không chạy gì."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
try:
    import yaml
except ImportError:
    k.fail("thiếu PyYAML")
p = os.path.join(k.tohong(), ".github", "workflows", "discover-vendors-p0.yml")
if not os.path.isfile(p):
    k.fail("thiếu .github/workflows/discover-vendors-p0.yml")
wf = yaml.safe_load(open(p, encoding="utf-8")) or {}
bad = []
on = wf.get("on") if "on" in wf else wf.get(True)
if not isinstance(on, dict) or set(on) != {"workflow_dispatch"}:
    bad.append("trigger phải CHỈ là workflow_dispatch, thấy %r" % (sorted(on) if isinstance(on, dict) else on))
ins = ((on or {}).get("workflow_dispatch") or {}).get("inputs") or {}
for name, dv in (("dry_run", "true"), ("max_text_search", "288"), ("max_details", "120"), ("max_gemini", "100"), ("max_usd", "3.00"), ("cap_basis", "net"), ("stage", "measure")):
    if str((ins.get(name) or {}).get("default")) not in (dv, dv.rstrip("0").rstrip(".") if "." in dv else dv):
        bad.append("input %s mặc định phải là %s, thấy %r" % (name, dv, (ins.get(name) or {}).get("default")))
for name in ("gemini_model", "source_run_id", "labels_path"):
    if name not in ins:
        bad.append("thiếu input %s" % name)
rn = str(wf.get("run-name") or "")
if not (rn.startswith("${{") and "REAL" in rn and "DRY" in rn and "dry_run" in rn):
    bad.append("run-name phải chọn REAL/DRY theo dry_run (check_runs đọc tiền tố REAL), thấy %r" % rn[:80])
perm = wf.get("permissions") or {}
for sc, v in (("contents", "write"), ("pull-requests", "write"), ("actions", "read")):
    if perm.get(sc) != v:
        bad.append("permissions.%s phải là %s" % (sc, v))
cc = wf.get("concurrency") or {}
if cc.get("group") != "google-places" or cc.get("cancel-in-progress") is not False:
    bad.append("concurrency phải là group google-places, cancel-in-progress false")
jobs = wf.get("jobs") or {}
if not jobs:
    bad.append("không có job")
SECRET_ENV = re.compile(r"^\$\{\{\s*secrets\.(GEMINI_API_KEY|GOOGLE_MAPS_API_KEY)\s*\}\}$")
n_google = 0
for jn, j in jobs.items():
    steps = j.get("steps") or []
    env_all = {}
    if not steps or str(steps[0].get("name")) != "Cổng: không Re-run workflow Google":
        bad.append("%s: bước đầu phải tên 'Cổng: không Re-run workflow Google'" % jn)
    for s in steps:
        nm, run, env = str(s.get("name") or ""), str(s.get("run") or ""), s.get("env") or {}
        names_key = [e for e in ("GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY") if e in env or e in (j.get("env") or {}) or e in (wf.get("env") or {})]
        if names_key:
            if e_job := [e for e in ("GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY") if e in (j.get("env") or {}) or e in (wf.get("env") or {})]:
                bad.append("%s: khoá %s đặt ở cấp job/workflow, chỉ được ở env của bước 'Google:'" % (jn, e_job))
            if not nm.startswith("Google:"):
                bad.append("bước '%s' nhận khoá mà tên không bắt đầu 'Google:'" % nm)
            for e in names_key:
                if not SECRET_ENV.match(str(env.get(e, ""))):
                    bad.append("bước '%s': %s phải lấy từ ${{ secrets.%s }}, thấy %r" % (nm, e, e, env.get(e)))
            n_google += 1
            if set(names_key) != {"GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY"}:
                bad.append("bước '%s' phải mang đủ cả hai khoá" % nm)
            for c in ("--max-text-search", "--max-details", "--max-gemini", "--max-usd"):
                if c not in run:
                    bad.append("bước '%s' không truyền tường minh %s" % (nm, c))
            if re.search(r"set\s+-\w*x|printenv|^\s*env\s*(\||$)|--api-key|echo[^\n]*(API_KEY|\$GEMINI|\$GOOGLE)", run, re.M):
                bad.append("bước '%s' có lệnh có thể lộ khoá (set -x/printenv/env/--api-key/echo khoá)" % nm)
            if "pipefail" not in run:
                bad.append("bước '%s' phải `set -o pipefail` (planner inv-006: lệnh qua tee)" % nm)
            # log chạy = stdout của CLI qua tee (CLI không tự ghi file log: ghi hai nơi thì sổ đếm đôi), vào run-logs/T-219 NGAY trong lúc chạy (planner inv-024)
            if not (re.search(r"\btee\b", run) and "run-logs/T-219" in run and ".part" in run and re.search(r"-run-(\$\{\{\s*github\.run_id\s*\}\}|\$\{?GITHUB_RUN_ID\}?)-discover\.log", run)):
                bad.append("bước '%s': stdout của CLI phải qua `tee run-logs/T-219/<…>-run-<run_id>-discover.log.part` (cùng cách enrich-vendors)" % nm)
            if re.search(r"--log-dir|--log-file", run):
                bad.append("bước '%s' không được truyền cờ log cho CLI (CLI không tự ghi log)" % nm)
        if "--dry-run" in run and ("secrets." in str(env) ):
            bad.append("bước dry-run '%s' không được mang khoá" % nm)
        if "check_runs.py" in run:
            if not nm.startswith("Cổng:") or "dry_run" not in str(s.get("if")) or "github.token" not in str(env.get("GH_TOKEN")):
                bad.append("bước check_runs '%s': tên bắt đầu 'Cổng:', có if theo dry_run, GH_TOKEN từ github.token" % nm)
        if re.search(r"sync-vendor-pool", run + str(s.get("uses"))):
            bad.append("workflow không được kích hoạt sync-vendor-pool (bước '%s')" % nm)
        u = str(s.get("uses") or "")
        w = s.get("with") or {}
        if u.startswith("actions/upload-artifact"):
            rd = w.get("retention-days")
            if not isinstance(rd, int) or not (1 <= rd <= 14):
                bad.append("upload-artifact phải có retention-days nguyên trong 1..14 (nội dung Maps), thấy %r" % rd)
        if u.startswith("peter-evans/create-pull-request"):
            ap = str(w.get("add-paths") or "")
            if not str(w.get("branch") or "").startswith("discover-p0/"):
                bad.append("nhánh PR phải bắt đầu discover-p0/, thấy %r" % w.get("branch"))
            for pat in ("output/", "vendors.json", "enrich-report", "manual_overrides", "removed_vendors", "pool", "generated", "private"):
                if pat in ap:
                    bad.append("add-paths chứa %r (dữ liệu/nội dung Maps không được vào PR)" % pat)
            if "run-logs/T-219" not in ap or "p0-reports/T-219" not in ap:
                bad.append("add-paths phải có run-logs/T-219 và p0-reports/T-219")
if not any("always()" in str(s.get("if")) and ".log.part" in str(s.get("run")) for j in jobs.values() for s in (j.get("steps") or [])):
    bad.append("thiếu bước always() đổi *.log.part còn sót (lần bị huỷ) về *.log để add-paths và check_runs thấy")
if n_google == 0:
    bad.append("không có bước 'Google:' nào mang khoá")
k.done(bad, "workflow chỉ chạy tay, dry-run mặc định, khoá chỉ qua secrets ở bước 'Google:', PR chỉ log + báo cáo tổng hợp")
