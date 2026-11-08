#!/usr/bin/env python3
"""T-113 adv-07 (tầng 3, mở rộng adv-01 cho MỌI workflow Google và attempt >= 3).
Re-run giữ GITHUB_RUN_ID và run_number. Sổ đăng ký chỉ khớp log theo `-run-<GITHUB_RUN_ID>-`, nên MỘT log của run đó (của bất kỳ attempt nào) làm cả run "đã có log".
Hai đường lọt:
  (1) refresh-vendor-photos / enrich-venue / resolve-overrides không kiểm gì khi Re-run; nhánh PR (`…/run-<run_number|run_id>`) giống nhau giữa các attempt, và
      peter-evans/create-pull-request dựng lại nhánh từ base với workspace của attempt mới (checkout sạch) -> log của attempt trước bị thay khỏi PR. Merge PR thì main có log
      attempt sau, check_runs thoả, chi của attempt trước mất khỏi sổ (run 42385145662 đã chạy 4 attempt x 202 request).
  (2) enrich-vendors: attempt 1 có log trên main, attempt 2 tiêu rồi PR hỏng/đóng, attempt 3 vẫn qua vì log attempt 1 mang cùng `-run-<id>-`.
Mong đợi, với MỖI workflow có GOOGLE_MAPS_API_KEY, một trong hai:
  (a) chạy thật bị chặn khi run_attempt > 1 trừ khi log của attempt TRƯỚC đó đã trên main: có bước trước bước Google đầu tiên tham chiếu run_attempt/GITHUB_RUN_ATTEMPT
      và có thể exit; với enrich-vendors đo hành vi: check_runs.py (GITHUB_RUN_ATTEMPT=3, main chỉ có log của attempt 1) phải thoát khác 0;
  (b) mỗi attempt có log và nhánh PR riêng: mọi đường tee log trong run-logs và `branch:` của bước mở PR đều chứa run_attempt."""
import json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

ATT = re.compile(r"run_attempt|GITHUB_RUN_ATTEMPT")
wfdir = os.path.join(g.repo(), ".github", "workflows")
bad, n = [], 0
for name in sorted(os.listdir(wfdir)):
    if not name.endswith((".yml", ".yaml")) or "GOOGLE_MAPS_API_KEY" not in open(os.path.join(wfdir, name), encoding="utf-8").read():
        continue
    if name == "scrape-vendors.yml":
        continue  # không log, không PR log: mọi lần REAL đã bị check_runs đòi baseline của Capu
    n += 1
    wf = g.load(name)
    steps = [s for j in wf["jobs"].values() for s in j.get("steps", [])]
    first = next(i for i, s in enumerate(steps) if "GOOGLE_MAPS_API_KEY" in json.dumps(s.get("env") or {}))
    guard = [s for s in steps[:first] if ATT.search(json.dumps(s, ensure_ascii=False)) and "exit" in (s.get("run") or "")]
    if name == "enrich-vendors.yml" or any("check_runs.py" in (s.get("run") or "") for s in steps[:first]):
        # đo hành vi check_runs với attempt 3, main chỉ có log attempt 1
        cr = os.path.join(g.repo(), "tools", "scraper", "check_runs.py")
        RID = "91000000001"
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, "run-logs", "T-111"))
            open(os.path.join(d, "run-logs", "T-111", "20261109-010101-run-%s-enrich.log" % RID), "w").write(
                "GOOGLE_REQUEST run=r20261109T010101-%sa1-enrich-deadbeef kind=search\n"
                "GOOGLE_USAGE run=r20261109T010101-%sa1-enrich-deadbeef text_search=1 photo_details=0 photo_media=0\n" % (RID, RID))
            json.dump({"month": "2026-11", "text_search": 0, "photos": 0, "source": "fixture"}, open(os.path.join(d, "run-logs", "usage-baseline.json"), "w"))
            json.dump([{"databaseId": int(RID), "displayTitle": "REAL x (run %s)" % RID, "workflowName": "x", "status": "in_progress", "conclusion": ""}],
                      open(os.path.join(d, "runs.json"), "w"))
            json.dump([], open(os.path.join(d, "prs.json"), "w"))
            p = subprocess.run([sys.executable, "-I", cr, "--runs", os.path.join(d, "runs.json"), "--prs", os.path.join(d, "prs.json"), "--usage-root",
                                os.path.join(d, "run-logs"), "--baseline", os.path.join(d, "run-logs", "usage-baseline.json"), "--current", RID],
                               capture_output=True, text=True, cwd=d, env=dict(os.environ, GITHUB_RUN_ID=RID, GITHUB_RUN_ATTEMPT="3"))
        if p.returncode != 0 or guard:
            continue
        bad.append(f"{name}: attempt 3 qua check_runs (thoát 0) khi main chỉ có log của attempt 1 -> chi của attempt 2 không vào sổ")
        continue
    if guard:
        continue
    tees = [m for s in steps for m in re.findall(r"tee \"(run-logs/[^\"]+)\"", s.get("run") or "")]
    branches = [str((s.get("with") or {}).get("branch")) for s in steps if "create-pull-request" in str(s.get("uses"))]
    if tees and branches and all(ATT.search(x) for x in tees + branches):
        continue
    bad.append(f"{name}: Re-run không bị chặn và log/nhánh PR không riêng từng attempt (log {tees}, nhánh {branches}) -> attempt sau thay log attempt trước trong PR")
if not n:
    g.fail("không thấy workflow Google")
if bad:
    g.fail(" | ".join(bad))
g.ok(f"PASS {n} workflow Google: mọi attempt chạy thật đều để lại log trong sổ hoặc bị chặn")
