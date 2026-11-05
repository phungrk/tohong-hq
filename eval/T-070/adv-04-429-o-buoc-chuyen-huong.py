#!/usr/bin/env python3
"""T-070 adv-04 (tầng 3): 429 rơi vào yêu cầu thứ hai (bản lưu sau chuyển hướng), spec T-069 mục 3, 13, 15.
Mong đợi: gửi lại CÙNG yêu cầu bản lưu (không quay về mốc 20261101000000), chờ theo Retry-After (1 giây), rồi entry ok snapshot=<mốc bản lưu>.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-070/adv-04-429-o-buoc-chuyen-huong.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-069", "lib"))
from t069 import *

back = need_back()
e = Env(["/ok/small.png", dead(1)])
try:
    e.wb.snaps[dead(1)] = ("img", GOOD[0], TS2)
    e.wb.pre = lambda n, path: (429, {"Retry-After": "1"}) if n == 2 else None
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("mã 0, thấy %s" % p.returncode)
    r = e.wb.of("wb")
    ts = [x["ts"] for x in r]
    if ts != [ENTRY_TS, TS2, TS2]: fail("chuỗi mốc yêu cầu phải là [%s, %s, %s], thấy %s" % (ENTRY_TS, TS2, TS2, ts))
    if r[2]["t"] - r[1]["t"] < 0.9: fail("phải chờ Retry-After 1 giây trước khi gửi lại, thấy %.2f giây" % (r[2]["t"] - r[1]["t"]))
    en = e.man()["entries"][e.url(dead(1))]
    if (en.get("status"), en.get("snapshot"), en.get("source")) != ("ok", TS2, "wayback"): fail("entry ok snapshot=%s source=wayback, thấy %s" % (TS2, en))
finally:
    e.stop()
ok("429 ở bước bản lưu: gửi lại đúng yêu cầu bản lưu sau Retry-After, entry ok snapshot đúng")
