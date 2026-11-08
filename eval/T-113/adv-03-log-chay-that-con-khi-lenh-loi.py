#!/usr/bin/env python3
"""T-113 adv-03 (tầng 3): log của MỌI lần gọi Google thật phải nằm trong run-logs/<việc>/…-run-<GITHUB_RUN_ID>-… kể cả khi lệnh Python thoát khác 0
(refresh_photos.py thoát 1 khi có lỗi lẻ hoặc chạm --max-requests; enrich.py thoát 1 ở ERROR_STOP, 2 khi có OVERRIDE_ERROR). Spec T-111 Hành vi 4:
"Log không bao giờ bị xoá ... thư mục run-logs luôn được upload artifact" và sổ đăng ký đòi log `-run-<id>-` cho mỗi lần chạy REAL.

Cách đo: với mỗi workflow có GOOGLE_MAPS_API_KEY, chạy NGUYÊN VĂN script của từng bước mang khoá (đã thay ${{ }} như runner, dry_run=false) bằng
`bash --noprofile --norc -eo pipefail` (shell GitHub dùng cho `shell: bash`), với `python` giả in GOOGLE_USAGE rồi thoát 1. Sau mỗi bước phải có
ít nhất một tệp run-logs/*/*-run-777-* chứa dòng GOOGLE_USAGE. Bước cố ý chạy dry-run hoặc không gọi python thì bỏ qua."""
import json, os, stat, subprocess, sys, tempfile, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

wfdir = os.path.join(g.repo(), ".github", "workflows")
bad, ran = [], 0
for name in sorted(os.listdir(wfdir)):
    if not name.endswith((".yml", ".yaml")):
        continue
    if "GOOGLE_MAPS_API_KEY" not in open(os.path.join(wfdir, name), encoding="utf-8").read():
        continue
    wf = g.load(name)
    inputs = ((wf.get("on") or {}).get("workflow_dispatch") or {}).get("inputs") or {}
    inp = {k: (str(x.get("default")) if isinstance(x, dict) and x.get("default") is not None else "") for k, x in inputs.items()}
    if "dry_run" in inp:
        inp["dry_run"] = "false"
    if "skip_enrich" in inp:
        inp["skip_enrich"] = "false"
    if "budget_usd" in inp:
        inp["budget_usd"] = "30"
    for job in wf["jobs"].values():
        prior_mkdir = []   # `mkdir -p …` của các bước trước trong cùng job (runner giữ thư mục giữa các bước)
        for s in job.get("steps", []):
            if "GOOGLE_MAPS_API_KEY" not in json.dumps(s.get("env") or {}):
                prior_mkdir += [l.strip() for l in (s.get("run") or "").splitlines() if l.strip().startswith("mkdir -p")]
                continue
            cond = s.get("if")
            if cond is not None and not g._truthy(g.evaluate(str(cond), inp)):
                continue
            script = s.get("run") or ""
            if "python" not in script or "main.py" in script:
                continue
            if name == "scrape-vendors.yml":
                continue  # workflow cũ, spec chỉ bỏ lịch; không có quy ước log (sổ đăng ký chặn bằng MISSING_RUN_LOG)
            body = g.render(script, inp)
            with tempfile.TemporaryDirectory() as d:
                b = os.path.join(d, "bin")
                os.makedirs(b)
                fake = os.path.join(b, "python")
                open(fake, "w").write("#!/bin/sh\necho 'RESULT ok=1 error=1'\necho 'GOOGLE_USAGE text_search=0 photo_details=1 photo_media=2'\nexit 1\n")
                os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
                for alias in ("python3",):
                    os.symlink(fake, os.path.join(b, alias))
                wd = os.path.join(d, "tools", "scraper")
                os.makedirs(wd)
                sp = os.path.join(d, "step.sh")
                open(sp, "w").write("\n".join(g.render(l, inp) for l in prior_mkdir) + "\n" + body)
                env = dict(os.environ, PATH=b + os.pathsep + os.environ.get("PATH", ""), GITHUB_RUN_ID="777", GITHUB_RUN_ATTEMPT="1",
                           GITHUB_STEP_SUMMARY=os.path.join(d, "summary.md"), GOOGLE_MAPS_API_KEY="fake", RUNNER_TEMP=d)
                for k, v in (s.get("env") or {}).items():
                    if k != "GOOGLE_MAPS_API_KEY":
                        env[k] = g.render(str(v), inp)
                p = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", sp], cwd=wd, env=env, capture_output=True, text=True, timeout=60)
                ran += 1
                logs = [f for f in glob.glob(os.path.join(wd, "run-logs", "*", "*-run-777-*")) if "GOOGLE_USAGE" in open(f, errors="replace").read()]
                prior_mkdir += [l.strip() for l in script.splitlines() if l.strip().startswith("mkdir -p")]
                if not logs:
                    bad.append(f"{name} / bước '{s.get('name')}' (thoát {p.returncode}): không có run-logs/*/*-run-777-* chứa GOOGLE_USAGE")
if not ran:
    g.fail("không mô phỏng được bước gọi Google nào")
if bad:
    g.fail("lần chạy thật lỗi để lại KHÔNG có log trong run-logs (sổ đăng ký sẽ chặn bằng MISSING_RUN_LOG, artifact run-logs/ cũng không có): " + " | ".join(bad))
g.ok(f"PASS {ran} bước gọi Google: lệnh thoát 1 vẫn để lại log -run-<id>- có GOOGLE_USAGE")
