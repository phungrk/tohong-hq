#!/usr/bin/env python3
"""T-135 tiêu chí 9 (tohong-back; ràng buộc từ Spec Gate T-136): PR pool commit MỌI file mà bước sinh pool ghi ra (kể cả file vendors cho matcher của T-136), và danh sách đường dẫn đó có ĐÚNG MỘT nguồn:
`tools/pool-paths.txt` ở tohong-back (mỗi dòng một đường dẫn tương đối, bỏ dòng trống và dòng bắt đầu #). add-paths của bước mở PR lấy từ file này (qua output của một bước đọc nó), không viết cứng trong workflow.
File phải có sẵn ba dòng: lib/vendorPool.generated.js, lib/vendorEnrichReport.generated.js, matcher-data/vendors.json (T-138/T-136: T-135 tự đưa dòng matcher vào, không ai khác thêm). Dòng không tồn tại sau bước sinh bị bỏ qua (output của bước đọc chỉ gồm file tồn tại; không lỗi). Đo bằng cách giả lập T-136 mà KHÔNG sửa workflow: thêm một dòng `matcher-extra/vendors.json` vào tools/pool-paths.txt và cho
regen-pool-styles.sh (bản sao thử) ghi thêm file đó:
  (A) PR gồm đúng các đường dẫn trong file danh sách (3 file), kể cả file mới; không file nào khác ngoài tohong/;
  (B) file được sinh ra nhưng KHÔNG có trong danh sách -> job đỏ, nêu đường dẫn, không PR (không để file pool lọt khỏi PR, INV-021/022 đỏ lâu);
  (C) cả hai thứ tự merge với T-138, không sửa danh sách và workflow: tohong CHƯA có bộ sinh matcher -> PR = hai file lib, job xanh; tohong ĐÃ có bộ sinh (ghi matcher-data/vendors.json) -> PR = ba file gồm matcher-data/vendors.json.
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
if os.path.isfile(os.path.join(t.BACK, LST)):
    _l = [l.strip() for l in open(os.path.join(t.BACK, LST), encoding="utf-8") if l.strip() and not l.startswith("#")]
    for need in ("lib/vendorPool.generated.js", "lib/vendorEnrichReport.generated.js", "matcher-data/vendors.json"):
        if need not in _l: bad.append("%s thiếu dòng %s" % (LST, need))
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
    want = sorted(l.strip() for l in open(os.path.join(bk.ws, LST), encoding="utf-8") if l.strip() and not l.startswith("#"))
    if res["status"] != "success" or len(made) != 1: bad.append("(A) giả lập T-136: job không cho đúng một PR: %s" % res["log"][-300:])
    else:
        fl = set(made[0]["files"])
        if not ({"lib/vendorPool.generated.js", "lib/vendorEnrichReport.generated.js", EX} <= fl <= set(want)): bad.append("(A) PR phải gồm hai file lib và file mới %s, và chỉ file có trong %s; thấy %s, danh sách %s" % (EX, LST, sorted(fl), want))
        if [x for x in made[0]["other"] if not x.startswith("tohong/")]: bad.append("(A) file ngoài danh sách bị đổi: %s" % made[0]["other"][:3])
    res, rec, _ = simulate_t136(write_extra=True, list_extra=False)
    if res["status"] != "failure" or any(r["operation"] == "created" for r in rec): bad.append("(B) file sinh ra mà không có trong danh sách: job phải đỏ, không PR")
    elif EX not in res["log"]: bad.append("(B) thông báo lỗi phải nêu đường dẫn %s" % EX)
    shutil.copy(os.path.join(t.TOHONG, "tools", "regen-pool-styles.sh"), os.path.join(troot, "tools", "regen-pool-styles.sh"))   # bỏ bộ sinh giả lập của (A)/(B)
    LIBS = ["lib/vendorEnrichReport.generated.js", "lib/vendorPool.generated.js"]
    for label, on, want in (("T-138 chưa merge", False, LIBS), ("T-138 đã merge", True, sorted(LIBS + ["matcher-data/vendors.json"]))):
        bk.reset(); t.git(bk.ws, "reset", "-q", "--hard", BASE0); t.git(bk.ws, "branch", "-f", "main", BASE0)
        t.add_matcher_generator(troot, on)
        res, rec, _ = t.run_back_sync(bk, wf, troot, "d" * 40, "resolve-overrides/run-1")
        made = [r for r in rec if r["operation"] == "created"]
        if res["status"] != "success" or len(made) != 1: bad.append("(C) %s: job phải xanh và cho đúng một PR: %s" % (label, res["log"][-300:])); continue
        if sorted(made[0]["files"]) != want: bad.append("(C) %s: PR phải gồm %s; thấy %s" % (label, want, sorted(made[0]["files"])))
        outs = next((v["outputs"].get("list") for v in res["steps"].values() if "list" in v["outputs"]), None)
        if outs is None or [x for x in outs.split() if not os.path.exists(os.path.join(made[0]["tree"], x))]: bad.append("(C) %s: output danh sách chỉ được gồm file tồn tại (add-paths với đường dẫn không có sẽ làm git add lỗi)" % label)
finally:
    bk.cleanup(); shutil.rmtree(ttmp, ignore_errors=True)
t.done(bad, "danh sách file PR pool một nguồn (tools/pool-paths.txt, đã có dòng matcher-data/vendors.json): đúng cả khi T-138 merge trước hay sau, thêm file mới chỉ cần thêm một dòng, file sinh ra ngoài danh sách làm job đỏ")
