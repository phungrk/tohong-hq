#!/usr/bin/env python3
"""T-219 tiêu chí 5 (offline): sổ đăng ký check_runs thấy workflow P0 (khe hở T-137).
 (a) mọi bước chạy check_runs.py ở mọi workflow tohong có discover-vendors-p0.yml trong vòng `for wf in …` (và có ít nhất một bước như vậy);
 (b) check_runs.py chặn PR mở có nhánh discover-p0/…: OPEN_DATA_PR;
 (c) log do CLI sinh ra khi chạy thật (run 777) làm lần REAL đó qua cổng của lần chạy sau (CHECK_RUNS_OK); bỏ log đi thì MISSING_RUN_LOG 777."""
import glob, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
try:
    import yaml
except ImportError:
    k.fail("thiếu PyYAML")
bad = []
repo = k.tohong()
n = 0
for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    wf = yaml.safe_load(open(p, encoding="utf-8")) or {}
    for jn, j in (wf.get("jobs") or {}).items():
        for s in j.get("steps") or []:
            run = str(s.get("run") or "")
            if "check_runs.py" not in run:
                continue
            n += 1
            names = [w for m in re.finditer(r"for\s+wf\s+in\s+([^;\n]+);", run) for w in m.group(1).split()]
            if "discover-vendors-p0.yml" not in names:
                bad.append("%s/%s: vòng for wf thiếu discover-vendors-p0.yml (chi của P0 vô hình với sổ)" % (os.path.basename(p), jn))
if n == 0:
    bad.append("không thấy bước nào chạy check_runs.py")
need = os.path.isfile(os.path.join(repo, "tools", "scraper", "discover_p0.py"))
if not need:
    bad.append("thiếu tools/scraper/discover_p0.py (CLI)")
else:
    r, rc, out, calls, meta = k.full_run(run_id="777")
    sc = r.path

    def gate(runs, prs, cur="800"):
        json.dump(runs, open(os.path.join(r.base, "runs.json"), "w"))
        json.dump(prs, open(os.path.join(r.base, "prs.json"), "w"))
        env = {kk: v for kk, v in os.environ.items() if kk not in ("GITHUB_RUN_ATTEMPT", "GITHUB_REPOSITORY")}
        p = subprocess.run([sys.executable, "-I", "check_runs.py", "--runs", os.path.join(r.base, "runs.json"), "--prs", os.path.join(r.base, "prs.json"), "--usage-root", "run-logs",
                            "--baseline", "run-logs/usage-baseline.json", "--current", cur], cwd=sc, capture_output=True, text=True, env=env)
        return p.returncode, p.stdout + p.stderr
    real = {"databaseId": 777, "displayTitle": "REAL Discover vendors P0 (run 777)", "workflowName": "Discover vendors P0 (xe hoa, chỉ đo)", "status": "completed", "conclusion": "success"}
    rc2, o2 = gate([], [{"number": 5, "headRefName": "discover-p0/run-9"}])
    if rc2 != 1 or "OPEN_DATA_PR 5 discover-p0/run-9" not in o2:
        bad.append("PR mở nhánh discover-p0/ phải bị chặn (OPEN_DATA_PR), rc=%d: %s" % (rc2, o2.strip()[-120:]))
    rc2, o2 = gate([real], [])
    if rc2 != 0 or "CHECK_RUNS_OK" not in o2:
        bad.append("log do CLI sinh ra không làm lần REAL 777 qua cổng, rc=%d: %s" % (rc2, o2.strip()[-160:]))
    for f in r.log_files():
        os.remove(f)
    rc2, o2 = gate([real], [])
    if rc2 != 1 or "MISSING_RUN_LOG 777" not in o2:
        bad.append("thiếu log thì phải MISSING_RUN_LOG 777, rc=%d: %s" % (rc2, o2.strip()[-120:]))
k.done(bad, "mọi bước cổng liệt kê workflow P0, discover-p0/ chặn như PR dữ liệu, log của CLI làm lần REAL qua cổng")
