#!/usr/bin/env python3
"""T-065 tiêu chí 5: workflow có ô bật Wayback (mặc định tắt) truyền đúng `--fallback wayback` cho mirror, không truyền tham số tinh chỉnh tốc độ, timeout đủ dài,
Summary hiện wayback=n; README có mục Wayback đủ nội dung (spec mục 23-26). Chạy các đoạn script của workflow với công cụ giả.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_6_workflow_readme.py --back /home/user/tohong-back"""
import os, re, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import fail, ok, need_back, tmpdir
import yaml

back = need_back()
wf_path = os.path.join(back, ".github", "workflows", "mirror-vendor-images.yml")
if not os.path.isfile(wf_path): fail("thiếu workflow mirror-vendor-images.yml")
text = open(wf_path, encoding="utf-8").read()
wf = yaml.safe_load(text)
on = wf.get("on") or wf.get(True)
inputs = on["workflow_dispatch"]["inputs"]
if "wayback" not in inputs: fail("workflow thiếu ô nhập 'wayback'")
w = inputs["wayback"]
if w.get("type") != "boolean" or w.get("default") not in (False, "false"): fail("ô wayback phải là boolean, mặc định false: %s" % w)
if not str(w.get("description", "")).strip(): fail("ô wayback cần mô tả")
for k in ("deploy", "base_url"):
    if k not in inputs: fail("ô %s cũ không được mất" % k)
if set(on) - {"workflow_dispatch"}: fail("workflow vẫn chỉ chạy tay")
if re.search(r"--wayback-(interval|backoff|base)", text): fail("workflow không được truyền --wayback-interval/--wayback-backoff/--wayback-base (giữ tốc độ mặc định)")
job = wf["jobs"]["mirror"]
tm = job.get("timeout-minutes")
if tm != 360: fail("timeout-minutes của job phải đúng 360 (tối đa của GitHub; Wayback chậm hơn 82 phút ước tính nếu mỗi yêu cầu > 1 giây), thấy %r" % (tm,))
lines = text.splitlines()
li = next(i for i, l in enumerate(lines) if re.search(r"timeout-minutes:\s*360", l))
near = " ".join(lines[max(0, li - 4):li + 1])
if "#" not in near or not re.search(r"wayback", near, re.I): fail("phải ghi lý do của timeout-minutes: 360 bằng một dòng chú thích (#) nhắc Wayback ngay phía trên hoặc cùng dòng")
if "secrets." in text.replace("secrets.CLOUDFLARE_API_TOKEN", "").replace("secrets.CLOUDFLARE_ACCOUNT_ID", ""): fail("Wayback không cần secret nào mới")
steps = job["steps"]
mstep = next((s for s in steps if "tee mirror.log" in s.get("run", "")), None)
sstep = next((s for s in steps if "GITHUB_STEP_SUMMARY" in s.get("run", "")), None)
if not mstep or not sstep: fail("không tìm thấy bước mirror hoặc bước Summary")
if "${{" in mstep["run"] or "${{" in sstep["run"]: fail("script bước mirror/Summary không dùng ${{ }} (đưa qua env)")
if "inputs.wayback" not in str(job.get("env", {})) and "inputs.wayback" not in str(mstep.get("env", {})): fail("ô wayback phải được đưa vào bước mirror qua env")

tmp = tmpdir("wf-")
tool = os.path.join(tmp, "tool.mjs")
open(tool, "w").write("console.log('ARGV ' + process.argv.slice(2).join(' '));\nconsole.log('SUMMARY total=3 ok=3 new=3 reused=0 restored=0 failed=0 missing=0 wayback=2');\n")
def run_mirror(val):
    env = {"PATH": os.environ["PATH"], "HOME": tmp, "TOOL": tool, "POOL": "p.js", "MANIFEST": "m.json", "OUT": "out", "BASE_URL": "https://tohong-img.pages.dev", "DEPLOY": "false"}
    for src in (job.get("env", {}), mstep.get("env", {})):
        for k, v in src.items():
            if "inputs.wayback" in str(v) and val is not None: env[k] = val
    w_ = os.path.join(tmp, "w" + str(val)); os.makedirs(w_, exist_ok=True)
    return subprocess.run(["bash", "-e", "-o", "pipefail", "-c", mstep["run"]], capture_output=True, text=True, env=env, cwd=w_, timeout=30)
