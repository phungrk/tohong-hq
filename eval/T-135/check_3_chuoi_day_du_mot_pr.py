#!/usr/bin/env python3
"""T-135 tiêu chí 3 (repo tohong): một lần chạy tự động (merge PR duyệt tay) chạy NGUYÊN VĂN toàn bộ job resolve-overrides trên bản sao git của repo thật với một lô mới của Capu
(2 mục `remove` mới ở hai category khác nhau, đã nằm trên main như sau khi PR duyệt tay được merge) và cho ĐÚNG MỘT PR dữ liệu bậc C:
  - nhánh `resolve-overrides/run-<run_id>` (tiền tố của sổ đăng ký check_runs và của cổng apply-review-rule), một commit;
  - chứa: removed_vendors.json/vendors.json của CẢ HAI category (quyết định áp ở mọi category, INV-021), log `run-logs/T-110/*-run-<run_id>-*.log`, và `enrich-report.json`
    BẰNG ĐÚNG BYTE báo cáo sinh lại từ dữ liệu của chính commit đó (INV-003; T-133); không file nào ngoài add-paths bị đổi;
  - script Google chạy với trần: enrich.py --budget <= 1.0, refresh_photos.py --max-requests <= 6, không `enrich.py --all`, không `main.py`, không `--budget-usd`; build_enrich_report.py được gọi;
  - thân PR: ghi PR duyệt tay nguồn (#12), tên nhánh pool sẽ mở ở tohong-back (`vendor-pool/resolve-overrides-run-<run_id>`), thứ tự merge (tohong TRƯỚC, back NGAY SAU), không còn câu 'Én, Tự Do, Pergola' cứng của lô ADR-048;
  - sau PR: đúng MỘT lệnh `gh workflow run sync-vendor-pool.yml -R phungrk/tohong-back -f tohong_ref=<head sha của PR> -f tohong_branch=<nhánh>` dùng token BACK_DISPATCH_TOKEN (không phải GITHUB_TOKEN);
  - không có secret BACK_DISPATCH_TOKEN: job vẫn xanh, KHÔNG gọi gh workflow run, thân PR chỉ cách bấm tay workflow ở back (đặt tên secret, không đặt hộ Capu);
  - không rò rỉ: khoá Google/token không xuất hiện trong file của PR, thân PR hay log; dispatch tay dry_run=true: 0 script Google, 0 PR.
Không mạng, không Google (kết nối bị chặn; lô thử không có mục cần resolve nên mọi script chạy offline). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None:
    print("FAIL thiếu .github/workflows/resolve-overrides.yml"); sys.exit(1)
if "pull_request" not in t.on_of(wf):
    print("FAIL resolve-overrides.yml chưa có kích hoạt pull_request (tiêu chí 1)"); sys.exit(1)
JOB = next(iter(wf["jobs"]))
KEY, BTOK, RID = "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE12", "BACKTOKEN-sentinel-0123456789", "4242"
box = t.Box(t.TOHONG)
bad = []
try:
    ids = t.mutate_fixture_overrides(box, 2)
    if len(ids) < 2 or len({c for c, _ in ids}) < 2:
        print("FAIL không dựng được lô thử hai category"); sys.exit(1)
    def run(secrets, event="pull_request", inputs=None, ev_=None):
        box.reset(); box.gh_db({"prs": [], "runs": {}})
        rec = []
        c = t.gh_ctx(box, event, event=ev_ if ev_ is not None else t.pr_event(), inputs=inputs, run_id=RID, vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets=secrets)
        res = t.run_job(box, wf, JOB, c, uses={"actions/": lambda w, s: {}, "peter-evans/create-pull-request": t.make_cpr(box, rec)})
        return res, rec
    res, rec = run({"GOOGLE_MAPS_API_KEY": KEY, "BACK_DISPATCH_TOKEN": BTOK})
    py_all = [a for _, a in box.py_calls()]
    red = [(n, o) for n, o in res["order"] if o == "failure"]
    if res["status"] != "success" and not red:
        bad.append("job không xanh: %s" % res["log"][-400:])
    if res["status"] != "success":
        bad.append("job đỏ ở bước %s: %s" % ([n for n, o in red], res["log"][-500:]))
    made = [r for r in rec if r["operation"] == "created"]
    if len(made) != 1:
        bad.append("phải có ĐÚNG MỘT PR dữ liệu, thấy %d" % len(made))
    else:
        pr = made[0]
        if not re.fullmatch(r"resolve-overrides/run-%s" % RID, pr["branch"]): bad.append("nhánh PR %r, mong resolve-overrides/run-%s" % (pr["branch"], RID))
        if t.REPORT_REL not in pr["files"]: bad.append("PR không chứa enrich-report.json (T-133)")
        else:
            fr = t.fresh_report(box, pr["tree"])
            if fr is None or fr != open(os.path.join(pr["tree"], t.REPORT_REL), "rb").read():
                bad.append("enrich-report.json trong PR KHÁC byte báo cáo sinh lại từ dữ liệu cùng commit (INV-003)")
        for cat, vid in ids:
            rp = "tools/scraper/output/HCMC/%s/removed_vendors.json" % cat
            vp = "tools/scraper/output/HCMC/%s/vendors.json" % cat
            if rp not in pr["files"] or vp not in pr["files"]:
                bad.append("PR thiếu %s hoặc %s: quyết định remove ở category %s chưa được áp" % (rp, vp, cat)); continue
            if vid in pr["contents"][vp]: bad.append("vendor %s vẫn còn trong %s sau khi Capu remove" % (vid, vp))
            if vid not in pr["contents"][rp]: bad.append("vendor %s không có trong %s (khôi phục được)" % (vid, rp))
        if not any(re.fullmatch(r"tools/scraper/run-logs/T-110/.*-run-%s-.*\.log" % RID, f) for f in pr["files"]): bad.append("PR không có log run-logs/T-110/*-run-%s-*.log (sổ đăng ký)" % RID)
        if pr["other"]: bad.append("thay đổi ngoài add-paths: %s" % pr["other"][:3])
        blob = pr["body"] + pr["title"] + "".join(pr["contents"].values())
        if KEY in blob or BTOK in blob: bad.append("khoá/token lọt vào file hoặc thân PR")
        body = pr["body"]
        if "#12" not in body: bad.append("thân PR không ghi PR duyệt tay nguồn (#12)")
        if "vendor-pool/resolve-overrides-run-%s" % RID not in body: bad.append("thân PR không ghi nhánh pool sẽ mở ở back: vendor-pool/resolve-overrides-run-%s" % RID)
        if not (re.search(r"TRƯỚC", body) and re.search(r"NGAY SAU", body)): bad.append("thân PR không ghi thứ tự merge (tohong TRƯỚC, back NGAY SAU)")
        if "Én, Tự Do" in pr["title"] + body: bad.append("tiêu đề/thân PR còn câu cứng của lô ADR-048 (Én, Tự Do, Pergola)")
        wr = [c for c in box.gh_calls() if c["argv"][:2] == ["workflow", "run"]]
        want = ["workflow", "run", t.POOL_WF, "-R", t.BACK_REPO_NAME]
        if len(wr) != 1: bad.append("phải có ĐÚNG MỘT lệnh gh workflow run, thấy %d" % len(wr))
        else:
            a = wr[0]["argv"]; flat = " ".join(a)
            if a[:5] != want: bad.append("lệnh dispatch %r, mong bắt đầu %r" % (flat[:90], " ".join(want)))
            if ("tohong_ref=%s" % pr["sha"]) not in flat or ("tohong_branch=%s" % pr["branch"]) not in flat: bad.append("dispatch thiếu -f tohong_ref=<sha PR> hoặc -f tohong_branch=<nhánh PR>: %s" % flat[:160])
            if wr[0]["token"] != BTOK: bad.append("dispatch phải dùng secret BACK_DISPATCH_TOKEN, không phải GITHUB_TOKEN (token thấy: %r)" % wr[0]["token"][:12])
    for a in py_all:
        if "enrich.py" in a:
            m = re.search(r"--budget\s+(\S+)", a)
            if "--all" in a.split() or "--budget-usd" in a: bad.append("enrich.py chạy với --all/--budget-usd (đó là việc của enrich-vendors.yml): %s" % a[:80])
            elif not m or float(m.group(1)) > 1.0: bad.append("enrich.py thiếu --budget hoặc > 1.0 (lô duyệt tay chỉ thử lại vài vendor tạm đóng cửa): %s" % a[:80])
        if "refresh_photos.py" in a:
            m = re.search(r"--max-requests\s+(\d+)", a)
            if not m or int(m.group(1)) > 6: bad.append("refresh_photos.py thiếu --max-requests hoặc > 6: %s" % a[:80])
        if re.search(r"(^|\s)main\.py", a): bad.append("chạy main.py (scrape): %s" % a[:60])
    if not any("build_enrich_report.py" in a for a in py_all): bad.append("không bước nào chạy build_enrich_report.py")
    # không có BACK_DISPATCH_TOKEN
    res2, rec2 = run({"GOOGLE_MAPS_API_KEY": KEY})
    if res2["status"] != "success": bad.append("thiếu BACK_DISPATCH_TOKEN làm job đỏ (phải xanh, chỉ báo): %s" % res2["log"][-300:])
    if any(c["argv"][:2] == ["workflow", "run"] for c in box.gh_calls()): bad.append("không có token mà vẫn gọi gh workflow run")
    mm = [r for r in rec2 if r["operation"] == "created"]
    if mm and (t.POOL_WF not in mm[0]["body"] or "Run workflow" not in mm[0]["body"]): bad.append("không có token: thân PR phải chỉ cách chạy tay sync-vendor-pool.yml ('Run workflow')")
    # dispatch tay dry-run
    res3, rec3 = run({"GOOGLE_MAPS_API_KEY": KEY, "BACK_DISPATCH_TOKEN": BTOK}, event="workflow_dispatch", inputs={"dry_run": "true"}, ev_={})
    gc = [a for _, a in box.py_calls() if re.search(r"(resolve_overrides|enrich|refresh_photos)\.py", a) and "--dry-run" not in a and "--probe" not in a]
    if gc: bad.append("dispatch dry_run=true vẫn gọi script Google: %s" % gc[:2])
    if any(r["operation"] == "created" for r in rec3): bad.append("dispatch dry_run=true không được mở PR")
finally:
    box.cleanup()
t.done(bad, "một lần chạy tự động cho đúng một PR dữ liệu (2 category áp, enrich-report đúng byte, log -run-id-, trong trần), dispatch pool đúng một lần bằng BACK_DISPATCH_TOKEN, thiếu token vẫn xanh, dry-run không Google")
