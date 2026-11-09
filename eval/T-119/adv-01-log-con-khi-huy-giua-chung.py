#!/usr/bin/env python3
"""T-119 adv-01 (tầng 3): đi NỐI các bước sau "Google: Enrich thật" của enrich-vendors.yml như runner, kể cả khi lần chạy bị HUỶ giữa chừng.

Vì sao: usage.py hứa "lần chạy bị huỷ/giết/hết giờ vẫn đếm đúng" (GOOGLE_REQUEST ghi + flush TRƯỚC mỗi request); sổ đăng ký (check_runs.py) đòi
log `-run-<id>-` cho MỌI lần REAL kể cả `cancelled`; lối khôi phục là artifact `run-logs/`. Điều đó chỉ đúng nếu log nằm trong run-logs/ NGAY TRONG
lúc chạy. Bấm Cancel (hoặc hết timeout job) thì runner gửi SIGINT, rồi SIGTERM, rồi SIGKILL cây tiến trình, bỏ qua mọi lệnh còn lại của bước
(vd `cp` sau pipeline), rồi chạy các bước `always()` (Summary, che khoá, upload artifact, pr_body, Open PR).

Cách đo: chạy NGUYÊN VĂN script các bước (thay ${{ github.run_id }}=4242) bằng `bash --noprofile --norc -eo pipefail` trong bản sao tools/scraper,
`python` giả trên PATH: `python enrich.py` đọc sổ bằng enrichment.usage.read_usage thật (thoát 2 nếu log không đọc được), in GOOGLE_REQUEST (flush) rồi
tuỳ ca: ok (exit 0) | error (ERROR_STOP, exit 1) | budget (BUDGET_STOP, exit 0) | cancel (ngủ; bị SIGINT -> SIGTERM -> SIGKILL như runner).
Sau đó chạy Summary, che khoá, pr_body (thật), kiểm glob add-paths `run-logs/T-111/*.log`, và LẦN CHẠY SAU: check_runs.py (run 4242 REAL) +
read_usage phải đếm đủ request của lần này.
PASS khi mọi ca: log -run-4242- nằm trong run-logs/T-111 (=> artifact + PR có nó), có đủ GOOGLE_REQUEST, Summary/pr_body thấy, exit code giữ đúng,
lần sau không MISSING_RUN_LOG và đếm đủ. Chạy: python3 adv-01-…py <repo tohong>"""
import glob, os, pathlib, re, shutil, signal, subprocess, sys, tempfile, time, yaml

repo = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TOHONG_REPO", "/home/user/tohong")).resolve()
wf = yaml.safe_load((repo / ".github/workflows/enrich-vendors.yml").read_text())
job = next(iter(wf["jobs"].values()))
steps = {str(s.get("name", "")): s for s in job["steps"]}
def step(prefix):
    return next(s for n, s in steps.items() if n.startswith(prefix))
RID = "4242"
def sub(script):
    return script.replace("${{ github.run_id }}", RID)
enrich = sub(step("Google: Enrich thật")["run"])
summary = sub(step("Summary")["run"])
keychk = sub(step("Kiểm log không lộ khoá")["run"])
prbody = sub(step("Body PR")["run"])
addpaths = [l.strip() for l in step("Open PR")["with"]["add-paths"].splitlines() if l.strip()]
log_glob = next(p for p in addpaths if "run-logs" in p)
real_py = shutil.which("python3")
BASH = ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c"]

FAKE = f"""#!{real_py}
import sys, os, time
if len(sys.argv) > 1 and sys.argv[1] == "enrich.py":
    sys.path.insert(0, os.getcwd())
    from pathlib import Path
    from enrichment import usage as usg
    a = sys.argv
    u = usg.read_usage(Path(a[a.index("--usage-root") + 1]), a[a.index("--month") + 1])
    if u.unreadable:
        print("USAGE_LOG_UNREADABLE", *u.unreadable, flush=True); sys.exit(2)
    mode = os.environ.get("FAKE_MODE", "ok")
    rid = "r20261109T000000-{RID}a1-enrich-deadbeef"
    for _ in range(3):
        print(f"GOOGLE_REQUEST run={{rid}} kind=search", flush=True)
    if mode == "cancel":
        time.sleep(60)
    if mode == "error":
        print("ERROR_STOP category=venue", flush=True)
    if mode == "budget":
        print("BUDGET_STOP cap=30 used=29.99", flush=True)
    print("CATEGORY_REPORT category=venue processed=3 kept=3 with_photos=3 removed=0 temp_closed=0 review=0 error=0 unprocessed=0", flush=True)
    print(f"GOOGLE_USAGE run={{rid}} text_search=3 photo_details=0 photo_media=0", flush=True)
    sys.exit(1 if mode == "error" else 0)
os.execv("{real_py}", ["{real_py}"] + sys.argv[1:])
"""

