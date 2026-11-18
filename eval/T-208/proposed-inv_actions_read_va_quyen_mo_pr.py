#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT (vùng planner/admin/vendor-enrich), từ T-208. Mọi job của mọi workflow tohong:
 (1) có step gọi Actions API (`gh run`, `gh workflow list|view`, `gh api .../actions/...`, check_runs.py, `uses: actions/github-script`) thì có actions: read hiệu lực;
 (2) có step mở PR / đẩy nhánh (`uses: peter-evans/create-pull-request`, `gh pr create|edit|merge|close`, `git push`) thì giữ contents: write và pull-requests: write hiệu lực.
(permissions cấp job thay hẳn cấp workflow.) Không có ảnh chụp riêng việc nào. In PASS/FAIL; PASS 'chưa áp dụng' khi không có repo."""
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
API = re.compile(r"\bgh\s+run\b|\bgh\s+workflow\s+(?:list|view)\b|\bgh\s+api\b[^\n]*?/?actions/|check_runs\.py")
WRITER = re.compile(r"\bgh\s+pr\s+(?:create|edit|merge|close)\b|\bgit\s+push\b")
def eff(wf, job):
    p = job["permissions"] if "permissions" in job else wf.get("permissions")
    if p is None: return None
    if isinstance(p, str): return {"*": p}
    return {str(k): str(v) for k, v in p.items()}
bad = []
for path in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    name = os.path.basename(path)
    wf = yaml.safe_load(open(path, encoding="utf-8")) or {}
    for jn, j in (wf.get("jobs") or {}).items():
        st = j.get("steps") or []; e = eff(wf, j)
        api = any(API.search(str(s.get("run", ""))) or str(s.get("uses", "")).startswith("actions/github-script") for s in st)
        wr = any(WRITER.search(str(s.get("run", ""))) or str(s.get("uses", "")).startswith("peter-evans/create-pull-request") for s in st)
        if api and not (e is not None and (e.get("*") in ("read-all", "write-all") or e.get("actions") in ("read", "write"))):
            bad.append(f"{name}/{jn}: gọi Actions API thiếu actions: read")
        if wr:
            for sc in ("contents", "pull-requests"):
                if not (e is not None and (e.get("*") == "write-all" or e.get(sc) == "write")):
                    bad.append(f"{name}/{jn}: mở PR/đẩy nhánh thiếu {sc}: write")
print("PASS" if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
