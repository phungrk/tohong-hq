#!/usr/bin/env python3
"""T-113 adv-04 (tầng 3): PR #76 đổi enrich-venue.yml sang ghi log theo quy ước sổ đăng ký `run-logs/T-106/<stamp>-run-<GITHUB_RUN_ID>-enrich.log`
(đường enrich.py cũ, KHÔNG ghi GOOGLE_REQUEST từng request, chỉ in GOOGLE_USAGE ở cuối). Lần chạy đó bị huỷ / hết giờ giữa chừng -> log có tên `-run-<id>-`
nhưng không có dòng GOOGLE_* nào: check_runs.py coi là "đã có log" (chỉ xét tên tệp), còn usage.read_usage bỏ qua im lặng vì chỉ báo hỏng ở T-110/T-111
-> chi của lần chạy đó (tới --budget 5.0 + 250 ảnh) đếm là 0 và chạy thật kế tiếp vẫn được phép.
Mong đợi (spec T-111 Hành vi 4: "Lần chạy bị huỷ/giết/hết giờ vẫn đếm đúng số đã gửi"; log hỏng làm chạy thật bị từ chối):
một log mang quy ước `-run-<id>-` mà không đếm được thì chạy thật `enrich.py --budget-usd` bị từ chối (USAGE_LOG_UNREADABLE, thoát khác 0) HOẶC check_runs.py không coi nó là log hợp lệ.
Chạy CLI thật trong bản sao tools/scraper (không output/, không khoá Google: nếu không bị từ chối, lệnh dừng ở bước sau mà không gửi request)."""
import json, os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

src = os.path.join(g.repo(), "tools", "scraper")
RID = "555000111"
with tempfile.TemporaryDirectory() as d:
    sc = os.path.join(d, "scraper")
    shutil.copytree(src, sc, ignore=shutil.ignore_patterns("output", "run-logs", "__pycache__", "*.pyc", ".venv", "node_modules"))
    rl = os.path.join(sc, "run-logs")
    os.makedirs(os.path.join(rl, "T-106"))
    os.makedirs(os.path.join(sc, "output", "HCMC"))
    json.dump({"month": "2026-11", "text_search": 0, "photos": 606, "source": "fixture"}, open(os.path.join(rl, "usage-baseline.json"), "w"))
    open(os.path.join(rl, "T-106", "20261109-010203-run-%s-enrich.log" % RID), "w").write(
        "Enriching venue (94 vendors)...\n  [12/94] Nhà hàng A ... enriched\n  [13/94] Nhà hàng B ...\nError: The operation was canceled.\n")
    json.dump([{"databaseId": int(RID), "displayTitle": "REAL Enrich venue (run %s)" % RID, "workflowName": "Enrich venue (Google Maps)",
                "status": "completed", "conclusion": "cancelled"}], open(os.path.join(d, "runs.json"), "w"))
    json.dump([], open(os.path.join(d, "prs.json"), "w"))
    env = {k: v for k, v in os.environ.items() if k != "GOOGLE_MAPS_API_KEY"}
    c = subprocess.run([sys.executable, "-I", "check_runs.py", "--runs", os.path.join(d, "runs.json"), "--prs", os.path.join(d, "prs.json"),
                        "--usage-root", "run-logs", "--baseline", "run-logs/usage-baseline.json", "--current", "1"], cwd=sc, capture_output=True, text=True, env=env)
    e = subprocess.run([sys.executable, "-I", "enrich.py", "--state", "HCMC", "--category", "venue", "--budget-usd", "30", "--usage-root", "run-logs",
                        "--month", "2026-11"], cwd=sc, capture_output=True, text=True, env=env, timeout=120)
    eo = e.stdout + e.stderr
    if c.returncode != 0:
        g.ok("PASS check_runs.py không nhận log -run-<id>- không đếm được (thoát %d)" % c.returncode)
    if "USAGE_LOG_UNREADABLE" in eo and e.returncode != 0:
        g.ok("PASS enrich.py từ chối chạy thật khi log -run-<id>- ở T-106 không đếm được")
    g.fail("log run-logs/T-106/…-run-%s-enrich.log của lần chạy REAL bị huỷ (không có dòng GOOGLE_*) được check_runs.py nhận (thoát %d) và enrich.py --budget-usd "
           "KHÔNG từ chối (thoát %d, không USAGE_LOG_UNREADABLE): chi của lần chạy đó đếm là 0" % (RID, c.returncode, e.returncode))
