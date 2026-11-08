#!/usr/bin/env python3
"""T-113 adv-08 (tầng 3, thăm dò bản v3): ngoại lệ "bị chặn trước khi gọi Google" của check_runs.py không được để lần chạy ĐÃ gọi Google lọt khỏi sổ.
Hành vi (CHECK_RUNS_JOBS_DIR thay gh api …/jobs?filter=all), lần chạy REAL không có log, mong đợi:
  A  gate failure + mọi Google: skipped                          -> bỏ qua (BLOCKED_BEFORE_GOOGLE), thoát 0
  B  gate failure nhưng một Google: success (bước chạy always())  -> MISSING_RUN_LOG
  C  attempt 1 job Google: success, attempt 2 job gate failure      -> MISSING_RUN_LOG
  D  job không có bước Google: nào (bước bị đổi tên)               -> MISSING_RUN_LOG
  E  hai job, một job bị chặn, job kia Google: success              -> MISSING_RUN_LOG
  F  Google: cancelled / in_progress                                -> MISSING_RUN_LOG
  G  không đọc được jobs                                            -> MISSING_RUN_LOG
Cấu trúc: mọi bước mang GOOGLE_MAPS_API_KEY (env bước/job/workflow) ở mọi workflow đều tên "Google: …"; không bước nào có khoá mà tên khác;
bước đầu tiên của mỗi job Google là "Cổng: không Re-run…" và thoát khác 0 khi GITHUB_RUN_ATTEMPT=2 (chạy nguyên văn script bằng bash), thoát 0 khi =1."""
import json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

cr = os.path.join(g.repo(), "tools", "scraper", "check_runs.py")
S = lambda n, c, st="completed": {"name": n, "conclusion": c, "status": st}
GATE_F, GATE_OK = S("Cổng: sổ đăng ký", "failure"), S("Cổng: không Re-run workflow Google", "success")
cases = {
    "A": ([{"steps": [GATE_OK, GATE_F, S("Google: Enrich thật", "skipped")]}], True),
    "B": ([{"steps": [GATE_OK, GATE_F, S("Google: Enrich thật", "success")]}], False),
    "C": ([{"steps": [GATE_OK, S("Google: Enrich thật", "success")]}, {"steps": [S("Cổng: không Re-run workflow Google", "failure"), S("Google: Enrich thật", "skipped")]}], False),
    "D": ([{"steps": [GATE_OK, GATE_F, S("Enrich thật", "success")]}], False),
    "E": ([{"steps": [GATE_F, S("Google: a", "skipped")]}, {"steps": [GATE_OK, S("Google: b", "success")]}], False),
    "F1": ([{"steps": [GATE_F, S("Google: a", "cancelled")]}], False),
    "F2": ([{"steps": [GATE_F, S("Google: a", None, "in_progress")]}], False),
    "G": (None, False),
}
bad = []
for k, (jobs, skip) in cases.items():
    with tempfile.TemporaryDirectory() as d:
        os.makedirs(os.path.join(d, "run-logs", "T-111"))
        os.makedirs(os.path.join(d, "jobs"))
        RID = "93000000001"
        if jobs is not None:
            json.dump({"total_count": len(jobs), "jobs": jobs}, open(os.path.join(d, "jobs", RID + ".json"), "w"))
        json.dump([{"databaseId": int(RID), "displayTitle": "REAL x (run %s)" % RID, "workflowName": "x", "status": "completed", "conclusion": "failure"}],
                  open(os.path.join(d, "runs.json"), "w"))
        json.dump([], open(os.path.join(d, "prs.json"), "w"))
        json.dump({"month": "2026-11", "text_search": 0, "photos": 0, "source": "f"}, open(os.path.join(d, "run-logs", "usage-baseline.json"), "w"))
        env = dict(os.environ, CHECK_RUNS_JOBS_DIR=os.path.join(d, "jobs"), GITHUB_RUN_ATTEMPT="1", GITHUB_REPOSITORY="")
        p = subprocess.run([sys.executable, "-I", cr, "--runs", os.path.join(d, "runs.json"), "--prs", os.path.join(d, "prs.json"), "--usage-root",
                            os.path.join(d, "run-logs"), "--current", "1"], capture_output=True, text=True, env=env, cwd=d)
        if skip and p.returncode != 0:
            bad.append(f"{k}: lần bị chặn thật sự vẫn bị đòi log ({p.stdout.strip()[-120:]})")
        if not skip and (p.returncode == 0 or "MISSING_RUN_LOG" not in p.stdout):
            bad.append(f"{k}: lần chạy có thể đã gọi Google được bỏ qua (thoát {p.returncode})")

wfdir = os.path.join(g.repo(), ".github", "workflows")
for name in sorted(os.listdir(wfdir)):
    if not name.endswith((".yml", ".yaml")):
        continue
    raw = open(os.path.join(wfdir, name), encoding="utf-8").read()
    if "GOOGLE_MAPS_API_KEY" not in raw:
        continue
    wf = g.load(name)
    if "GOOGLE_MAPS_API_KEY" in json.dumps(wf.get("env") or {}):
        bad.append(f"{name}: khoá ở env cấp workflow (mọi bước đều có khoá)")
    for jn, j in wf["jobs"].items():
        if "GOOGLE_MAPS_API_KEY" in json.dumps(j.get("env") or {}):
            bad.append(f"{name}/{jn}: khoá ở env cấp job")
        steps = j.get("steps", [])
        for s in steps:
            if "GOOGLE_MAPS_API_KEY" in json.dumps(s, ensure_ascii=False) and not str(s.get("name") or "").startswith("Google:"):
                bad.append(f"{name}/{jn}: bước mang khoá không tên 'Google:': {s.get('name') or s.get('run', '')[:40]!r}")
        if not any("GOOGLE_MAPS_API_KEY" in json.dumps(s.get("env") or {}) for s in steps):
            continue
        first = steps[0]
        if not str(first.get("name") or "").startswith("Cổng:") or not first.get("run"):
            bad.append(f"{name}/{jn}: bước đầu không phải cổng chặn Re-run")
            continue
        for att, want in (("2", False), ("1", True)):
            with tempfile.TemporaryDirectory() as d:
                sp = os.path.join(d, "s.sh")
                open(sp, "w").write(g.render(first["run"].replace("${{ github.run_attempt }}", att), {}))
                p = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", sp], cwd=d, capture_output=True, text=True,
                                   env=dict(os.environ, GITHUB_RUN_ATTEMPT=att, GITHUB_RUN_ID="5", **{k: g.render(str(v).replace("${{ github.run_attempt }}", att), {}) for k, v in (first.get("env") or {}).items()}))
                if (p.returncode == 0) != want:
                    bad.append(f"{name}/{jn}: cổng Re-run với attempt={att} thoát {p.returncode}")
if bad:
    g.fail(" | ".join(bad))
g.ok("PASS ngoại lệ bị-chặn chỉ áp khi chắc chắn không bước Google nào chạy (8 ca); mọi bước mang khoá tên 'Google:'; cổng Re-run chặn attempt 2, cho attempt 1")
