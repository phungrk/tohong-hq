#!/usr/bin/env python3
"""T-208 tiêu chí 3: không mở quyền ghi mới. Ở mọi workflow và mọi job, scope được ghi (write) chỉ nằm trong {contents, pull-requests}; không có write-all, không có actions/id-token/packages/issues/... : write. Đây là tập quyền ghi của main trước T-208 (apply-admin-reviews, apply-review-rule, enrich-*, refresh-vendor-photos, resolve-overrides); thêm quyền ghi khác thì phải đổi eval này qua Capu (bậc C).
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
ALLOWED = {"contents", "pull-requests"}
bad = []
def scan(where, p):
    if p is None: return
    if isinstance(p, str):
        if p == "write-all": bad.append(f"{where}: write-all")
        return
    for k, v in p.items():
        if str(v) == "write" and str(k) not in ALLOWED: bad.append(f"{where}: {k}: write")
for name, wf in load():
    scan(name, wf.get("permissions"))
    for jn, j in (wf.get("jobs") or {}).items():
        scan(f"{name}/{jn}", j.get("permissions"))
print("PASS" if not bad else "FAIL quyền ghi ngoài {contents, pull-requests}: " + "; ".join(bad)); sys.exit(1 if bad else 0)
