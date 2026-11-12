#!/usr/bin/env python3
"""Bất biến đề xuất (planner/vendor/images) · nguồn: spec T-135, quyết định 2026-11-13 của Capu (gộp bước 2–4 sau PR duyệt tay), ADR-049 (tiền Google, trần $30).
INV-??? · Workflow của tohong có GOOGLE_MAPS_API_KEY mà tự chạy (không chỉ do người bấm) thì chỉ được tự chạy theo MỘT đường: `pull_request` loại `closed` vào `main`, và mọi job của nó có `if` chứa
  đủ bốn điều kiện: `merged`, `admin-reviews/capu` (đúng nhánh của PR duyệt tay), `head.repo.full_name` (cùng repo, không fork), `vars.AUTO_RESOLVE_OVERRIDES` (công tắc của Capu, mặc định tắt).
  Không `push`, `pull_request_target`, `workflow_run`, `repository_dispatch`, `issue_comment`, `schedule` (ngoại lệ có từ trước: refresh-vendor-photos.yml, ngày 1 hàng tháng, Spec 005).
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
