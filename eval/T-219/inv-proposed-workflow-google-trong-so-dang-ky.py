#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT (T-219, vùng planner/vendor (ADR-142: không vào planner/vendor/images, vì việc area planner/vendor không chạy vùng con; số do Chief đặt khi Spec Gate qua)). Đo khe hở T-137: workflow Google mà sổ đăng ký không thấy.
Mọi workflow của repo tohong có bước nhận GOOGLE_MAPS_API_KEY hoặc GEMINI_API_KEY (trừ scrape-vendors.yml, không gọi API trả tiền) thì:
 (1) tên file của nó nằm trong vòng `for wf in …` của MỌI bước chạy check_runs.py ở mọi workflow;
 (2) mọi tiền tố nhánh (`branch:`) của bước mở PR trong workflow đó nằm trong DATA_PR_PREFIXES của tools/scraper/check_runs.py.
Tĩnh, offline. Repo: $TOHONG_REPO hoặc ../tohong cạnh tohong-hq (đi lên từ file này tới scripts/gate.py). Không thấy repo: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
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
KEYS = ("GOOGLE_MAPS_API_KEY", "GEMINI_API_KEY")
wfs = {os.path.basename(p): yaml.safe_load(open(p, encoding="utf-8")) or {} for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml")))}
paid = {n: w for n, w in wfs.items() if n != "scrape-vendors.yml" and any(k in str(s.get("env") or {}) + str(j.get("env") or {}) + str(w.get("env") or {})
                                                                          for j in (w.get("jobs") or {}).values() for s in (j.get("steps") or []) for k in KEYS)}
loops, bad = [], []
for n, w in wfs.items():
    for jn, j in (w.get("jobs") or {}).items():
        for s in j.get("steps") or []:
            if "check_runs.py" in str(s.get("run", "")):
                loops.append((n, jn, {x for m in re.finditer(r"for\s+wf\s+in\s+([^;\n]+);", str(s.get("run", ""))) for x in m.group(1).split()}))
cr = os.path.join(repo, "tools", "scraper", "check_runs.py")
m = re.search(r"DATA_PR_PREFIXES\s*=\s*\(([^)]*)\)", open(cr, encoding="utf-8").read()) if os.path.isfile(cr) else None
prefixes = re.findall(r"[\"']([^\"']+)[\"']", m.group(1)) if m else []
if not loops:
    bad.append("không còn bước nào chạy check_runs.py")
for n in paid:
    for wn, jn, names in loops:
        if n not in names:
            bad.append("%s nhận khoá Google/Gemini mà không có trong vòng for wf của %s/%s" % (n, wn, jn))
    for j in (wfs[n].get("jobs") or {}).values():
        for s in j.get("steps") or []:
            if str(s.get("uses", "")).startswith("peter-evans/create-pull-request"):
                br = str((s.get("with") or {}).get("branch", ""))
                pre = re.split(r"\$\{\{", br)[0]
                if pre and not any(pre.startswith(p) for p in prefixes):
                    bad.append("%s mở PR nhánh %r không thuộc DATA_PR_PREFIXES %r" % (n, br, prefixes))
print(("FAIL " + "; ".join(bad[:6])) if bad else "PASS (%d workflow trả tiền đều trong sổ đăng ký)" % len(paid)); sys.exit(1 if bad else 0)
