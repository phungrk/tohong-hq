#!/usr/bin/env python3
"""T-208 tiêu chí 2: mọi job của mọi workflow trong tohong/.github/workflows có step run: gọi `gh run ...`, `gh api .../actions/...` hoặc check_runs.py thì quyền hiệu lực (job thay workflow) có actions: read. Có ít nhất một job như vậy (nếu không, eval vô nghĩa).
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
CALL = re.compile(r"\bgh\s+run\b|\bgh\s+workflow\s+(?:list|view)\b|\bgh\s+api\b[^\n]*?/?actions/|check_runs\.py")
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
    for s in (job.get("steps") or []):
        if CALL.search(str(s.get("run", ""))) or str(s.get("uses", "")).startswith("actions/github-script"): return True
    return False
bad, n = [], 0
for name, wf in load():
    for jn, j in (wf.get("jobs") or {}).items():
        if calls_actions_api(j):
            n += 1
            if not has_actions_read(perms(wf, j)):
                bad.append(f"{name}/{jn}")
if n == 0:
    print("FAIL không workflow nào gọi Actions API: không kiểm được (cổng sổ đăng ký bị bỏ?)"); sys.exit(1)
print("PASS" if not bad else "FAIL thiếu actions: read ở " + ", ".join(bad)); sys.exit(1 if bad else 0)
