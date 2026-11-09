#!/usr/bin/env python3
"""INV-024 (đề xuất từ T-119 adv-01, vùng planner/vendor/images): log của mọi bước gọi Google thật phải nằm trong run-logs/<việc>/…-run-<GITHUB_RUN_ID>-…
NGAY TRONG LÚC CHẠY, nên vẫn còn khi lần chạy bị Cancel / hết timeout (runner: SIGINT -> SIGTERM -> SIGKILL cây tiến trình, bỏ các lệnh còn lại của bước,
rồi chạy các bước always(): upload artifact run-logs/, mở PR).
Lý do: usage.py ghi GOOGLE_REQUEST + flush TRƯỚC mỗi request để "lần chạy bị huỷ/giết/hết giờ vẫn đếm đúng"; check_runs.py đòi log -run-<id>- cho mọi lần
REAL kể cả cancelled; lối khôi phục duy nhất ngoài baseline của Capu là artifact run-logs/. Log tee ra chỗ khác ($RUNNER_TEMP…) rồi `cp` cuối bước thì mất
khi bị huỷ: request đã trả tiền biến khỏi sổ, lần sau MISSING_RUN_LOG.
Cách đo: với mỗi workflow có GOOGLE_MAPS_API_KEY (trừ scrape-vendors.yml), mỗi bước mang khoá chạy được khi dry_run=false: chạy NGUYÊN VĂN script
(`bash --noprofile --norc -eo pipefail`, mkdir của bước trước), `python` giả in GOOGLE_REQUEST/GOOGLE_USAGE (flush) rồi ngủ; huỷ như runner;
mong đợi một file run-logs/*/*-run-777-* chứa GOOGLE_REQUEST (đủ để artifact run-logs/ giữ nó; tên tạm như .part được, nhưng khi đó phải có bước always()
đưa về *.log cho add-paths/check_runs: phần đó đo bằng eval đầu-cuối của từng workflow, vd eval/T-119/adv-01). Không mạng, không Google."""
import glob, json, os, re, signal, subprocess, sys, tempfile, time, yaml

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
repo = os.environ.get("TOHONG_REPO") or (os.getcwd() if os.path.isdir(".github/workflows") and os.path.isdir("tools/scraper") else os.path.join(HQ, "..", "tohong"))
wfdir = os.path.join(repo, ".github", "workflows")
CTX = {"github.run_id": "777", "github.run_attempt": "1", "github.run_number": "5"}

def render(s, inp):
    def ev(m):
        for part in m.group(1).split("||"):
            part = part.strip()
            if part[:1] == "'":
                return part.strip("'")
            if part.startswith("github.event.inputs."):
                v = inp.get(part.split(".", 3)[3], "")
                if v:
                    return v
            elif part in CTX:
                return CTX[part]
        return ""
    return re.sub(r"\$\{\{(.*?)\}\}", ev, s)

FAKE = "#!/bin/sh\necho 'GOOGLE_REQUEST run=r1-777a1-x-deadbeef kind=search'\necho 'GOOGLE_USAGE run=r1-777a1-x-deadbeef text_search=1 photo_details=0 photo_media=0'\nexec sleep 60\n"
bad, ran = [], 0
for name in sorted(os.listdir(wfdir)):
    path = os.path.join(wfdir, name)
    if not name.endswith((".yml", ".yaml")) or name == "scrape-vendors.yml" or "GOOGLE_MAPS_API_KEY" not in open(path, encoding="utf-8").read():
        continue
    wf = yaml.safe_load(open(path, encoding="utf-8").read())
    on = wf.get("on", wf.get(True)) or {}
    inputs = ((on.get("workflow_dispatch") or {}).get("inputs")) or {}
    inp = {k: (str(x.get("default")) if isinstance(x, dict) and x.get("default") is not None else "") for k, x in inputs.items()}
    for k, v in (("dry_run", "false"), ("skip_enrich", "false"), ("budget_usd", "30")):
        if k in inp:
            inp[k] = v
    for job in wf["jobs"].values():
        mk = []
        for s in job.get("steps", []):
            script = s.get("run") or ""
            if "GOOGLE_MAPS_API_KEY" not in json.dumps(s.get("env") or {}):
                mk += [l.strip() for l in script.splitlines() if l.strip().startswith("mkdir -p")]
                continue
            cond = str(s.get("if") or "")
            if re.search(r"dry_run\s*==\s*'true'|dry_run\s*!=\s*'false'", cond) or "python" not in script:
                continue
            with tempfile.TemporaryDirectory() as d:
                b = os.path.join(d, "bin"); os.makedirs(b)
                for alias in ("python", "python3"):
                    open(os.path.join(b, alias), "w").write(FAKE); os.chmod(os.path.join(b, alias), 0o755)
                wd = os.path.join(d, "tools", "scraper"); os.makedirs(wd)
                rt = os.path.join(d, "rt"); os.makedirs(rt)
                sp = os.path.join(d, "step.sh")
                open(sp, "w").write("\n".join(render(l, inp) for l in mk) + "\n" + render(script, inp))
                env = dict(os.environ, PATH=b + os.pathsep + os.environ.get("PATH", ""), GITHUB_RUN_ID="777", GITHUB_RUN_ATTEMPT="1",
                           GITHUB_STEP_SUMMARY=os.path.join(d, "summary.md"), GOOGLE_MAPS_API_KEY="fake", RUNNER_TEMP=rt)
                for k, v in (s.get("env") or {}).items():
                    if k != "GOOGLE_MAPS_API_KEY":
                        env[k] = render(str(v), inp)
                p = subprocess.Popen(["bash", "--noprofile", "--norc", "-eo", "pipefail", sp], cwd=wd, env=env,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
                time.sleep(1.5)
                p.send_signal(signal.SIGINT); time.sleep(1)
                if p.poll() is None:
                    p.send_signal(signal.SIGTERM); time.sleep(0.5)
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                p.wait(timeout=30)
                ran += 1
                logs = [f for f in glob.glob(os.path.join(wd, "run-logs", "*", "*-run-777-*")) if "GOOGLE_REQUEST" in open(f, errors="replace").read()]
                mk += [l.strip() for l in script.splitlines() if l.strip().startswith("mkdir -p")]
                if not logs:
                    bad.append(f"{name} / '{s.get('name')}'")
if not ran:
    print("FAIL không mô phỏng được bước gọi Google nào"); sys.exit(1)
if bad:
    print("FAIL bị huỷ giữa chừng thì không còn file -run-<id>- trong run-logs (artifact/PR/sổ đăng ký mất request đã trả): " + " | ".join(bad)); sys.exit(1)
print(f"PASS {ran} bước gọi Google: bị huỷ giữa chừng vẫn còn log -run-<id>- có GOOGLE_REQUEST trong run-logs")
