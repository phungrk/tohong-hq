#!/usr/bin/env python3
"""T-210 adv-02: mọi step chạy check_runs.py đặt GH_TOKEN (từ github.token) trong env. check_runs.blocked_before_google gọi
'gh api .../actions/runs/<id>/jobs'; không token thì trả False và lần REAL bị chặn ở cổng (vd 44332847247) thành MISSING_RUN_LOG: cổng vẫn chết sau khi đã có actions: read.
Kèm: job đó có actions: read hiệu lực. Tĩnh. 0 = đạt."""
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
bad, n = [], 0
for p in WFS:
    wf = load(p)
    for jn, j in (wf.get("jobs") or {}).items():
        for s in j.get("steps") or []:
            if "check_runs.py" not in str(s.get("run", "")): continue
            n += 1
            env = {**(wf.get("env") or {}), **(j.get("env") or {}), **(s.get("env") or {})}
            if "github.token" not in str(env.get("GH_TOKEN", "")) and "GITHUB_TOKEN" not in str(env.get("GH_TOKEN", "")):
                bad.append("%s/%s step '%s': thiếu GH_TOKEN" % (os.path.basename(p), jn, s.get("name")))
            pr = perms(wf, j) or {}
            if not (pr.get("actions") in ("read", "write") or pr.get("*") in ("read-all",)):
                bad.append("%s/%s: thiếu actions: read cho gh api jobs" % (os.path.basename(p), jn))
if n == 0: print("FAIL không còn step nào chạy check_runs.py"); sys.exit(1)
print("PASS (%d step)" % n if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
