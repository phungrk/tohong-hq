#!/usr/bin/env python3
"""T-058 tiêu chí 7: workflow Mirror vendor images: mirror thoát mã 4 -> bước đỏ kèm thông báo; Summary (chạy cả khi đỏ) hiện PROGRESS cuối và lý do dừng;
không rewrite/deploy/PR sau mã 4. Chạy các đoạn script của workflow với tool giả.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_7_workflow.py --back /home/user/tohong-back"""
import os, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import fail, ok, parse_args, tmpdir
import yaml

back = parse_args().get("back") or fail("cần --back <tohong-back>")
wf = os.path.join(back, ".github", "workflows", "mirror-vendor-images.yml")
if not os.path.isfile(wf): fail("thiếu workflow mirror-vendor-images.yml")
steps = yaml.safe_load(open(wf, encoding="utf-8"))["jobs"]["mirror"]["steps"]
idx_m = next((i for i, s in enumerate(steps) if "tee mirror.log" in s.get("run", "")), None)
idx_s = next((i for i, s in enumerate(steps) if "GITHUB_STEP_SUMMARY" in s.get("run", "")), None)
if idx_m is None or idx_s is None: fail("không tìm thấy bước mirror (tee mirror.log) hoặc bước Summary (GITHUB_STEP_SUMMARY)")
mstep, sstep = steps[idx_m], steps[idx_s]
if "${{" in mstep["run"] or "${{" in sstep["run"]: fail("script bước mirror/Summary không được dùng biểu thức ${{ }} (đưa qua env)")
if "always()" not in str(sstep.get("if", "")): fail("bước Summary phải chạy cả khi mirror đỏ (if: always())")
for s in steps[idx_m + 1:]:
    if s is not sstep and any(w in str(s.get("if", "")) for w in ("always()", "failure()")):
        fail("bước '%s' sau mirror không được chạy khi mirror đỏ" % s.get("name"))

tmp = tmpdir("wf-")
def sh(script, env_extra, cwd):
    e = {"PATH": os.environ["PATH"], "HOME": tmp, "POOL": "p.js", "MANIFEST": "m.json", "OUT": "out", "BASE_URL": "https://tohong-img.pages.dev"}
    e.update(env_extra)
    shell = ["bash", "-e", "-o", "pipefail", "-c", script] if (mstep.get("shell") in (None, "bash")) else None
    return subprocess.run(shell, capture_output=True, text=True, env=e, cwd=cwd, timeout=60)

# bước mirror với tool giả
def fake_tool(code):
    p = os.path.join(tmp, "tool%d.mjs" % code)
    open(p, "w").write("console.log('PROGRESS done=50 total=80 ok=0 failed=50 (timeout=50)');\nconsole.log('SUMMARY total=80 ok=0 new=0 reused=0 restored=0 failed=50 missing=0 stopped=early reason=timeout-50/50');\nprocess.exit(%d);\n" % code)
    return p
for code, must_fail in ((4, True), (2, True), (0, False)):
    w = os.path.join(tmp, "run%d" % code); os.makedirs(w, exist_ok=True)
    r = sh(mstep["run"], {"TOOL": fake_tool(code)}, w)
    if must_fail and r.returncode == 0: fail("tool thoát %d mà bước mirror vẫn xanh" % code)
    if not must_fail and r.returncode != 0: fail("tool thoát 0 mà bước mirror đỏ: " + r.stderr[-200:])
    if code == 4 and "nguồn chặn hoặc treo, xem README đường dự phòng" not in r.stdout + r.stderr: fail("mã 4 thiếu thông báo 'nguồn chặn hoặc treo, xem README đường dự phòng'")
    if code == 4 and "::error::" not in r.stdout + r.stderr: fail("thông báo mã 4 phải là chú thích ::error::")
    if code == 0 and "::error::" in r.stdout + r.stderr: fail("mã 0 không được có ::error::")
    if "PROGRESS done=50" not in r.stdout: fail("bước mirror phải để stdout của tool hiện ra log")
    if "PROGRESS done=50" not in open(os.path.join(w, "mirror.log")).read(): fail("mirror.log phải chứa stdout của tool")

# bước Summary
def summary_for(log):
    w = os.path.join(tmp, "sum"); os.makedirs(w, exist_ok=True)
    open(os.path.join(w, "mirror.log"), "w").write(log)
    f = os.path.join(w, "step_summary.md"); open(f, "w").close()
    r = sh(sstep["run"], {"GITHUB_STEP_SUMMARY": f}, w)
    if r.returncode != 0: fail("bước Summary đỏ: " + r.stderr[-200:])
    return open(f).read()
out = summary_for("PROGRESS done=100 total=300 ok=0 failed=100 (http-403=100)\nFAILED http://x/1 http-403\nPROGRESS done=150 total=300 ok=10 failed=140 (http-403=140)\nSUMMARY total=300 ok=10 new=10 reused=0 restored=0 failed=140 missing=0 stopped=early reason=mixed-50/50\n")
if "PROGRESS done=150 total=300 ok=10 failed=140 (http-403=140)" not in out: fail("Summary phải hiện dòng PROGRESS cuối")
if "done=100 total" in out: fail("Summary chỉ hiện dòng PROGRESS cuối, không phải mọi dòng")
if "Dừng sớm: reason=mixed-50/50" not in out: fail("Summary thiếu dòng 'Dừng sớm: reason=mixed-50/50'")
out = summary_for("PROGRESS done=3 total=3 ok=3 failed=0 (none)\nSUMMARY total=3 ok=3 new=3 reused=0 restored=0 failed=0 missing=0\n")
if "Dừng sớm" in out: fail("lần chạy bình thường không được có dòng Dừng sớm")
out = summary_for("")
if "chưa có dòng PROGRESS" not in out: fail("không có PROGRESS thì Summary phải ghi 'chưa có dòng PROGRESS'")
ok("workflow xử lý mã 4 và Summary hiện PROGRESS cuối, lý do dừng")
