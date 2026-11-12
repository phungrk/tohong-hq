#!/usr/bin/env python3
"""T-135 tiêu chí 4 = T-133 (repo tohong): MỌI workflow mở/cập nhật PR dữ liệu đều sinh lại `enrich-report.json` từ dữ liệu cùng commit TRƯỚC khi commit/mở PR, và (trừ PR duyệt tay) kích hoạt pool ở tohong-back.
Sáu workflow: enrich-vendors, enrich-venue, refresh-vendor-photos, resolve-overrides, apply-review-rule, apply-admin-reviews.
Tĩnh (mỗi workflow):
  (a) có bước `run:` gọi build_enrich_report.py, đứng TRƯỚC bước peter-evans/create-pull-request (hoặc bước `git commit` của apply-review-rule); nếu bước mở PR có `if` chứa always() thì bước sinh báo cáo cũng phải
      chứa always() (PR mở kể cả khi enrich dừng vì trần: báo cáo vẫn phải sinh lại, không để báo cáo cũ đi cùng dữ liệu mới);
  (b) add-paths (hoặc mẫu `git add` của apply-review-rule) gồm tools/scraper/output/HCMC/enrich-report.json;
  (c) 4 workflow mở PR dữ liệu (enrich-vendors, enrich-venue, refresh-vendor-photos, resolve-overrides) có bước chạy `gh workflow run sync-vendor-pool.yml -R phungrk/tohong-back` với env GH_TOKEN lấy từ
      secrets.BACK_DISPATCH_TOKEN và chỉ chạy khi token có (thiếu token: bước xanh, không lỗi); apply-admin-reviews KHÔNG dispatch (PR duyệt tay đổi báo cáo nhưng pool của lô chỉ mở MỘT lần, sau PR dữ liệu cuối);
      apply-review-rule KHÔNG dùng secret nào (hợp đồng T-126: offline) nên không dispatch: nó chỉ in ::notice:: nêu sync-vendor-pool.yml cùng SHA mới và tên nhánh để bấm tay.
Động (mỗi workflow, nguyên văn bước sinh báo cáo trên bản sao git của repo thật, đúng thư mục/biến của bước): dữ liệu bị đổi (gỡ một vendor khỏi venue/vendors.json) -> sau bước, enrich-report.json
  khác bản cũ VÀ bằng đúng byte báo cáo sinh lại từ dữ liệu hiện có (INV-003). apply-review-rule chạy theo bố cục thật: code/ (main) và data/ (nhánh PR).
Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
NAMES = ["enrich-vendors.yml", "enrich-venue.yml", "refresh-vendor-photos.yml", "resolve-overrides.yml", "apply-review-rule.yml", "apply-admin-reviews.yml"]
bad = []
def has_always(s): return bool(re.search(r"\balways\s*\(", str(s or "")))
loaded = {}
for n in NAMES:
    raw, wf = t.load_wf(t.TOHONG, n)
    if wf is None:
        bad.append("%s: thiếu file" % n); continue
    loaded[n] = (raw, wf)
for n, (raw, wf) in loaded.items():
    job = next(iter(wf["jobs"].values())); steps = job["steps"]
    rep = [i for i, s in enumerate(steps) if "build_enrich_report.py" in str(s.get("run", ""))]
    if not rep:
        bad.append("%s: không có bước chạy build_enrich_report.py" % n); continue
    cpr = next((i for i, s in enumerate(steps) if str(s.get("uses", "")).startswith("peter-evans/create-pull-request")), None)
    commit = next((i for i, s in enumerate(steps) if re.search(r"\bgit\s+commit\b", str(s.get("run", "")))), None)
    stop = cpr if cpr is not None else commit
    if stop is None: bad.append("%s: không thấy bước mở PR hay git commit" % n); continue
    if rep[0] >= stop: bad.append("%s: bước sinh báo cáo (#%d) phải đứng TRƯỚC bước mở PR/commit (#%d)" % (n, rep[0], stop))
    if cpr is not None and has_always(steps[cpr].get("if")) and not has_always(steps[rep[0]].get("if")):
        bad.append("%s: bước mở PR chạy với always() nhưng bước sinh báo cáo không: enrich dừng vì trần sẽ để báo cáo cũ trong PR" % n)
    if cpr is not None:
        paths = str((steps[cpr].get("with") or {}).get("add-paths", ""))
        if "enrich-report.json" not in paths: bad.append("%s: add-paths không có enrich-report.json" % n)
    else:
        if "enrich-report.json" not in str(steps[commit - 1].get("run", "")) + str(steps[commit].get("run", "")): bad.append("%s: mẫu git add không có enrich-report.json" % n)
    disp = [s for s in steps if re.search(r"gh\s+workflow\s+run\s+%s" % re.escape(t.POOL_WF), str(s.get("run", "")))]
    if n == "apply-admin-reviews.yml":
        if disp: bad.append("%s: không được dispatch pool (lô chỉ mở MỘT PR pool, sau PR dữ liệu cuối)" % n)
    elif n == "apply-review-rule.yml":
        if disp or "BACK_DISPATCH_TOKEN" in raw or re.search(r"secrets\.(?!GITHUB_TOKEN)", raw): bad.append("%s: phải không dùng secret nào (T-126 offline); không dispatch" % n)
        if not any(t.POOL_WF in str(s.get("run", "")) and "::notice::" in str(s.get("run", "")) for s in steps): bad.append("%s: thiếu bước ::notice:: nhắc chạy tay %s với SHA mới" % (n, t.POOL_WF))
    elif not disp:
        bad.append("%s: thiếu bước gh workflow run %s -R %s" % (n, t.POOL_WF, t.BACK_REPO_NAME))
    else:
        s = disp[0]
        if "secrets.BACK_DISPATCH_TOKEN" not in str((s.get("env") or {}).get("GH_TOKEN", "")): bad.append("%s: bước dispatch phải đặt GH_TOKEN từ secrets.BACK_DISPATCH_TOKEN" % n)
        if t.BACK_REPO_NAME not in s["run"] or not re.search(r"(-R|--repo)[ =]%s" % re.escape(t.BACK_REPO_NAME), s["run"]): bad.append("%s: dispatch phải có -R %s cố định" % (n, t.BACK_REPO_NAME))
        if not re.search(r"-n\s+\"?\$\{?\w*TOKEN|-z\s+\"?\$\{?\w*TOKEN|\[\s*-[nz]", s["run"]): bad.append("%s: bước dispatch phải kiểm token có hay không (thiếu: báo rồi thoát 0)" % n)
if bad:
    t.done(bad, "")
# ---- động: nguyên văn bước sinh báo cáo
for n, (raw, wf) in loaded.items():
    box = t.Box(t.TOHONG)
    try:
        layout_rr = n == "apply-review-rule.yml"
        roots = [box.ws]
        if layout_rr:
            t._copytree(os.path.join(box.ws, "tools"), os.path.join(box.ws, "code", "tools"))
            data = os.path.join(box.ws, "data"); os.makedirs(data)
            t._copytree(os.path.join(box.ws, "tools"), os.path.join(data, "tools")); roots = [data]
        root = roots[0]
        cat, vid = next(t.pick_pool_vendor(root))
        before = open(os.path.join(root, t.REPORT_REL), "rb").read()
        # đổi dữ liệu (không đụng báo cáo) như PR dữ liệu vừa làm
        d = os.path.join(root, "tools", "scraper", "output", "HCMC", cat)
        import json
        doc = json.load(open(os.path.join(d, "vendors.json"), encoding="utf-8"))
        doc["vendors"] = [x for x in doc["vendors"] if x["id"] != vid]
        json.dump(doc, open(os.path.join(d, "vendors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        job = next(iter(wf["jobs"]))
        inputs = {"dry_run": "false", "pr_branch": "enrich-vendors/run-1", "categories": "all", "budget_usd": "30", "max_photos": "2"}
        c = t.gh_ctx(box, "workflow_dispatch", inputs=inputs, run_id="4242")
        res = t.run_job(box, wf, job, c, uses={"actions/": lambda w, s: {}}, only=lambda s: "build_enrich_report.py" in str(s.get("run", "")))
        if res["status"] != "success" or not any(o == "success" for _, o in res["order"]):
            bad.append("%s: bước sinh báo cáo không chạy được nguyên văn: %s" % (n, res["log"][-300:])); continue
        after = open(os.path.join(root, t.REPORT_REL), "rb").read()
        fresh = t.fresh_report(box, root)
        if after == before: bad.append("%s: sau bước sinh báo cáo, enrich-report.json không đổi dù dữ liệu đã đổi (ghi sai đường dẫn?)" % n)
        elif fresh is None or after != fresh: bad.append("%s: báo cáo sau bước KHÁC byte báo cáo sinh lại từ dữ liệu hiện có" % n)
    finally:
        box.cleanup()
t.done(bad, "6 workflow dữ liệu sinh lại enrich-report.json đúng byte trước khi mở PR/commit, 4 workflow mở PR dispatch pool bằng BACK_DISPATCH_TOKEN (thiếu token vẫn xanh), apply-admin-reviews không dispatch, apply-review-rule không secret và chỉ nhắc")
