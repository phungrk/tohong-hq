#!/usr/bin/env python3
"""T-210 adv-03: ở workflow có cổng check_runs.py, mọi step nhận GOOGLE_MAPS_API_KEY có tên bắt đầu 'Google:' và mọi step cổng
(chạy check_runs.py) có tên bắt đầu 'Cổng:'. blocked_before_google chỉ nhìn tiền tố tên: step gọi Google mà tên khác thì lần chạy
bị chặn bị coi 'không gọi Google' sai. Rồi mô phỏng offline: lần REAL fail ở bước cổng, mọi 'Google:' skipped -> check_runs.py thoát 0. 0 = đạt."""
import glob, os, re, sys, subprocess, json, tempfile
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML"); sys.exit(1)
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isdir(os.path.join(c, ".github", "workflows"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tohong/.github/workflows)"); sys.exit(0)
WFS = sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml")))
def load(p): return yaml.safe_load(open(p, encoding="utf-8")) or {}
def perms(wf, job):
    p = job["permissions"] if "permissions" in job else wf.get("permissions")
    if p is None: return None
    if isinstance(p, str): return {"*": p}
    return {str(k): str(v) for k, v in p.items()}
bad = []
scraper = os.path.join(repo, "tools", "scraper", "check_runs.py")
for p in WFS:
    wf = load(p); b = os.path.basename(p)
    for jn, j in (wf.get("jobs") or {}).items():
        steps = j.get("steps") or []
        if not any("check_runs.py" in str(s.get("run", "")) for s in steps): continue
        for s in steps:
            nm = str(s.get("name") or "")
            if "GOOGLE_MAPS_API_KEY" in str(s.get("env") or {}) and not nm.startswith("Google:"):
                bad.append("%s/%s step '%s' nhận khoá Google mà tên không bắt đầu 'Google:'" % (b, jn, nm or s.get("uses") or s.get("run", "")[:30]))
            if "check_runs.py" in str(s.get("run", "")) and not nm.startswith("Cổng:"):
                bad.append("%s/%s step cổng '%s' không bắt đầu 'Cổng:'" % (b, jn, nm))
        if b == "resolve-overrides.yml" and os.path.isfile(scraper):
            gate_seen, js = False, []
            for s in steps:
                nm = str(s.get("name") or "")
                if "check_runs.py" in str(s.get("run", "")): js.append({"name": nm, "status": "completed", "conclusion": "failure"}); gate_seen = True
                else: js.append({"name": nm, "status": "completed", "conclusion": "skipped" if gate_seen and nm.startswith("Google:") else "success"})
            with tempfile.TemporaryDirectory() as t:
                json.dump({"jobs": [{"steps": js}]}, open(os.path.join(t, "111.json"), "w"))
                json.dump([{"databaseId": 111, "displayTitle": "REAL Resolve overrides (run 111)", "workflowName": "Resolve overrides", "status": "completed", "conclusion": "failure"}], open(os.path.join(t, "runs.json"), "w"))
                json.dump([], open(os.path.join(t, "prs.json"), "w"))
                os.makedirs(os.path.join(t, "rl", "X"))
                env = {**os.environ, "CHECK_RUNS_JOBS_DIR": t, "GITHUB_RUN_ATTEMPT": "1"}
                r = subprocess.run([sys.executable, "-I", scraper, "--runs", os.path.join(t, "runs.json"), "--prs", os.path.join(t, "prs.json"), "--usage-root", os.path.join(t, "rl"), "--current", "222"], capture_output=True, text=True, env=env)
                if r.returncode != 0 or "BLOCKED_BEFORE_GOOGLE 111" not in r.stdout:
                    bad.append("mô phỏng: lần REAL chết ở cổng vẫn chặn lần sau: " + r.stdout.strip()[-200:])
print("PASS" if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
