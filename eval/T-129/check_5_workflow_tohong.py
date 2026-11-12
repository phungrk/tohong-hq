#!/usr/bin/env python3
"""T-129 tiêu chí 5 (repo tohong): workflow `.github/workflows/apply-admin-reviews.yml` đưa review của Capu vào PR dữ liệu bậc C, an toàn và offline với Google.
Đo bằng đọc YAML (không chạy mạng): 
  (a) có file; kích hoạt chỉ `workflow_dispatch` và/hoặc `schedule` (không push, pull_request, pull_request_target, issue_comment, workflow_run); có `concurrency.group` và cancel-in-progress không bật;
  (b) permissions chỉ {contents: write, pull-requests: write} (không quyền nào khác, không `write-all`);
  (c) bí mật dùng được chỉ `ENRICH_EXPORT_TOKEN` và `GITHUB_TOKEN`; KHÔNG nhắc GOOGLE_MAPS_API_KEY; không bước nào chạy resolve_overrides.py, enrich.py, refresh_photos.py, main.py (Google chỉ qua workflow trả phí có sẵn do Capu bấm);
  (d) không nội suy `${{ secrets.* }}` hay `${{ github.event.inputs.* }}` vào `run:` (chỉ qua env:/with:); lệnh gọi export dùng curl với --fail, `Authorization: Bearer` lấy từ biến môi trường, địa chỉ từ `vars.ENRICH_BACK_URL` + `/api/internal/vendor-enrich/export`;
  (e) có bước chạy `apply_admin_reviews.py` với `--reviews` và `--approved-on`, KHÔNG có `--decision`; có bước chạy test offline `test_t110_manual_overrides.py` trước bước mở PR;
  (f) PR mở bằng peter-evans/create-pull-request, `add-paths` chỉ là tools/scraper/output/HCMC/manual_overrides.json, nhánh cố định không phải main/master, không `git push`, không `git add -A|--all|.`, không `--force`;
  (g) chạy NGUYÊN VĂN INV-030 và INV-031 trong bể trên repo tohong: xanh.
Repo: TOHONG_REPO hoặc ../tohong. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import glob, os, re, subprocess, sys
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML"); sys.exit(1)
HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
repo = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isdir(os.path.join(c, "tools", "scraper"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
fp = os.path.join(repo, ".github", "workflows", "apply-admin-reviews.yml")
if not os.path.isfile(fp):
    print("FAIL thiếu .github/workflows/apply-admin-reviews.yml"); sys.exit(1)
raw = open(fp, encoding="utf-8").read()
wf = yaml.safe_load(raw) or {}
on = wf.get("on", wf.get(True)) or {}
bad = []
trig = set(on) if isinstance(on, dict) else set([on] if isinstance(on, str) else on)
if not trig or trig - {"workflow_dispatch", "schedule"}: bad.append("kích hoạt %s (chỉ workflow_dispatch và/hoặc schedule)" % sorted(trig))
cc = wf.get("concurrency")
if not (isinstance(cc, dict) and cc.get("group")) or cc.get("cancel-in-progress") in (True, "true"): bad.append("thiếu concurrency.group hoặc cancel-in-progress bật")
perm = wf.get("permissions")
if perm != {"contents": "write", "pull-requests": "write"}: bad.append("permissions %r, mong đúng {contents: write, pull-requests: write}" % (perm,))
if "GOOGLE_MAPS_API_KEY" in raw: bad.append("nhắc GOOGLE_MAPS_API_KEY")
secrets = set(re.findall(r"secrets\.([A-Za-z0-9_]+)", raw))
if secrets - {"ENRICH_EXPORT_TOKEN", "GITHUB_TOKEN"}: bad.append("bí mật lạ: %s" % sorted(secrets - {"ENRICH_EXPORT_TOKEN", "GITHUB_TOKEN"}))
steps = [s for j in (wf.get("jobs") or {}).values() for s in (j.get("steps") or [])]
runs = [s.get("run", "") for s in steps if s.get("run")]
alltext = "\n".join(runs)
for w in ("resolve_overrides.py", "enrich.py", "refresh_photos.py", "main.py"):
    if re.search(r"(?<![\w-])" + re.escape(w), alltext): bad.append("bước chạy %s (có thể gọi Google)" % w)
if re.search(r"\$\{\{\s*(secrets|github\.event\.inputs|inputs)\.", alltext): bad.append("nội suy secrets/inputs thẳng vào run:")
curl = next((r for r in runs if "curl" in r), "")
if not curl or not re.search(r"(--fail\b|-[a-zA-Z]*f[a-zA-Z]*\s)", curl) or "Authorization: Bearer" not in curl or "$" not in curl.split("Bearer", 1)[-1][:40]:
    bad.append("không thấy bước curl --fail với Authorization: Bearer lấy từ biến môi trường")
if "ENRICH_BACK_URL" not in raw or "/api/internal/vendor-enrich/export" not in raw: bad.append("không dùng vars.ENRICH_BACK_URL + /api/internal/vendor-enrich/export")
app = [r for r in runs if "apply_admin_reviews.py" in r]
if not app or not all("--reviews" in r and "--approved-on" in r and "--decision" not in r for r in app): bad.append("bước apply thiếu --reviews/--approved-on hoặc còn --decision")
idx = lambda pred: next((i for i, s in enumerate(steps) if pred(s)), None)
i_test = idx(lambda s: "test_t110_manual_overrides.py" in s.get("run", "")); i_pr = idx(lambda s: str(s.get("uses", "")).startswith("peter-evans/create-pull-request"))
if i_test is None: bad.append("thiếu bước test_t110_manual_overrides.py")
if i_pr is None: bad.append("thiếu bước peter-evans/create-pull-request")
elif i_test is not None and i_test > i_pr: bad.append("test_t110 phải chạy trước bước mở PR")
if i_pr is not None:
    w = steps[i_pr].get("with") or {}
    paths = [x.strip() for x in str(w.get("add-paths", "")).split("\n") if x.strip()]
    if paths != ["tools/scraper/output/HCMC/manual_overrides.json"]: bad.append("add-paths %r (chỉ manual_overrides.json)" % paths)
    br = str(w.get("branch", ""))
    if not br or br in ("main", "master") or "${{" in br and "inputs" in br: bad.append("branch %r không hợp lệ" % br)
for r in runs:
    for ln in r.splitlines():
        if re.search(r"\bgit\s+push\b", ln) or re.search(r"\bgit\s+add\s+(-A|--all|\.)(\s|$)", ln) or "--force" in ln: bad.append("dòng cấm: %s" % ln.strip()[:80])
for n in ("inv-030-workflow-day-nhanh-an-toan.py", "inv-031-gh-biet-repo-o-moi-buoc.py"):
    p = subprocess.run([sys.executable, "-I", os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images", n)], env=dict(os.environ, TOHONG_REPO=repo), capture_output=True, text=True, timeout=120)
    if p.returncode != 0: bad.append("%s đỏ: %s" % (n[:7].upper(), p.stdout.strip()[:120]))
print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS"); sys.exit(1 if bad else 0)
