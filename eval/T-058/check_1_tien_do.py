#!/usr/bin/env python3
"""T-058 tiêu chí 1: dòng PROGRESS đúng khuôn, in ở done=100,200,... và một dòng cuối (không trùng done), số liệu lý do đúng, tới ngay khi xảy ra.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_1_tien_do.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

def run_case(paths, extra=None):
    e = Env(paths)
    try:
        pr, lines, secs = e.stream(back, extra)
        return pr, lines, secs, e
    finally:
        e.stop()

# A. 250 URL: 225 ok, 20 lỗi 403, 5 lỗi 404 (đường dẫn lạ). Nhịp 100, 200, 250.
paths = ["/ok/%d.png" % i for i in range(60)] + ["/forbid/%d" % i for i in range(20)] + ["/nope/%d" % i for i in range(5)] + ["/ok/%d.png" % i for i in range(60, 225)]
pr, lines, secs, e = run_case(paths)
if pr.returncode != 0: fail("250 URL, 25 lỗi thì mirror phải thoát 0, thấy %s" % pr.returncode)
texts = [l for _, l in lines]
pl = progress_lines(texts)
if [x[0] for x in pl] != [100, 200, 250]: fail("done phải lần lượt 100, 200, 250, thấy %s" % [x[0] for x in pl])
if any(x[1] != 250 for x in pl): fail("total phải = 250 ở mọi dòng PROGRESS")
last = pl[-1]
if (last[2], last[3]) != (225, 25): fail("dòng cuối phải ok=225 failed=25, thấy %s" % last[5])
if last[4] != {"http-403": 20, "http-404": 5}: fail("lý do dòng cuối sai: %s" % last[5])
if not last[5].endswith("(http-403=20, http-404=5)"): fail("lý do phải xếp tên tăng dần, phân cách ', ': " + last[5])
s = summary_line("\n".join(texts))
if not s or kv(s).get("ok") != "225" or kv(s).get("failed") != "25": fail("SUMMARY lệch PROGRESS cuối: %s" % s)
if texts.index(last[5]) > texts.index(s): fail("PROGRESS cuối phải nằm trước SUMMARY")

# B. đúng 200 URL tốt: chỉ hai dòng (100, 200), không có dòng thứ ba trùng done=200; ngoặc là (none)
pr, lines, secs, e = run_case(["/ok/%d.png" % i for i in range(200)])
pl = progress_lines([l for _, l in lines])
if [x[0] for x in pl] != [100, 200]: fail("200 URL: done phải 100, 200, thấy %s" % [x[0] for x in pl])
if not pl[0][5].endswith("(none)"): fail("không lỗi thì ngoặc là (none): " + pl[0][5])

# C. dòng tới ngay khi xảy ra: 100 URL nhanh rồi 12 URL chậm (0,6 giây, 4 luồng ≈ 1,8 giây); done=100 phải tới trước dòng cuối ít nhất 1 giây
pr, lines, secs, e = run_case(["/ok/%d.png" % i for i in range(100)] + ["/slow/%d" % i for i in range(12)])
tp = [(t, l) for t, l in lines if l.startswith("PROGRESS")]
pl = progress_lines([l for _, l in tp])
if [x[0] for x in pl] != [100, 112]: fail("112 URL: done phải 100, 112, thấy %s" % [x[0] for x in pl])
if tp[1][0] - tp[0][0] < 1.0: fail("dòng done=100 tới chỉ %.2f giây trước dòng cuối: phải được ghi ngay (không đệm tới cuối)" % (tp[1][0] - tp[0][0]))
# D. tổng 0 và tổng nhỏ: một dòng cuối
for n, want in ((0, [0]), (30, [30])):
    pr, lines, secs, e = run_case(["/ok/%d.png" % i for i in range(n)])
    got = [x[0] for x in progress_lines([l for _, l in lines])]
    if got != want: fail("tổng %d: done phải %s, thấy %s" % (n, want, got))
ok("PROGRESS đúng khuôn, nhịp 100, dòng cuối, ghi ngay")
