#!/usr/bin/env python3
"""T-210 adv-01: không workflow nào có khoá trùng trong khối permissions (vd 'actions: write' rồi 'actions: read'):
PyYAML lấy khoá sau nên eval tầng 1 thấy 'read', còn GitHub từ chối/hiểu khác. Tĩnh, không mạng. 0 = đạt."""
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
class Strict(yaml.SafeLoader): pass
def ctor(loader, node, deep=False):
    keys = [loader.construct_object(k, deep=deep) for k, _ in node.value]
    dup = {k for k in keys if keys.count(k) > 1}
    if dup: raise ValueError("khoá trùng %s ở dòng %d" % (sorted(map(str, dup)), node.start_mark.line + 1))
    return yaml.SafeLoader.construct_mapping(loader, node, deep)
Strict.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, ctor)
bad = []
for p in WFS:
    try: yaml.load(open(p, encoding="utf-8"), Loader=Strict)
    except ValueError as e: bad.append("%s: %s" % (os.path.basename(p), e))
print("PASS" if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
