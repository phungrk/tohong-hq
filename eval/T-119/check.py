#!/usr/bin/env python3
"""T-119 (sự cố run 42627710812): bước "Google: Enrich thật" của enrich-vendors.yml tạo file log của
chính lần chạy (qua tee) TRƯỚC khi enrich.py đọc sổ usage → file rỗng bị coi là USAGE_LOG_UNREADABLE → từ chối chạy thật.
Eval chạy NGUYÊN VĂN script của bước đó trong bản sao tools/scraper, với `python` giả trên PATH: khi gọi
`python enrich.py ...` nó chỉ đọc sổ usage bằng chính enrichment.usage.read_usage của repo (không gọi Google)
và thoát 2 nếu có log không đọc được. PASS khi bước chạy xong rc=0 và log của lần chạy vẫn nằm đúng chỗ
run-logs/T-111/*-run-<id>-*.log (Summary/pr_body đọc từ đó). Chạy: python3 check.py <repo tohong>"""
import os, re, sys, shutil, subprocess, tempfile, pathlib, yaml
repo = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TOHONG_REPO", "/home/user/tohong")).resolve()
wf = yaml.safe_load((repo / ".github/workflows/enrich-vendors.yml").read_text())
job = next(iter(wf["jobs"].values()))
step = next(s for s in job["steps"] if str(s.get("name", "")).startswith("Google: Enrich thật"))
script = step["run"].replace("${{ github.run_id }}", "4242")
real_py = shutil.which("python3")
with tempfile.TemporaryDirectory() as td:
    td = pathlib.Path(td)
    shutil.copytree(repo / "tools/scraper", td / "scraper", ignore=shutil.ignore_patterns("node_modules", "__pycache__", ".venv"))
    bindir = td / "bin"; bindir.mkdir()
    fake = bindir / "python"
    fake.write_text(f"""#!{real_py}
import sys, os
if len(sys.argv) > 1 and sys.argv[1] == "enrich.py":
    sys.path.insert(0, os.getcwd())
    from pathlib import Path
    from enrichment import usage as usg
    a = sys.argv
    root = Path(a[a.index("--usage-root") + 1]); month = a[a.index("--month") + 1]
    u = usg.read_usage(root, month)
    if u.unreadable:
        print("USAGE_LOG_UNREADABLE", *u.unreadable); sys.exit(2)
    print("GOOGLE_USAGE run=fake text_search=0 photo_details=0 photo_media=0"); sys.exit(0)
os.execv("{real_py}", ["{real_py}"] + sys.argv[1:])
""")
    fake.chmod(0o755)
    env = dict(os.environ, PATH=f"{bindir}:{os.environ['PATH']}", RUNNER_TEMP=str(td / "rt"),
               budget_usd="30", categories="all", max_photos="2", cap_basis="net", include_non_pool="false",
               GOOGLE_MAPS_API_KEY="dummy")
    (td / "rt").mkdir()
    shell = step.get("shell", "bash")
    p = subprocess.run(["bash", "-e", "-c", script] if shell == "bash" else ["bash", "-c", script],
                       cwd=td / "scraper", env=env, capture_output=True, text=True, timeout=300)
    out = p.stdout + p.stderr
    logs = list((td / "scraper/run-logs/T-111").glob("*-run-4242-*.log"))
    ok_rc = p.returncode == 0 and "USAGE_LOG_UNREADABLE" not in out
    ok_log = len(logs) == 1 and "GOOGLE_USAGE" in logs[0].read_text()
    print(("PASS" if ok_rc else "FAIL"), f"bước Enrich thật không tự chặn vì log của chính nó (rc={p.returncode})")
    print(("PASS" if ok_log else "FAIL"), f"log lần chạy nằm ở run-logs/T-111/*-run-<id>-*.log và có GOOGLE_USAGE ({[l.name for l in logs]})")
    if not (ok_rc and ok_log):
        print(out[-1500:]); print("FAIL"); sys.exit(1)
    print("PASS")
