#!/usr/bin/env python3
"""T-069 tiêu chí 6 (phần còn lại): workflow Summary hiện lý do/ngắt mạch Wayback, README nêu cách lấy ảnh mới (id_, không availability, mã thoát khi ngắt mạch),
`npm test` xanh với >= 3 ca Wayback viết cho cách mới (spec mục 21-23).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-069/check_6_workflow_readme_npm.py"""
import os, re, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t069 import fail, ok, need_back, tmpdir
import yaml

back = need_back()
wf_path = os.path.join(back, ".github", "workflows", "mirror-vendor-images.yml")
text = open(wf_path, encoding="utf-8").read()
wf = yaml.safe_load(text)
job = wf["jobs"]["mirror"]
if job.get("timeout-minutes") != 360: fail("timeout-minutes giữ 360")
if re.search(r"--wayback-(interval|backoff|base)", text): fail("workflow không truyền tham số tốc độ")
sstep = next((s for s in job["steps"] if "GITHUB_STEP_SUMMARY" in s.get("run", "")), None)
if not sstep: fail("không tìm thấy bước Summary")
tmp = tmpdir("wf-")
def summary(log):
    w_ = os.path.join(tmp, "s"); os.makedirs(w_, exist_ok=True); open(os.path.join(w_, "mirror.log"), "w").write(log)
    f = os.path.join(w_, "step.md"); open(f, "w").close()
    r = subprocess.run(["bash", "-e", "-o", "pipefail", "-c", sstep["run"]], capture_output=True, text=True, cwd=w_, timeout=30,
                       env={"PATH": os.environ["PATH"], "HOME": tmp, "GITHUB_STEP_SUMMARY": f, "POOL": "p.js", "MANIFEST": "m.json", "OUT": "out"})
    if r.returncode != 0: fail("bước Summary đỏ: " + r.stderr[-200:])
    return open(f).read()
out = summary("FAILED http://x/1 http-522 wayback=circuit-open\nSUMMARY total=60 ok=0 new=0 reused=0 restored=0 failed=60 missing=0 wayback=0 retry-later=60 circuit=open\n")
if not re.search(r"(?m)^Wayback: 0\b", out): fail("Summary vẫn có dòng 'Wayback: 0'")
if not re.search(r"(?m)^Wayback ngắt mạch", out): fail("SUMMARY có circuit=open thì Summary phải có một dòng bắt đầu 'Wayback ngắt mạch' (nêu retry-later và chạy lại sau)")
if "60" not in next(l for l in out.splitlines() if l.startswith("Wayback ngắt mạch")): fail("dòng 'Wayback ngắt mạch' nêu số ảnh chờ thử lại (retry-later=60)")
out = summary("SUMMARY total=3 ok=3 new=3 reused=0 restored=0 failed=0 missing=0 wayback=2 retry-later=0\n")
if "ngắt mạch" in out: fail("không circuit=open thì không có dòng ngắt mạch")
if not re.search(r"(?m)^Wayback: 2\b", out): fail("dòng 'Wayback: 2' giữ nguyên")

rd = open(os.path.join(back, "scripts", "vendor-images", "README.md"), encoding="utf-8").read()
secs = re.split(r"(?m)^(?=## )", rd)
sec = next((s for s in secs if s.startswith("## ") and "wayback" in s.splitlines()[0].lower()), None)
if not sec: fail("README thiếu mục '## … Wayback …'")
for rx, what in [(r"id_", "URL /web/<mốc>id_/<URL gốc>"), (r"chuyển hướng|redirect", "theo chuyển hướng"), (r"wayback=", "wayback=<lý do> ở dòng FAILED"),
                 (r"rate-limited", "lý do rate-limited"), (r"circuit-open|ngắt mạch", "ngắt mạch"), (r"retry-later", "retry-later trong SUMMARY"),
                 (r"mã 0", "ngắt mạch kết thúc mã 0"), (r"429", "xử lý 429"), (r"2 giây|2000", "tốc độ mặc định 2 giây"), (r"mã 4|dừng sớm", "dừng sớm")]:
    if not re.search(rx, sec, re.I): fail("mục Wayback của README thiếu: " + what)
if re.search(r"(?i)gọi.{0,30}availability|dùng.{0,30}availability", sec) and not re.search(r"(?i)không.{0,40}availability", sec): fail("README không được mô tả availability như đang dùng")

r = subprocess.run(["npm", "test"], cwd=back, capture_output=True, text=True, timeout=900)
if r.returncode != 0: fail("npm test đỏ (mã %s): %s" % (r.returncode, (r.stdout + r.stderr)[-300:]))
w = [n for n in re.findall(r"(?m)^\s*ok \d+ - (.*)$", r.stdout) if "wayback" in n.lower()]
if len(w) < 3: fail("npm test xanh nhưng chỉ có %d ca có 'wayback' trong tên (cần >= 3)" % len(w))
tj = open(os.path.join(back, "test", "test_vendor_images.js"), encoding="utf-8").read()
if "id_" not in tj: fail("test_vendor_images.js phải dựng Wayback giả kiểu /web/<mốc>id_/ (cách mới)")
if re.search(r"pathname\s*===?\s*['\"]/wayback/available", tj): fail("test không còn dựng /wayback/available như đường dùng được")
ok("Summary có dòng ngắt mạch; README mô tả id_, lý do, mã 0; npm test xanh với %d ca Wayback" % len(w))