for val, want in (("true", True), ("false", False), ("", False)):
    r = run_mirror(val)
    if r.returncode != 0: fail("bước mirror đỏ với wayback=%r: %s" % (val, r.stderr[-200:]))
    argv = next((l for l in r.stdout.splitlines() if l.startswith("ARGV ")), "")
    has = "--fallback wayback" in argv
    if has != want: fail("wayback=%r: %s `--fallback wayback` trong lệnh mirror (argv: %s)" % (val, "thiếu" if want else "không được có", argv))
    if want and argv.count("--fallback") != 1: fail("chỉ một --fallback")
    for must in ("mirror", "--pool", "--manifest", "--out", "--base-url"):
        if must not in argv: fail("lệnh mirror mất tham số cũ %s" % must)

# Summary
def summary(log):
    w_ = os.path.join(tmp, "sum"); os.makedirs(w_, exist_ok=True); open(os.path.join(w_, "mirror.log"), "w").write(log)
    f = os.path.join(w_, "step.md"); open(f, "w").close()
    r = subprocess.run(["bash", "-e", "-o", "pipefail", "-c", sstep["run"]], capture_output=True, text=True, cwd=w_, timeout=30,
                       env={"PATH": os.environ["PATH"], "HOME": tmp, "GITHUB_STEP_SUMMARY": f, "POOL": "p.js", "MANIFEST": "m.json", "OUT": "out"})
    if r.returncode != 0: fail("bước Summary đỏ: " + r.stderr[-200:])
    return open(f).read()
out = summary("PROGRESS done=10 total=10 ok=7 failed=3 (http-404=3)\nFAILED http://x/1 http-404\nSUMMARY total=10 ok=7 new=7 reused=0 restored=0 failed=3 missing=0 wayback=4\n")
if not re.search(r"(?m)^Wayback: 4\b", out): fail("Summary phải có một dòng bắt đầu bằng 'Wayback: 4' (số ảnh khôi phục từ Wayback)")
if "wayback=4" not in out: fail("Summary vẫn chứa nguyên dòng SUMMARY")
out = summary("PROGRESS done=3 total=3 ok=3 failed=0 (none)\nSUMMARY total=3 ok=3 new=3 reused=0 restored=0 failed=0 missing=0\n")
if "Wayback:" in out: fail("SUMMARY không có wayback= thì không có dòng 'Wayback:'")
out = summary("PROGRESS done=100 total=300 ok=0 failed=100 (timeout=100)\nSUMMARY total=300 ok=0 new=0 reused=0 restored=0 failed=50 missing=0 wayback=0 stopped=early reason=timeout-50/50\n")
if "Dừng sớm: reason=timeout-50/50" not in out or not re.search(r"(?m)^Wayback: 0\b", out): fail("dừng sớm có wayback=0: vẫn 'Dừng sớm: reason=…' và 'Wayback: 0'")

# README
rd = open(os.path.join(back, "scripts", "vendor-images", "README.md"), encoding="utf-8").read()
secs = re.split(r"(?m)^(?=## )", rd)
sec = next((s for s in secs if s.startswith("## ") and "wayback" in s.splitlines()[0].lower()), None)
if not sec: fail("README thiếu mục '## … Wayback …'")
low = sec.lower()
need = [(r"--fallback wayback", "lệnh --fallback wayback"), (r"1 yêu cầu/giây|một yêu cầu mỗi giây|1 request/giây|1 req/s", "giới hạn 1 yêu cầu/giây"),
        (r"429", "xử lý 429"), (r"503", "xử lý 503"), (r"source", "trường source trong manifest"), (r"snapshot", "trường snapshot"),
        (r"wayback=", "wayback= trong SUMMARY"), (r"origin-skipped", "origin-skipped"), (r"mã 4|dừng sớm", "tương tác với dừng sớm"),
        (r"availability", "API availability"), (r"id_", "URL raw hậu tố id_"), (r"ô .?wayback|input .?wayback|wayback.{0,20}(ô|tick|bật)", "ô bật Wayback trong workflow"),
        (r"mốc|theo mốc|checkpoint", "ghi manifest theo mốc (mỗi 100 ảnh)"), (r"bản quyền|ADR-021", "nhắc ADR-021 / bản quyền không đổi"), (r"403", "phiên cloud bị chặn archive.org (403), chạy trên Actions hoặc máy Capu")]
for rx, what in need:
    if not re.search(rx, sec, re.I): fail("mục Wayback của README thiếu: " + what)
if not re.search(r"(?m)^## Đường dự phòng", rd) or "## Theo dõi tiến độ và dừng sớm" not in rd: fail("README mất mục cũ")
ok("workflow có ô wayback (mặc định tắt) truyền --fallback wayback, timeout 360, Summary 'Wayback: n'; README có mục Wayback đủ nội dung")
