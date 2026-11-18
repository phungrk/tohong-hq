#!/usr/bin/env python3
"""T-210 adv-05: mọi job có step 'gh pr ...' hoặc peter-evans/create-pull-request có pull-requests (read/write) hiệu lực, và job đẩy
nhánh/mở PR có contents: write. Bước cổng gọi 'gh pr list' ngay sau 'gh run list': thiếu quyền này 403 thay chỗ 403 cũ. Tĩnh. 0 = đạt."""
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
        steps = j.get("steps") or []
        ghpr = any(re.search(r"\bgh\s+pr\b", str(s.get("run", ""))) for s in steps)
        cpr = any(str(s.get("uses", "")).startswith("peter-evans/create-pull-request") for s in steps)
        if not (ghpr or cpr): continue
        n += 1
        pr = perms(wf, j)
        if pr is None: continue  # không khai: theo Settings của repo, ngoài phạm vi eval tĩnh
        if "*" in pr:
            if pr["*"] == "read-all" and cpr: bad.append("%s/%s: read-all không mở được PR" % (os.path.basename(p), jn))
            continue
        if pr.get("pull-requests") not in ("read", "write") or (cpr and pr.get("pull-requests") != "write"):
            bad.append("%s/%s: pull-requests=%s" % (os.path.basename(p), jn, pr.get("pull-requests")))
        if cpr and pr.get("contents") != "write":
            bad.append("%s/%s: contents=%s" % (os.path.basename(p), jn, pr.get("contents")))
print("PASS (%d job)" % n if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
