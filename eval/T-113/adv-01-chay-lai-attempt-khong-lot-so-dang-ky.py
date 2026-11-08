#!/usr/bin/env python3
"""T-113 adv-01 (tầng 3): "Re-run" một lần chạy THẬT của enrich-vendors.yml giữ nguyên GITHUB_RUN_ID (chỉ tăng run_attempt).
check_runs.py bỏ qua `--current <GITHUB_RUN_ID>`, nên lần thử trước của CHÍNH lần chạy này (đã gọi Google, log không lên main vì
bước mở PR hỏng / Capu đóng PR không merge / job đỏ rồi Capu bấm Re-run) không bị đòi log -> attempt 2 đọc sổ từ main thiếu toàn bộ
chi của attempt 1 và tiêu lại tới trần. (Lần chạy 42385145662 của refresh-vendor-photos.yml đã được chạy lại 4 attempt, mỗi attempt 202 request.)

Mong đợi (spec T-111 Hành vi 4: "mọi lần chạy thật trước đó phải có log trên main"; lần thử trước cũng là một lần chạy thật đã trả tiền):
khi GITHUB_RUN_ATTEMPT > 1 và lần chạy hiện tại chưa có log `-run-<id>-` trên main (cũng không nằm trong runs_accounted), KHÔNG được gọi Google.
PASS nếu (a) check_runs.py (đúng lệnh trong workflow, env GITHUB_RUN_ATTEMPT=2) thoát khác 0, hoặc
       (b) workflow có một bước TRƯỚC bước đầu tiên mang GOOGLE_MAPS_API_KEY tham chiếu run_attempt / GITHUB_RUN_ATTEMPT và có thể dừng (exit khác 0)."""
import json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

scraper = os.path.join(g.repo(), "tools", "scraper")
cr = os.path.join(scraper, "check_runs.py")
if not os.path.isfile(cr):
    g.fail("thiếu tools/scraper/check_runs.py")

RID = "90000000001"
with tempfile.TemporaryDirectory() as d:
    os.makedirs(os.path.join(d, "run-logs", "T-111"))
    # log của một lần chạy cũ khác (đầy đủ), KHÔNG có log của RID
    open(os.path.join(d, "run-logs", "T-111", "20261109-010101-run-90000000000-enrich.log"), "w").write(
        "GOOGLE_REQUEST run=rX kind=search\nGOOGLE_USAGE run=rX text_search=1 photo_details=0 photo_media=0\n")
    json.dump({"month": "2026-11", "text_search": 0, "photos": 606, "source": "fixture"}, open(os.path.join(d, "run-logs", "usage-baseline.json"), "w"))
    runs = [
        {"databaseId": int(RID), "displayTitle": "REAL Enrich vendors (run %s)" % RID, "workflowName": "Enrich vendors (Google Maps, mọi category)",
         "status": "in_progress", "conclusion": ""},
        {"databaseId": 90000000000, "displayTitle": "REAL Enrich vendors (run 90000000000)", "workflowName": "Enrich vendors (Google Maps, mọi category)",
         "status": "completed", "conclusion": "success"},
    ]
    json.dump(runs, open(os.path.join(d, "runs.json"), "w"))
    json.dump([], open(os.path.join(d, "prs.json"), "w"))
    env = dict(os.environ, GITHUB_RUN_ID=RID, GITHUB_RUN_ATTEMPT="2")
    p = subprocess.run([sys.executable, "-I", cr, "--runs", os.path.join(d, "runs.json"), "--prs", os.path.join(d, "prs.json"),
                        "--usage-root", os.path.join(d, "run-logs"), "--baseline", os.path.join(d, "run-logs", "usage-baseline.json"), "--current", RID],
                       capture_output=True, text=True, env=env, cwd=d)
    if p.returncode != 0:
        g.ok("PASS check_runs.py chặn attempt 2 khi attempt trước chưa có log (thoát %d)" % p.returncode)
    cr_out = (p.stdout + p.stderr).strip().splitlines()[-1:] 

wf = g.load("enrich-vendors.yml")
steps = next(iter(wf["jobs"].values()))["steps"]
first_google = next((i for i, s in enumerate(steps) if "GOOGLE_MAPS_API_KEY" in json.dumps(s.get("env") or {})), None)
if first_google is None:
    g.fail("enrich-vendors.yml không có bước nào mang GOOGLE_MAPS_API_KEY")
for s in steps[:first_google]:
    blob = json.dumps(s, ensure_ascii=False)
    if ("run_attempt" in blob or "GITHUB_RUN_ATTEMPT" in blob) and "exit" in (s.get("run") or ""):
        g.ok("PASS workflow có bước chặn theo run_attempt trước Google: " + str(s.get("name")))
g.fail("Re-run (GITHUB_RUN_ATTEMPT=2) của lần chạy REAL %s chưa có log trên main vẫn qua sổ đăng ký: check_runs.py thoát 0 (%s) và workflow không có bước "
       "nào kiểm run_attempt trước bước gọi Google -> attempt 2 tiêu lại tới trần mà không thấy chi của attempt 1" % (RID, " ".join(cr_out)))
