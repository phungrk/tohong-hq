#!/usr/bin/env python3
"""T-135 tiêu chí 7 (hai repo): quyền ghi chéo repo tối thiểu, không đặt secret thay Capu, và các bất biến workflow cũ VẪN XANH nguyên văn.
Token chéo repo (Capu tự đặt; spec chỉ đặt TÊN): `BACK_DISPATCH_TOKEN` (secret ở tohong; PAT fine-grained chỉ trên tohong-back, quyền Actions: write để chạy workflow, KHÔNG có Contents:write) và
`TOHONG_READ_TOKEN` (secret ở tohong-back; PAT chỉ-đọc trên tohong: Contents: read). Không token nào ghi được code của repo kia.
Tĩnh (tohong): mọi workflow chỉ dùng secrets ⊆ {GOOGLE_MAPS_API_KEY, ENRICH_EXPORT_TOKEN, BACK_DISPATCH_TOKEN, GITHUB_TOKEN}; BACK_DISPATCH_TOKEN chỉ xuất hiện ở `env:` của một bước có `gh workflow run` (không trong
  `with:` của action khác, không in ra bằng echo/set -x); workflow có GOOGLE_MAPS_API_KEY chỉ được kích hoạt bởi workflow_dispatch hoặc pull_request{closed} (schedule chỉ còn refresh-vendor-photos.yml như hiện có) + job `if` của pull_request có merged, admin-reviews/capu, head.repo.full_name, vars.AUTO_RESOLVE_OVERRIDES.
Tĩnh (back): sync-vendor-pool.yml dùng secrets ⊆ {TOHONG_READ_TOKEN, GITHUB_TOKEN}; TOHONG_READ_TOKEN chỉ ở `with.token` của checkout tohong và `env` của bước kiểm token; mọi `uses` ⊆ {actions/checkout, actions/setup-node,
  actions/setup-python, peter-evans/create-pull-request}; không ghi thẳng main; deploy.yml còn chỉ kích hoạt khi push main (merge PR pool vẫn deploy như cũ) và không nhắc sync-vendor-pool.
Bất biến chạy nguyên văn (python3 -I) trên repo thật: INV-023, INV-024, INV-030, INV-031 (planner/vendor/images), inv-006 (planner), inv-004 (planner/admin/vendor-enrich) — thoát 0. (INV-003 KHÔNG ở đây: nó đỏ trên main hôm nay vì tohong#90 merge sau #89 làm báo cáo cũ lại; nó xanh khi PR dữ liệu đầu tiên theo T-133 được merge, đo ở check_3/check_4.)
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import glob, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos(back=True)
bad = []
ALLOWED = {"GOOGLE_MAPS_API_KEY", "ENRICH_EXPORT_TOKEN", "BACK_DISPATCH_TOKEN", "GITHUB_TOKEN"}
wfdir = os.path.join(t.TOHONG, ".github", "workflows")
for p in sorted(glob.glob(os.path.join(wfdir, "*.y*ml"))):
    n = os.path.basename(p); raw = open(p, encoding="utf-8").read()
    if n == "scrape-vendors.yml": continue   # có sẵn từ trước, ngoài phạm vi T-135 (nhiều secret riêng của scraper)
    wf = t.yaml.safe_load(raw) or {}
    extra = set(re.findall(r"secrets\.([A-Za-z0-9_]+)", raw)) - ALLOWED
    if extra: bad.append("%s: secret lạ %s" % (n, sorted(extra)))
    on = t.on_of(wf)
    if "GOOGLE_MAPS_API_KEY" in raw:
        # refresh-vendor-photos.yml có `schedule` hàng tháng từ trước (Spec 005, trong hạn mức miễn phí): không thuộc T-135, ghi ở handoff để Chief of Staff xét.
        if set(on) - {"workflow_dispatch", "pull_request", "schedule"} or ("schedule" in on and n != "refresh-vendor-photos.yml"): bad.append("%s: workflow có khoá Google chỉ được workflow_dispatch/pull_request (schedule chỉ còn ở refresh-vendor-photos.yml), thấy %s" % (n, sorted(on)))
        if "pull_request" in on:
            ifs = " ".join(str(j.get("if", "")) for j in (wf.get("jobs") or {}).values())
            for need in ("merged", "admin-reviews/capu", "head.repo.full_name", "vars.AUTO_RESOLVE_OVERRIDES"):
                if need not in ifs: bad.append("%s: job `if` thiếu %s" % (n, need))
    for jn, j in (wf.get("jobs") or {}).items():
        for s in j.get("steps") or []:
            sraw = str(s)
            if "BACK_DISPATCH_TOKEN" in sraw:
                if "gh workflow run" not in str(s.get("run", "")) or "BACK_DISPATCH_TOKEN" in str(s.get("with", "")) or re.search(r"echo[^\n]*\$\{?GH_TOKEN|set\s+-x|set\s+-\w*x", str(s.get("run", ""))):
                    bad.append("%s: BACK_DISPATCH_TOKEN chỉ được ở env của bước `gh workflow run`, không with:, không in ra" % n)
braw, bwf = t.load_wf(t.BACK, t.POOL_WF)
if bwf is None:
    bad.append("tohong-back chưa có %s" % t.POOL_WF)
else:
    if set(re.findall(r"secrets\.([A-Za-z0-9_]+)", braw)) - {"TOHONG_READ_TOKEN", "GITHUB_TOKEN"}: bad.append("sync-vendor-pool.yml: secret lạ")
    for s in next(iter(bwf["jobs"].values()))["steps"]:
        u = str(s.get("uses", ""))
        if u and not re.match(r"(actions/checkout|actions/setup-node|actions/setup-python|peter-evans/create-pull-request)@", u): bad.append("sync-vendor-pool.yml: uses ngoài danh sách: %s" % u)
        if "TOHONG_READ_TOKEN" in str(s) and not (str((s.get("with") or {}).get("token", "")).find("TOHONG_READ_TOKEN") >= 0 or "TOHONG_READ_TOKEN" in str((s.get("env") or {}))):
            bad.append("sync-vendor-pool.yml: TOHONG_READ_TOKEN dùng sai chỗ (chỉ with.token của checkout tohong và env bước kiểm)")
        if str((s.get("with") or {}).get("base", "main")) not in ("main", "master"): bad.append("sync-vendor-pool.yml: base PR phải là main")
draw, dwf = t.load_wf(t.BACK, "deploy.yml")
if dwf is None or set(t.on_of(dwf)) != {"push"} or "sync-vendor-pool" in draw: bad.append("deploy.yml phải còn chỉ kích hoạt khi push (main) và không nhắc sync-vendor-pool")
env = dict(os.environ, TOHONG_REPO=t.TOHONG, TOHONG_BACK_REPO=t.BACK)
IMG = t.INV_IMAGES
PL = os.path.join(t.HQ, "eval", "invariants", "planner")
for f in (glob.glob(os.path.join(IMG, "inv-023-*.py")) + glob.glob(os.path.join(IMG, "inv-024-*.py")) + glob.glob(os.path.join(IMG, "inv-030-*.py")) + glob.glob(os.path.join(IMG, "inv-031-*.py"))
          + glob.glob(os.path.join(PL, "inv-006-*.py")) + glob.glob(os.path.join(PL, "admin", "vendor-enrich", "inv-004-*.py"))):
    rc, msg = t.inv(f, env)
    if rc != 0: bad.append("%s đỏ: %s" % (os.path.basename(f)[:7].upper(), msg))
t.done(bad, "quyền chéo repo tối thiểu (hai tên secret, không ghi được code), workflow Google chỉ kích hoạt có cổng, INV-023/024/030/031, inv-006, inv-004 nguyên văn xanh")
