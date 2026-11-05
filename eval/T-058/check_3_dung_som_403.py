#!/usr/bin/env python3
"""T-058 tiêu chí 3: 50/50 lỗi 403 dừng sớm (mã 4, reason http-403-50/50); hỗn hợp lý do -> mixed; 50 lỗi rồi ok thứ 51 vẫn dừng và URL 51 không bị gọi.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_3_dung_som_403.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

def case(paths, code, extra=None):
    e = Env(paths)
    try:
        pool0 = e.pool_bytes()
        t = time.time(); p = e.mirror(back, extra); secs = time.time() - t
        d, pl = need_stop(p, e, 50, code, pool0, None)
        if secs > 15: fail("dừng sớm 403 mất %.1f giây" % secs)
        if pl[-1][4] != ({"http-403": 50} if code == "http-403" else pl[-1][4]): fail("PROGRESS cuối sai: " + pl[-1][5])
        fl = [l for l in p.stdout.splitlines() if l.startswith("FAILED ")]
        if len(fl) != 50: fail("phải có 50 dòng FAILED, thấy %d" % len(fl))
        return e.fk.paths_hit()
    finally:
        e.stop()

hits = case(["/forbid/%d" % i for i in range(50)], "http-403")
hits = case(["/forbid/%d" % i for i in range(50)] + ["/ok/%d.png" % i for i in range(20)], "http-403")
if any(p.startswith("/ok/") for p in hits): fail("ok thứ 51 trở đi đã bị gọi: không được gửi yêu cầu URL thứ 51 trước khi mẫu có kết quả")
case(["/forbid/%d" % i for i in range(25)] + ["/nope/%d" % i for i in range(25)], "mixed")
ok("50/50 lỗi 403 và hỗn hợp dừng sớm với mã 4 và reason đúng")
