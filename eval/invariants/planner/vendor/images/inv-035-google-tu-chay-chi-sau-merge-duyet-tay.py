#!/usr/bin/env python3
"""Nguồn: T-135 (spec products/T-135-resolve-tu-chay-pool-o-back.md v3, "Bất biến đề xuất"), qua Spec Gate 2026-11-13 (spec-critic); nguyên văn bản đề xuất của product.
Nằm ở eval/T-135/bat-bien-cho-merge/ cho tới khi PR code T-135 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/images/ và đặt số.
Bất biến đề xuất (planner/vendor/images) · nguồn: spec T-135, quyết định 2026-11-13 của Capu (gộp bước 2–4 sau PR duyệt tay), ADR-049 (tiền Google, trần $30).
INV-??? · Workflow của tohong có GOOGLE_MAPS_API_KEY mà tự chạy (không chỉ do người bấm) thì chỉ được tự chạy theo MỘT đường: `pull_request` loại `closed` vào `main`, và mọi job của nó có `if` chứa
  đủ bốn điều kiện: `merged`, `admin-reviews/capu` (đúng nhánh của PR duyệt tay), `head.repo.full_name` (cùng repo, không fork), `vars.AUTO_RESOLVE_OVERRIDES` (công tắc của Capu, mặc định tắt).
  Không `push`, `pull_request_target`, `workflow_run`, `repository_dispatch`, `issue_comment`, `schedule`.
  NỢ ĐÃ GHI (không phải phép vĩnh viễn): refresh-vendor-photos.yml có `schedule` hàng tháng từ Spec 005, chưa qua sổ đăng ký; việc xử lý: T-137 (xoá ngoại lệ này khi T-137 xong).
  Không workflow nào của tohong được kích workflow khác CÓ khoá Google (`gh workflow run <file>`, `gh api …/workflows/<file>/dispatches`, `-R` trỏ repo khác không tính): GITHUB_TOKEN kích được `workflow_dispatch`, nên nếu không cấm thì một workflow không có khoá
  vẫn gọi được `gh workflow run resolve-overrides.yml -f dry_run=false` và qua mặt cổng.
Lý do: Google tính tiền theo lần gọi; một kích hoạt tự động lỏng (mọi push vào main, PR của fork, PR dữ liệu cuối đổi lại manual_overrides.json) có thể thành vòng lặp tiêu tiền hoặc cho kẻ ngoài tiêu tiền.
Tĩnh, không mạng. Repo: TOHONG_REPO hoặc ../tohong. Không thấy .github/workflows: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. 0 = đạt."""
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
    print("PASS chưa áp dụng (không thấy .github/workflows của tohong)"); sys.exit(0)
bad = []
files = sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml")))
GWF = {os.path.basename(p) for p in files if "GOOGLE_MAPS_API_KEY" in open(p, encoding="utf-8").read()}
DISPATCH = re.compile(r"gh\s+workflow\s+run\s+['\"]?([\w.\-]+\.ya?ml)['\"]?([^\n]*)|actions/workflows/([\w.\-]+\.ya?ml)/dispatches")
for p in files:
    n0 = os.path.basename(p); wf0 = yaml.safe_load(open(p, encoding="utf-8")) or {}
    for jn0, j0 in (wf0.get("jobs") or {}).items():
        for s0 in j0.get("steps") or []:
            for m0 in DISPATCH.finditer(str(s0.get("run", ""))):
                tgt = m0.group(1) or m0.group(3); rest = m0.group(2) or ""
                if tgt in GWF and not re.search(r"(-R|--repo)[ =]\S+", rest):
                    bad.append("%s: kích workflow có khoá Google (%s) từ workflow khác: qua mặt cổng" % (n0, tgt))
for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    n = os.path.basename(p); raw = open(p, encoding="utf-8").read()
    if "GOOGLE_MAPS_API_KEY" not in raw or n == "scrape-vendors.yml":
        continue
    wf = yaml.safe_load(raw) or {}
    on = wf.get("on", wf.get(True)) or {}
    trig = set(on) if isinstance(on, dict) else ({on} if isinstance(on, str) else set(on))
    ok = {"workflow_dispatch", "pull_request"} | ({"schedule"} if n == "refresh-vendor-photos.yml" else set())
    if trig - ok:
        bad.append("%s: kích hoạt tự động ngoài phép: %s" % (n, sorted(trig - ok)))
    if "pull_request" in trig:
        pr = on["pull_request"] or {}
        if list(pr.get("types") or []) != ["closed"] or list(pr.get("branches") or []) != ["main"]:
            bad.append("%s: pull_request phải có types [closed] và branches [main]" % n)
        for jn, j in (wf.get("jobs") or {}).items():
            ifs = str(j.get("if", ""))
            for need in ("merged", "admin-reviews/capu", "head.repo.full_name", "vars.AUTO_RESOLVE_OVERRIDES"):
                if need not in ifs:
                    bad.append("%s job %s: `if` thiếu %s" % (n, jn, need))
if bad:
    print("FAIL " + bad[0] + (" (+%d)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS workflow Google tự chạy chỉ theo đường pull_request closed + bốn điều kiện (hoặc không tự chạy)"); sys.exit(0)
