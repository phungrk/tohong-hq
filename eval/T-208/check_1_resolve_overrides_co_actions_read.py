#!/usr/bin/env python3
"""T-208 tiêu chí 1: resolve-overrides.yml: mọi job chạy cổng sổ đăng ký (gh run list / check_runs.py) có quyền hiệu lực actions: read.
Tĩnh, không mạng. Repo: TOHONG_REPO hoặc ../tohong (dò ngược tới scripts/gate.py, ADR-070). Chạy: python3 -I <file>. 0 = đạt."""
import glob, os, re, sys
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
CALL = re.compile(r"\bgh\s+run\b|\bgh\s+api\b[^\n]*?/?actions/|check_runs\.py")
def load():
    for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
        yield os.path.basename(p), (yaml.safe_load(open(p, encoding="utf-8")) or {})
def perms(wf, job):
    """Quyền hiệu lực của job: permissions cấp job thay hẳn cấp workflow; không khai = None."""
    p = job["permissions"] if "permissions" in job else wf.get("permissions")
    if p is None: return None
    if isinstance(p, str): return {"*": p}
    return {str(k): str(v) for k, v in p.items()}
def has_actions_read(p):
    if p is None: return False
    if "*" in p: return p["*"] in ("read-all", "write-all")
    return p.get("actions") in ("read", "write")
def calls_actions_api(job):
    return any(CALL.search(str(s.get("run", ""))) for s in (job.get("steps") or []))
p = os.path.join(repo, ".github", "workflows", "resolve-overrides.yml")
if not os.path.isfile(p):
    print("FAIL không thấy resolve-overrides.yml"); sys.exit(1)
wf = yaml.safe_load(open(p, encoding="utf-8")) or {}
bad, n = [], 0
for jn, j in (wf.get("jobs") or {}).items():
    if calls_actions_api(j):
        n += 1
        if not has_actions_read(perms(wf, j)):
            bad.append(f"job {jn}: quyền hiệu lực {perms(wf, j)} thiếu actions: read")
if n == 0:
    print("FAIL resolve-overrides.yml không còn job nào chạy cổng sổ đăng ký (gh run / check_runs.py): spec không cho bỏ cổng"); sys.exit(1)
print("PASS" if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