def case(mode):
    errs = []
    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        sc = td / "ws/tools/scraper"
        shutil.copytree(repo / "tools/scraper", sc, ignore=shutil.ignore_patterns("node_modules", "__pycache__", ".venv", "output"))
        (sc / "output/HCMC").mkdir(parents=True)
        b = td / "bin"; b.mkdir(); (b / "python").write_text(FAKE); (b / "python").chmod(0o755)
        (td / "rt").mkdir()
        env = dict(os.environ, PATH=f"{b}:{os.environ['PATH']}", RUNNER_TEMP=str(td / "rt"), GITHUB_STEP_SUMMARY=str(td / "summary.md"),
                   budget_usd="30", categories="all", max_photos="2", cap_basis="net", include_non_pool="false",
                   GOOGLE_MAPS_API_KEY="dummy", FAKE_MODE=mode, GITHUB_RUN_ID=RID, GITHUB_RUN_ATTEMPT="1")
        p = subprocess.Popen(BASH + [enrich], cwd=sc, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
        if mode == "cancel":
            time.sleep(2)                     # đã in 3 GOOGLE_REQUEST (đã tiêu tiền)
            p.send_signal(signal.SIGINT); time.sleep(1.5)   # runner: SIGINT
            if p.poll() is None:
                p.send_signal(signal.SIGTERM); time.sleep(1)  # runner: SIGTERM
            try: os.killpg(p.pid, signal.SIGKILL)            # runner: giết cả cây tiến trình
            except ProcessLookupError: pass
        out, _ = p.communicate(timeout=120)
        rc = p.returncode
        if "USAGE_LOG_UNREADABLE" in out:
            errs.append("tự chặn USAGE_LOG_UNREADABLE")
        want_rc = {"ok": 0, "budget": 0, "error": 1}.get(mode)
        if want_rc is not None and rc != want_rc:
            errs.append(f"exit code bước = {rc}, python thoát {want_rc}")
        # các bước always()
        for scr in (summary, keychk, prbody):
            subprocess.run(BASH + [scr], cwd=sc, env=env, capture_output=True, text=True, timeout=120)
        logs = sorted((sc / "run-logs/T-111").glob(f"*-run-{RID}-*.log")) if (sc / "run-logs/T-111").exists() else []
        if len(logs) != 1:
            errs.append(f"run-logs/T-111/*-run-{RID}-*.log: {len(logs)} file (artifact/PR không có log của lần đã tiêu 3 request)")
        else:
            txt = logs[0].read_text()
            if txt.count("GOOGLE_REQUEST") != 3:
                errs.append(f"log thiếu GOOGLE_REQUEST ({txt.count('GOOGLE_REQUEST')}/3)")
        rel = log_glob.split("tools/scraper/", 1)[-1]
        if logs and not set(glob.glob(str(sc / rel))) >= {str(l) for l in logs}:
            errs.append(f"add-paths `{log_glob}` không khớp log")
        smd = (td / "summary.md").read_text() if (td / "summary.md").exists() else ""
        if mode != "cancel" and "GOOGLE_USAGE" not in smd:
            errs.append("Summary không thấy GOOGLE_USAGE")
        body = (sc / "pr-body.md").read_text() if (sc / "pr-body.md").exists() else ""
        if mode != "cancel" and "GOOGLE_USAGE" not in body:
            errs.append("pr_body không thấy GOOGLE_USAGE")
        # LẦN CHẠY SAU (sau khi PR dữ liệu merge: run-logs như workspace này)
        (td / "runs.json").write_text('[{"databaseId": %s, "displayTitle": "REAL Enrich vendors (run %s)", "workflowName": "Enrich vendors", "status": "completed", "conclusion": "%s"}]'
                                      % (RID, RID, "cancelled" if mode == "cancel" else ("failure" if mode == "error" else "success")))
        (td / "prs.json").write_text("[]")
        env2 = {k: v for k, v in env.items() if k not in ("GITHUB_RUN_ID", "GITHUB_REPOSITORY")}
        env2["GITHUB_RUN_ATTEMPT"] = "1"
        cr = subprocess.run([real_py, "check_runs.py", "--runs", str(td / "runs.json"), "--prs", str(td / "prs.json"), "--usage-root", "run-logs",
                             "--baseline", "run-logs/usage-baseline.json", "--current", "9999"], cwd=sc, env=env2, capture_output=True, text=True)
        if cr.returncode != 0:
            errs.append("lần sau check_runs chặn: " + " ".join(l for l in cr.stdout.splitlines() if l.startswith("MISSING_RUN_LOG")))
        month = time.strftime("%Y-%m", time.gmtime())
        cnt = subprocess.run([real_py, "-c", "import sys;sys.path.insert(0,'.');from pathlib import Path;from enrichment import usage as u;"
                              f"a=u.read_usage(Path('run-logs'),'{month}');b=u.read_usage(Path('{repo}/tools/scraper/run-logs'),'{month}');print(a.batch_ts-b.batch_ts)"],
                             cwd=sc, capture_output=True, text=True)
        if cnt.stdout.strip() != "3":
            errs.append(f"lần sau read_usage đếm {cnt.stdout.strip() or cnt.stderr[-200:]} request của lần này (đúng: 3)")
    return errs

bad = 0
for m in ("ok", "error", "budget", "cancel"):
    e = case(m)
    print(("PASS" if not e else "FAIL"), m, "; ".join(e))
    bad += bool(e)
print("FAIL" if bad else "PASS")
sys.exit(1 if bad else 0)
