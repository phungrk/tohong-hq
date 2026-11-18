#!/usr/bin/env python3
"""T-208 tiêu chí 4: thêm actions: read không làm mất quyền ghi đang có. Hai vế:
 (A) Quy tắc chung: mọi job của mọi workflow tohong có step mở PR / đẩy nhánh (`uses: peter-evans/create-pull-request`, `gh pr create|edit|merge|close`, `git push`) có quyền hiệu lực contents: write VÀ pull-requests: write (permissions cấp job thay hẳn cấp workflow).
 (B) Ảnh chụp main trước T-208 (riêng việc này): quyền hiệu lực của từng job, bỏ scope `actions`, phải bằng đúng ảnh chụp; scope `actions` chỉ được vắng hoặc `read`, và chỉ được THÊM mới ở job gọi Actions API. Không job nào bị thêm/bớt/đổi tên (đổi tên job thì phải đổi eval này qua Capu).
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
API = re.compile(r"\bgh\s+run\b|\bgh\s+workflow\s+(?:list|view)\b|\bgh\s+api\b[^\n]*?/?actions/|check_runs\.py")
WRITER = re.compile(r"\bgh\s+pr\s+(?:create|edit|merge|close)\b|\bgit\s+push\b")
# Ảnh chụp quyền hiệu lực của main trước T-208 (không tính scope actions). None = không khai permissions.
SNAP = {
    ("apply-admin-reviews.yml", "apply"): {"contents": "write", "pull-requests": "write"},
    ("apply-review-rule.yml", "apply-review-rule"): {"contents": "write", "pull-requests": "write"},
    ("enrich-vendors.yml", "enrich-vendors"): {"contents": "write", "pull-requests": "write"},
    ("enrich-venue.yml", "enrich-venue"): {"contents": "write", "pull-requests": "write"},
    ("refresh-vendor-photos.yml", "refresh"): {"contents": "write", "pull-requests": "write"},
    ("resolve-overrides.yml", "resolve-overrides"): {"contents": "write", "pull-requests": "write"},
    ("scrape-vendors.yml", "scrape"): None,
}
def eff(wf, job):
    p = job["permissions"] if "permissions" in job else wf.get("permissions")
    if p is None: return None
    if isinstance(p, str): return {"*": p}
    return {str(k): str(v) for k, v in p.items()}
def steps(job): return job.get("steps") or []
def calls_api(job):
    return any(API.search(str(s.get("run", ""))) or str(s.get("uses", "")).startswith("actions/github-script") for s in steps(job))
def writes_repo(job):
    return any(WRITER.search(str(s.get("run", ""))) or str(s.get("uses", "")).startswith("peter-evans/create-pull-request") for s in steps(job))
def can_write(p, scope):
    return p is not None and (p.get("*") == "write-all" or p.get(scope) == "write")
bad, seen = [], set()
for path in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    name = os.path.basename(path)
    wf = yaml.safe_load(open(path, encoding="utf-8")) or {}
    for jn, j in (wf.get("jobs") or {}).items():
        e = eff(wf, j); seen.add((name, jn))
        if writes_repo(j):
            for sc in ("contents", "pull-requests"):
                if not can_write(e, sc): bad.append(f"{name}/{jn}: mở PR/đẩy nhánh nhưng mất {sc}: write (hiệu lực {e})")
        if (name, jn) not in SNAP:
            bad.append(f"{name}/{jn}: job không có trong ảnh chụp main"); continue
        if e is None:
            rest, act = None, None
        elif "*" in e:
            bad.append(f"{name}/{jn}: permissions dạng chuỗi {e['*']} đổi quyền hiệu lực so với main"); continue
        else:
            rest = {k: v for k, v in e.items() if k != "actions"}; act = e.get("actions")
        if rest != SNAP[(name, jn)]:
            bad.append(f"{name}/{jn}: quyền hiệu lực (trừ actions) {rest} khác main {SNAP[(name, jn)]}")
        if act not in (None, "read"): bad.append(f"{name}/{jn}: actions: {act} (chỉ được read)")
        if act == "read" and not calls_api(j) and not (name, jn) == ("enrich-vendors.yml", "enrich-vendors"):
            bad.append(f"{name}/{jn}: thêm actions: read ở job không gọi Actions API")
for k in SNAP:
    if k not in seen: bad.append(f"{k[0]}/{k[1]}: job có trong main nay biến mất")
print("PASS" if not bad else "FAIL " + "; ".join(bad)); sys.exit(1 if bad else 0)
