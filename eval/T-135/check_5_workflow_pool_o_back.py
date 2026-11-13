#!/usr/bin/env python3
"""T-135 tiêu chí 5 (repo tohong-back): `.github/workflows/sync-vendor-pool.yml` sinh pool + file nhúng báo cáo từ ĐÚNG commit dữ liệu của tohong và mở MỘT PR, chạy NGUYÊN VĂN từng bước trên bản sao git của back
(tohong là repo private: checkout nó cần secret TOHONG_READ_TOKEN, chỉ đọc). Chỉ workflow_dispatch với hai input: tohong_ref (SHA 40 hex), tohong_branch.
Tình huống (tohong thử: một vendor còn trong pool đã bị gỡ sang removed_vendors.json, báo cáo sinh lại):
  (A) đầu vào hợp lệ -> job xanh; checkout tohong dùng ref = SHA nhập, token = secrets.TOHONG_READ_TOKEN, persist-credentials=false; chạy tools/regen-pool-styles.sh --back . --photos-for all (luôn --prune bên trong)
      và generate-vendor-enrich-report.js; PR: nhánh `vendor-pool/<tohong_branch với / thành ->`, file của PR = (dòng trong tools/pool-paths.txt) ∩ (file bước sinh ghi ra), gồm lib/vendorPool.generated.js + lib/vendorEnrichReport.generated.js (không viết cứng hai file; đủ cả khi T-138 đã/chưa merge, eval 9); vendor đã gỡ không còn trong pool;
      file nhúng chứa nguyên văn enrich-report.json của tohong; bản sinh lại bằng build_enrich_report.py bằng đúng byte báo cáo (bước kiểm 'báo cáo tươi'); `npm test` được chạy; thân PR có dòng
      `TOHONG_SOURCE_SHA=<sha>`, `TOHONG_SOURCE_BRANCH=<nhánh>`, và thứ tự merge (tohong TRƯỚC, back NGAY SAU, vì INV-021/022 đỏ giữa hai lần merge); không đổi file nào ngoài tohong/ (thư mục checkout) và hai file trên;
  (B) đầu vào xấu (sha 'main', sha chứa $(…), nhánh 'main', nhánh có `;`, thiếu input) -> job đỏ TRƯỚC khi checkout tohong, không PR, lệnh trong đầu vào không chạy (file canary không xuất hiện);
  (C) thiếu secret TOHONG_READ_TOKEN -> job đỏ sớm với thông báo nêu tên secret, không PR;
  (D) chạy lại cùng SHA sau khi PR (A) đã merge vào main của back -> không có thay đổi, không PR (operation none).
Tĩnh: on chỉ workflow_dispatch; permissions đúng {contents: write, pull-requests: write}; concurrency group riêng, không huỷ; không `git push`/--force; không GOOGLE_MAPS_API_KEY; không nội suy inputs/secrets vào run:.
Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos(back=True)
raw, wf = t.load_wf(t.BACK, t.POOL_WF)
if wf is None:
    print("FAIL tohong-back chưa có .github/workflows/%s" % t.POOL_WF); sys.exit(1)
bad = []
if set(t.on_of(wf)) != {"workflow_dispatch"}: bad.append("on phải chỉ có workflow_dispatch")
else:
    ins = (t.on_of(wf)["workflow_dispatch"] or {}).get("inputs") or {}
    if set(ins) != {"tohong_ref", "tohong_branch"} or not all((ins[k] or {}).get("required") in (True, "true") for k in ins): bad.append("inputs phải đúng {tohong_ref, tohong_branch}, cả hai required")
if wf.get("permissions") != {"contents": "write", "pull-requests": "write"}: bad.append("permissions %r, mong {contents: write, pull-requests: write}" % (wf.get("permissions"),))
cc = wf.get("concurrency") or {}
if not cc.get("group") or cc.get("cancel-in-progress") in (True, "true"): bad.append("thiếu concurrency.group hoặc cancel-in-progress bật")
if "GOOGLE_MAPS_API_KEY" in raw: bad.append("nhắc GOOGLE_MAPS_API_KEY")
jobs = wf.get("jobs") or {}
if len(jobs) != 1: bad.append("mong đúng một job")
if bad: t.done(bad, "")
job = next(iter(jobs.values())); steps = job["steps"]
for s in steps:
    r = str(s.get("run", ""))
    if re.search(r"\$\{\{\s*(secrets|github\.event\.inputs|inputs)\.", r): bad.append("nội suy secrets/inputs thẳng vào run:")
    if re.search(r"\bgit\s+push\b|--force", r): bad.append("git push/--force trong run:")
if bad: t.done(bad, "")
SHA = "a" * 40
BR = "resolve-overrides/run-4242"
CANARY = "/tmp/t135-canary-%d" % os.getpid()
troot, picked, ttmp = t.tohong_tree_with_removed(1)
bk = t.back_box()
try:
    cat, vid = picked[0]
    rec, co = [], []
    res, rec, co = t.run_back_sync(bk, wf, troot, SHA, BR, rec=rec, checkouts=co)
    if res["status"] != "success": bad.append("(A) job đỏ: %s" % res["log"][-500:])
    tc = [c for c in co if (c["repository"] or "").endswith("/tohong")]
    if len(tc) != 1 or tc[0]["ref"] != SHA or tc[0]["token"] != "READTOKEN-sentinel" or tc[0]["persist"] not in (False, "false"):
        bad.append("(A) checkout tohong phải đúng một lần với ref=tohong_ref, token=secrets.TOHONG_READ_TOKEN, persist-credentials=false; thấy %r" % tc)
    made = [r for r in rec if r["operation"] == "created"]
    if len(made) != 1: bad.append("(A) phải có đúng một PR, thấy %d" % len(made))
    else:
        pr = made[0]
        if pr["branch"] != "vendor-pool/resolve-overrides-run-4242": bad.append("(A) nhánh %r, mong vendor-pool/resolve-overrides-run-4242" % pr["branch"])
        listed = [l.strip() for l in open(os.path.join(bk.ws, "tools", "pool-paths.txt"), encoding="utf-8") if l.strip() and not l.startswith("#")] if os.path.isfile(os.path.join(bk.ws, "tools", "pool-paths.txt")) else []
        if not {"lib/vendorEnrichReport.generated.js", "lib/vendorPool.generated.js"} <= set(pr["files"]) or set(pr["files"]) - set(listed):
            bad.append("(A) PR phải gồm hai file lib/…generated.js và chỉ gồm file có trong tools/pool-paths.txt (danh sách ∩ file bước sinh ghi ra, không viết cứng); thấy %s, danh sách %s" % (pr["files"], listed))
        elif vid in t.pool_ids(pr["contents"]["lib/vendorPool.generated.js"]): bad.append("(A) vendor %s đã gỡ ở tohong vẫn còn trong pool (generator phải --prune)" % vid)
        if "lib/vendorEnrichReport.generated.js" in pr["contents"] and open(os.path.join(troot, t.REPORT_REL), encoding="utf-8").read().strip() not in pr["contents"]["lib/vendorEnrichReport.generated.js"]:
            bad.append("(A) file nhúng không chứa nguyên văn enrich-report.json của tohong")
        body = pr["body"]
        if "TOHONG_SOURCE_SHA=%s" % SHA not in body or "TOHONG_SOURCE_BRANCH=%s" % BR not in body: bad.append("(A) thân PR thiếu TOHONG_SOURCE_SHA=… / TOHONG_SOURCE_BRANCH=…")
        if not (re.search(r"TRƯỚC", body) and re.search(r"NGAY SAU", body) and "INV-021" in body): bad.append("(A) thân PR thiếu thứ tự merge (tohong TRƯỚC, back NGAY SAU) và lý do INV-021/022")
        out = [x for x in pr["other"] if not x.startswith("tohong/")]
        if out: bad.append("(A) thay đổi ngoài add-paths và tohong/: %s" % out[:3])
    if not os.path.isfile(os.path.join(bk.log, "npm.calls")) or not re.search(r"\btest\b", open(os.path.join(bk.log, "npm.calls")).read()): bad.append("(A) không chạy npm test")
    if not any("build_enrich_report.py" in a for _, a in bk.py_calls()): bad.append("(A) không chạy build_enrich_report.py (bước kiểm báo cáo tươi)")
    if "--photos-for all" not in res["log"] + "".join(s["log"] for s in res["steps"].values()) and not any("regen-pool-styles" in str(s.get("run", "")) and "--photos-for all" in s["run"] for s in steps):
        bad.append("(A) không chạy regen-pool-styles.sh với --photos-for all")
    # (D) merge PR (A) vào main của back rồi chạy lại cùng SHA
    if made:
        for f, txt in made[0]["contents"].items(): open(os.path.join(bk.ws, f), "w", encoding="utf-8").write(txt)
        t.git(bk.ws, "add", "-A", "--", "lib"); t.git(bk.ws, "commit", "-q", "-m", "PR pool đã merge")
        bk.reset()
        res4, rec4, _ = t.run_back_sync(bk, wf, troot, SHA, BR)
        if res4["status"] != "success" or any(r["operation"] == "created" for r in rec4): bad.append("(D) chạy lại cùng SHA phải xanh và không mở PR (không đổi gì): %s %s" % (res4["status"], [r["operation"] for r in rec4]))
    # (B) đầu vào xấu
    for label, inp in (("sha 'main'", {"tohong_ref": "main", "tohong_branch": BR}), ("sha có $()", {"tohong_ref": "$(touch %s)" % CANARY, "tohong_branch": BR}),
                       ("nhánh 'main'", {"tohong_ref": SHA, "tohong_branch": "main"}), ("nhánh có ;", {"tohong_ref": SHA, "tohong_branch": "resolve-overrides/x; touch %s" % CANARY}),
                       ("nhánh $()", {"tohong_ref": SHA, "tohong_branch": "resolve-overrides/$(touch %s)" % CANARY}), ("thiếu input", {})):
        bk.reset()
        r5, rec5, co5 = t.run_back_sync(bk, wf, troot, SHA, BR, inputs=inp)
        if r5["status"] != "failure": bad.append("(B) %s: job phải đỏ" % label)
        if any((c["repository"] or "").endswith("/tohong") for c in co5): bad.append("(B) %s: đã checkout tohong trước khi kiểm đầu vào" % label)
        if any(r["operation"] == "created" for r in rec5): bad.append("(B) %s: không được mở PR" % label)
        if os.path.exists(CANARY): bad.append("(B) %s: lệnh trong đầu vào đã chạy (canary xuất hiện)" % label); os.remove(CANARY)
    # (C) thiếu token
    bk.reset()
    r6, rec6, _ = t.run_back_sync(bk, wf, troot, SHA, BR, secrets={})
    if r6["status"] != "failure" or any(r["operation"] == "created" for r in rec6): bad.append("(C) thiếu TOHONG_READ_TOKEN: job phải đỏ, không PR")
    elif "TOHONG_READ_TOKEN" not in r6["log"]: bad.append("(C) thông báo lỗi phải nêu tên secret TOHONG_READ_TOKEN: %s" % r6["log"][-200:])
finally:
    bk.cleanup(); shutil.rmtree(ttmp, ignore_errors=True)
t.done(bad, "sync-vendor-pool.yml: sinh pool + file nhúng từ đúng SHA tohong, một PR (danh sách ∩ file sinh ra), thân PR ghi nguồn và thứ tự, đầu vào xấu và thiếu token đều đỏ trước khi ghi, chạy lại không đổi thì không PR")
