#!/usr/bin/env python3
"""T-058 tiêu chí 4: 49 lỗi + 1 ok trong mẫu 50 đầu thì chạy tiếp bình thường (mã 0, ghi manifest, SUMMARY không có stopped=).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_4_chay_tiep.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

def case(paths, extra=None, hang=4):
    e = Env(paths, hang_secs=hang)
    try:
        p = e.mirror(back, extra)
        if p.returncode != 0: fail("có ok trong mẫu thì phải chạy tiếp và thoát 0, thấy %s; stdout cuối: %s" % (p.returncode, p.stdout[-200:]))
        s = summary_line(p.stdout)
        if not s or "stopped" in s or "reason" in s: fail("SUMMARY không được có stopped=/reason=: %s" % s)
        if kv(s)["total"] != str(len(paths)): fail("phải xử lý hết %d URL: %s" % (len(paths), s))
        if not os.path.exists(e.manifest): fail("chạy tiếp phải ghi manifest")
        return e, p
    except SystemExit:
        raise
    finally:
        e.stop()

bad = ["/forbid/%d" % i for i in range(49)]
tail = ["/ok/%d.png" % i for i in range(20)]
e, p = case(bad + ["/ok/first.png"] + tail)      # ok ở vị trí 50 (cuối mẫu) + 20 ok sau
s = kv(summary_line(p.stdout))
if (s["ok"], s["failed"]) != ("21", "49"): fail("ok=21 failed=49, thấy " + str(s))
e, p = case(["/ok/first.png"] + bad + tail)      # ok ở vị trí 1
s = kv(summary_line(p.stdout))
if (s["ok"], s["failed"]) != ("21", "49"): fail("ok đầu mẫu: ok=21 failed=49, thấy " + str(s))
# 49 URL treo + 1 ok: chạy tiếp, entry timeout ghi attempts=1 (không thử lại trong mẫu)
import json
e = Env(["/hang/%d" % i for i in range(49)] + ["/ok/first.png"] + tail, hang_secs=4)
try:
    p = e.mirror(back, ["--timeout", "1"])
    if p.returncode != 0: fail("49 timeout + ok: phải chạy tiếp, thoát 0, thấy %s" % p.returncode)
    ents = json.load(open(e.manifest, encoding="utf-8"))["entries"]
    t = [v for v in ents.values() if v.get("reason") == "timeout"]
    if len(t) != 49 or any(v.get("attempts") != 1 for v in t): fail("49 entry timeout phải có attempts=1: " + str(t[:2]))
finally:
    e.stop()
ok("có 1 ok trong mẫu thì chạy tiếp, ghi manifest, mã 0")
