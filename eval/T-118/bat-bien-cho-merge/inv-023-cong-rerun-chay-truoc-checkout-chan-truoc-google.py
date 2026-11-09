#!/usr/bin/env python3
"""INV-023 (planner/vendor/images, rút từ T-118 adv-01, sự cố run 42621254239): cổng Re-run chạy được trong workspace TRỐNG (giả lập trước checkout) và vẫn chặn Re-run trước mọi bước Google.
Với mọi job (ở mọi workflow của repo tohong) có bước mang GOOGLE_MAPS_API_KEY (env bước/job/workflow) hoặc tên "Google: ...":
  1. bước 1 là "Cổng: không Re-run workflow Google", không continue-on-error;
  2. thư mục chạy của cổng (working-directory bước > defaults job > defaults workflow) tồn tại trong workspace trống;
  3. chạy nguyên văn script bằng `bash -e` (shell mặc định của GitHub) trong thư mục đó:
     RUN_ATTEMPT=1 / rỗng -> thoát 0;  RUN_ATTEMPT=2, 3 -> thoát khác 0;  env RUN_ATTEMPT lấy từ github.run_attempt;
  4. mọi bước Google đứng sau cổng và `if:` không chứa always()/failure()/cancelled() (nên bị skip khi cổng đỏ);
Không mạng, không Google. Repo: $TOHONG_REPO, hoặc cwd nếu có .github/workflows, hoặc ../tohong cạnh tohong-hq."""
import os, re, subprocess, sys, tempfile, yaml
sys.dont_write_bytecode = True
HQ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))))  # tohong-hq
repo = os.environ.get("TOHONG_REPO") or (os.getcwd() if os.path.isdir(".github/workflows") and os.path.isdir("tools/scraper") else os.path.join(HQ, "..", "tohong"))
wfdir = os.path.join(repo, ".github", "workflows")
if not os.path.isdir(wfdir):
    print("PASS chưa áp dụng (không tìm thấy repo tohong)"); sys.exit(0)
GATE = "Cổng: không Re-run workflow Google"
KEY = "GOOGLE_MAPS_API_KEY"
STATUS = re.compile(r"\b(always|failure|cancelled)\s*\(")
bad, seen = [], []

def has_key(env):
    return any(KEY in str(k) or KEY in str(v) for k, v in (env or {}).items())

for fn in sorted(os.listdir(wfdir)):
    if not fn.endswith((".yml", ".yaml")):
        continue
    wf = yaml.safe_load(open(os.path.join(wfdir, fn), encoding="utf-8"))
    for jn, job in (wf.get("jobs") or {}).items():
        steps = job.get("steps") or []
        g_idx = [i for i, s in enumerate(steps) if str(s.get("name", "")).startswith("Google:")
                 or has_key(s.get("env")) or has_key(job.get("env")) and "run" in s or has_key(wf.get("env")) and "run" in s]
        if not g_idx:
            continue
        where = f"{fn}:{jn}"
        seen.append(where)
        gate = steps[0]
        if gate.get("name") != GATE or "run" not in gate:
            bad.append(f"{where}: bước 1 không phải cổng Re-run ('{gate.get('name')}')"); continue
        if gate.get("continue-on-error") not in (None, False):
            bad.append(f"{where}: cổng có continue-on-error")
        if "run_attempt" not in str((gate.get("env") or {}).get("RUN_ATTEMPT", "")):
            bad.append(f"{where}: env RUN_ATTEMPT của cổng không lấy từ github.run_attempt")
        wd = gate.get("working-directory") or (((job.get("defaults") or {}).get("run") or {}).get("working-directory")) \
             or (((wf.get("defaults") or {}).get("run") or {}).get("working-directory")) or "."
        shell = gate.get("shell") or (((job.get("defaults") or {}).get("run") or {}).get("shell")) or "bash"
        if shell not in ("bash",):
            bad.append(f"{where}: shell cổng '{shell}' (eval chỉ giả lập bash)"); continue
        with tempfile.TemporaryDirectory() as ws:
            d = os.path.normpath(os.path.join(ws, str(wd).replace("${{ github.workspace }}", ws)))
            if not os.path.isdir(d):
                bad.append(f"{where}: cổng chạy trong '{wd}' không tồn tại trước checkout"); continue
            for att, want0 in (("1", True), ("", True), ("2", False), ("3", False)):
                env = dict(os.environ, RUN_ATTEMPT=att)
                r = subprocess.run(["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", gate["run"]],
                                   cwd=d, env=env, capture_output=True, text=True, timeout=30)
                if (r.returncode == 0) != want0:
                    bad.append(f"{where}: RUN_ATTEMPT='{att}' thoát {r.returncode}, mong {'0' if want0 else 'khác 0'}")
            if os.listdir(ws):
                bad.append(f"{where}: cổng để lại file trong workspace: {os.listdir(ws)}")
        for i in g_idx:
            s = steps[i]
            if i == 0:
                bad.append(f"{where}: bước Google ở vị trí 1, trước cổng"); continue
            if STATUS.search(str(s.get("if", ""))):
                bad.append(f"{where}: bước {i+1} '{s.get('name')}' có if trạng thái ({s.get('if')}) nên vẫn chạy khi cổng đỏ")

if not seen:
    print("PASS chưa áp dụng (không có job Google nào)"); sys.exit(0)
print("job Google đã kiểm: " + ", ".join(seen))
for b in bad:
    print("FAIL " + b)
print("PASS cổng chạy trong workspace trống, attempt 1 qua, attempt 2/3 chặn trước mọi bước Google" if not bad else "FAIL")
sys.exit(1 if bad else 0)
