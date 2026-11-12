#!/usr/bin/env python3
"""T-135 tiêu chí 9 (tohong-back; ràng buộc từ Spec Gate T-136): PR pool commit MỌI file mà bước sinh pool ghi ra (kể cả file vendors cho matcher của T-136), và danh sách đường dẫn đó có ĐÚNG MỘT nguồn:
`tools/pool-paths.txt` ở tohong-back (mỗi dòng một đường dẫn tương đối, bỏ dòng trống và dòng bắt đầu #). add-paths của bước mở PR lấy từ file này (qua output của một bước đọc nó), không viết cứng trong workflow.
Mặc định file gồm đúng lib/vendorPool.generated.js và lib/vendorEnrichReport.generated.js. Đo bằng cách giả lập T-136 mà KHÔNG sửa workflow: thêm một dòng `matcher-extra/vendors.json` vào tools/pool-paths.txt và cho
regen-pool-styles.sh (bản sao thử) ghi thêm file đó:
  (A) PR gồm đúng các đường dẫn trong file danh sách (3 file), kể cả file mới; không file nào khác ngoài tohong/;
  (B) file được sinh ra nhưng KHÔNG có trong danh sách -> job đỏ, nêu đường dẫn, không PR (không để file pool lọt khỏi PR, INV-021/022 đỏ lâu);
  (C) mặc định (không thêm gì) PR vẫn đúng hai file lib.
Workflow không được viết cứng `lib/vendorPool.generated.js` trong add-paths (nguồn thứ hai). Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos(back=True)
raw, wf = t.load_wf(t.BACK, t.POOL_WF)
if wf is None:
    print("FAIL tohong-back chưa có .github/workflows/%s" % t.POOL_WF); sys.exit(1)
bad = []
LST = os.path.join("tools", "pool-paths.txt")
if not os.path.isfile(os.path.join(t.BACK, LST)): bad.append("thiếu %s (nguồn duy nhất của danh sách đường dẫn PR pool)" % LST)
cpr = next((s for s in next(iter(wf["jobs"].values()))["steps"] if str(s.get("uses", "")).startswith("peter-evans/create-pull-request")), {})
ap = str((cpr.get("with") or {}).get("add-paths", ""))
if "generated.js" in ap: bad.append("add-paths viết cứng đường dẫn pool (phải lấy từ %s qua output của một bước)" % LST)
if "steps." not in ap: bad.append("add-paths phải là output của bước đọc %s" % LST)
if bad: t.done(bad, "")
troot, picked, ttmp = t.tohong_tree_with_removed(1)
bk = t.back_box()
try:
    EX = "matcher-extra/vendors.json"
    BASE0 = t.git(bk.ws, "rev-parse", "HEAD").stdout.strip()
    def simulate_t136(write_extra=True, list_extra=True):
        bk.reset(); t.git(bk.ws, "reset", "-q", "--hard", BASE0); t.git(bk.ws, "branch", "-f", "main", BASE0)
        lst = os.path.join(bk.ws, LST); base = open(lst, encoding="utf-8").read()
        if list_extra: open(lst, "a", encoding="utf-8").write(("" if base.endswith("\n") else "\n") + EX + "\n")
        t.git(bk.ws, "add", "-A"); t.git(bk.ws, "commit", "-q", "-m", "danh sách")
        sh = os.path.join(troot, "tools", "regen-pool-styles.sh"); txt = open(sh, encoding="utf-8").read()
        txt = re.sub(r"\n# T136-SIM.*", "", txt, flags=re.S)
        if write_extra: txt += "\n# T136-SIM\nmkdir -p \"$BACK/matcher-extra\" && echo '{\"vendors\": []}' > \"$BACK/matcher-extra/vendors.json\"\n"
        open(sh, "w", encoding="utf-8").write(txt)
        return t.run_back_sync(bk, wf, troot, "d" * 40, "resolve-overrides/run-1")
    res, rec, _ = simulate_t136()
    made = [r for r in rec if r["operation"] == "created"]
    want = sorted([l.strip() for l in open(os.path.join(bk.ws, LST), encoding="utf-8") if l.strip() and not l.startswith("#")])
    if res["status"] != "success" or len(made) != 1: bad.append("(A) giả lập T-136: job không cho đúng một PR: %s" % res["log"][-300:])
    else:
        if sorted(made[0]["files"]) != want or EX not in made[0]["files"]: bad.append("(A) PR phải gồm đúng các đường dẫn trong %s (%s); thấy %s" % (LST, want, sorted(made[0]["files"])))
        if [x for x in made[0]["other"] if not x.startswith("tohong/")]: bad.append("(A) file ngoài danh sách bị đổi: %s" % made[0]["other"][:3])
    res, rec, _ = simulate_t136(write_extra=True, list_extra=False)
    if res["status"] != "failure" or any(r["operation"] == "created" for r in rec): bad.append("(B) file sinh ra mà không có trong danh sách: job phải đỏ, không PR")
    elif EX not in res["log"]: bad.append("(B) thông báo lỗi phải nêu đường dẫn %s" % EX)
    shutil.copy(os.path.join(t.TOHONG, "tools", "regen-pool-styles.sh"), os.path.join(troot, "tools", "regen-pool-styles.sh"))
    bk.reset()
    res, rec, _ = t.run_back_sync(bk, wf, troot, "d" * 40, "resolve-overrides/run-1")
    made = [r for r in rec if r["operation"] == "created"]
    if res["status"] != "success" or len(made) != 1 or sorted(made[0]["files"]) != ["lib/vendorEnrichReport.generated.js", "lib/vendorPool.generated.js"]: bad.append("(C) mặc định phải đúng hai file lib: %s" % (sorted(made[0]["files"]) if made else res["log"][-200:]))
finally:
    bk.cleanup(); shutil.rmtree(ttmp, ignore_errors=True)
t.done(bad, "danh sách đường dẫn PR pool lấy từ một nguồn (tools/pool-paths.txt): thêm file (kiểu T-136) chỉ cần thêm một dòng, file sinh ra ngoài danh sách làm job đỏ")
