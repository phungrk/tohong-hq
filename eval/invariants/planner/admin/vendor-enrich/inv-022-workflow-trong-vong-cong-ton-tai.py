#!/usr/bin/env python3
"""T-210 adv-04: mọi workflow trong vòng 'for wf in ...' của bước cổng tồn tại trong .github/workflows: 'gh run list --workflow X' với X không có
thì lỗi, set -eo pipefail làm cổng chết dù đã có actions: read. Tĩnh. 0 = đạt."""
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
names = {os.path.basename(p) for p in WFS}
bad, n = [], 0
for p in WFS:
    for jn, j in (load(p).get("jobs") or {}).items():
        for s in j.get("steps") or []:
            for m in re.finditer(r"for\s+wf\s+in\s+([^;\n]+);", str(s.get("run", ""))):
                for w in m.group(1).split():
                    n += 1
                    if w not in names: bad.append("%s/%s: %s không tồn tại" % (os.path.basename(p), jn, w))
if n == 0: print("FAIL không thấy vòng for wf in ... của cổng"); sys.exit(1)
print("PASS (%d tên)" % n if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
