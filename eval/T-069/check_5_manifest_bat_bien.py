#!/usr/bin/env python3
"""T-069 tiêu chí 6 (phần hành vi): manifest giữ source/snapshot; entry ok cũ không bị hỏi lại (cả hai nguồn); chạy lại không tải gì;
bất biến inv-001..006 của vùng xanh với công cụ mới (spec mục 18-20).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-069/check_5_manifest_bat_bien.py"""
import os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t069 import *

back = need_back()
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
R = ["--retries", "0"]

paths = ["/ok/small.png", dead(1), dead(2)]
e = Env(paths)
try:
    e.wb.snaps = {dead(1): ("img", GOOD[0], TS), dead(2): ("img", GOOD[0], TS2)}
    p = e.mirror(back, R)
    if p.returncode != 0: fail("lần 1 mã 0, thấy %s" % p.returncode)
    ents = e.man()["entries"]
    if "source" in ents[e.url("/ok/small.png")] or "snapshot" in ents[e.url("/ok/small.png")]: fail("ảnh tải từ nguồn gốc không có source/snapshot")
    for pth, ts in ((dead(1), TS), (dead(2), TS2)):
        en = ents[e.url(pth)]
        if (en.get("source"), en.get("snapshot")) != ("wayback", ts): fail("%s: source=wayback snapshot=%s, thấy %s" % (pth, ts, en))
    before = e.man_bytes()
    e.og.hits.clear(); e.wb.reqs.clear()
    p = e.mirror(back, R)
    if p.returncode != 0 or e.og.hits or e.wb.total(): fail("lần 2 (mọi entry đã ok): không yêu cầu nào tới nguồn gốc hay Wayback, mã 0; thấy %d + %d, mã %s" % (len(e.og.hits), e.wb.total(), p.returncode))
    s = need_summary(p, "lần 2")
    if (s["reused"], s["new"], s.get("wayback")) != ("3", "0", "0"): fail("lần 2: reused=3 new=0 wayback=0, thấy %s" % s)
    if e.man()["entries"] != json.loads(before)["entries"]: fail("lần 2: entry ok (kể cả source/snapshot) không đổi")
    # nguồn gốc sống lại: entry ok qua Wayback vẫn không bị đổi
    e.set_pool(["/ok/small.png", "/ok/a1", "/ok/a2"])
finally:
    e.stop()

inv = os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images")
files = sorted(f for f in os.listdir(inv) if f[:4] == "inv-" and f.endswith(".py"))
if len(files) < 6: fail("thiếu bất biến trong bể: %s" % files)
envv = dict(os.environ, TOHONG_BACK_REPO=back)
for f in files:
    r = subprocess.run(["python3", "-I", os.path.join(inv, f)], capture_output=True, text=True, env=envv, cwd=back, timeout=400)
    if r.returncode != 0: fail("bất biến %s đỏ: %s" % (f, (r.stdout + r.stderr).strip()[-300:]))
ok("manifest giữ source/snapshot; entry ok cũ không hỏi lại; inv-001..006 xanh")
