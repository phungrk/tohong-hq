#!/usr/bin/env python3
"""T-058 tiêu chí 5: dưới 50 URL: tất cả lỗi thì dừng sớm (k = tổng); có 1 ok thì chạy tiếp.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_5_duoi_50.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

e = Env(["/forbid/%d" % i for i in range(7)])
try:
    pool0 = e.pool_bytes()
    p = e.mirror(back)
    need_stop(p, e, 7, "http-403", pool0, None)
finally:
    e.stop()
e = Env(["/forbid/%d" % i for i in range(6)] + ["/ok/0.png"])
try:
    p = e.mirror(back)
    if p.returncode != 0: fail("6 lỗi + 1 ok: phải chạy tiếp, thoát 0, thấy %s" % p.returncode)
    s = summary_line(p.stdout)
    if "stopped" in s or kv(s).get("ok") != "1" or kv(s).get("failed") != "6": fail("SUMMARY sai: %s" % s)
finally:
    e.stop()
e = Env(["/forbid/0"])
try:
    p = e.mirror(back)
    need_stop(p, e, 1, "http-403", e.pool_bytes(), None)
finally:
    e.stop()
ok("dưới 50 URL: xét toàn bộ")
