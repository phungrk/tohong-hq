#!/usr/bin/env python3
"""T-065 tiêu chí 3: giới hạn tốc độ tới archive.org: mặc định <= 1 yêu cầu/giây, 1 yêu cầu tại một thời điểm (kể cả khi --workers 4), User-Agent tự nhận,
429/503 thì lùi (Retry-After nếu có, nếu không thì gấp đôi), thử lại tối đa 3 lần, 5 URL liên tiếp hết lần thử thì ngắt mạch (spec mục 7-10).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_3_toc_do.py --back /home/user/tohong-back"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import *

back = need_back()
def gaps(reqs): return [b["t"] - a["t"] for a, b in zip(reqs, reqs[1:])]

# A. tốc độ mặc định (không truyền --wayback-interval): 4 URL có bản lưu = 8 yêu cầu, 4 luồng
paths = ["/ok/live.png"] + ["/gone/%d.png" % i for i in range(4)]
e = Env(paths)
try:
    e.wb.snaps = {"/gone/%d.png" % i: GOOD for i in range(4)}
    p = e.mirror(back, ["--workers", "4", "--retries", "0"], fast=False)
    if p.returncode != 0: fail("mã thoát %s; stderr %s" % (p.returncode, p.stderr[-200:]))
    if need_summary(p, "A").get("wayback") != "4": fail("4 ảnh khôi phục: wayback=4")
    reqs = sorted(e.wb.reqs, key=lambda r: r["t"])
    if len(reqs) != 8: fail("4 URL x (availability + raw) = 8 yêu cầu, thấy %d" % len(reqs))
    if e.wb.max_cur > 1: fail("tại một thời điểm chỉ một yêu cầu tới archive.org, thấy %d song song" % e.wb.max_cur)
    if min(gaps(reqs)) < 0.9: fail("mặc định không quá 1 yêu cầu/giây: hai yêu cầu cách nhau %.2f giây" % min(gaps(reqs)))
    # mỗi URL: availability rồi raw của chính nó liền nhau (mỗi lần chỉ một URL được hỏi Wayback)
    for i in range(0, 8, 2):
        if reqs[i]["kind"] != "avail" or reqs[i + 1]["kind"] != "raw" or reqs[i]["path"] != reqs[i + 1]["path"]: fail("mỗi lần chỉ một URL được hỏi Wayback: availability rồi raw của cùng URL, không xen kẽ: " + str([(r["kind"], r["path"]) for r in reqs]))
finally:
    e.stop()

# B. Retry-After
e = Env(["/ok/live.png", "/gone/a.png"])
try:
    e.wb.snaps = {"/gone/a.png": GOOD}
    e.wb.pre = lambda kind, n, path: (429, {"Retry-After": "3"}) if (kind == "avail" and n == 1) else None
    p = e.mirror(back, ["--retries", "0"])
    reqs = sorted(e.wb.reqs, key=lambda r: r["t"])
    if len(reqs) < 3: fail("429 phải thử lại cùng URL, chỉ thấy %d yêu cầu" % len(reqs))
    if gaps(reqs)[0] < 2.9: fail("429 kèm Retry-After: 3 thì chờ >= 3 giây rồi mới gửi lại, chờ %.2f giây" % gaps(reqs)[0])
    en = e.man()["entries"][e.url("/gone/a.png")]
    if en.get("status") != "ok": fail("sau 429 rồi 200 thì vẫn khôi phục được: %s" % en)
finally:
    e.stop()

# C. 503 không có Retry-After: lùi gấp đôi (--wayback-backoff 100: 100, 200, 400 ms; nền --wayback-interval 30), thử lại tối đa 3 lần; hết thì lỗi
e = Env(["/ok/live.png", "/gone/a.png"])
try:
    e.wb.snaps = {"/gone/a.png": GOOD}
    e.wb.pre = lambda kind, n, path: (503, {}) if kind == "avail" else None
    p = e.mirror(back, ["--retries", "0"])
    reqs = sorted(e.wb.of("avail"), key=lambda r: r["t"])
    if len(reqs) != 4: fail("503 mãi: 1 lần đầu + 3 lần thử lại = 4 yêu cầu, thấy %d" % len(reqs))
    g = gaps(reqs)
    if g[0] < 0.09 or g[1] < 0.19 or g[2] < 0.39: fail("lùi gấp đôi 100/200/400 ms, thấy %s" % [round(x, 3) for x in g])
    if g[2] < g[0] * 2 or g[2] > 3: fail("khoảng lùi phải tăng dần: %s" % [round(x, 3) for x in g])
    en = e.man()["entries"][e.url("/gone/a.png")]
    if en.get("status") != "failed" or en.get("reason") != "http-404" or en.get("wayback") != "http-503": fail("hết lần thử: failed (lý do nguồn gốc), wayback=http-503, thấy %s" % en)
    if need_summary(p, "C").get("wayback") != "0": fail("wayback=0")
finally:
    e.stop()

# D. ngắt mạch: 429 mãi, 1 ảnh tốt + 9 URL hỏng: đúng 5 URL x 4 yêu cầu = 20, 4 URL sau không có yêu cầu nào
paths = ["/ok/live.png"] + ["/gone/%d.png" % i for i in range(9)]
e = Env(paths)
try:
    e.wb.snaps = {"/gone/%d.png" % i: GOOD for i in range(9)}
    e.wb.pre = lambda kind, n, path: (429, {})
    p = e.mirror(back, ["--retries", "0", "--workers", "4"])
    if p.returncode != 0: fail("ngắt mạch không làm mirror đỏ: mã %s" % p.returncode)
    if e.wb.total() != 20: fail("5 URL liên tiếp hết lần thử (mỗi URL 4 yêu cầu) thì ngắt mạch: đúng 20 yêu cầu, thấy %d" % e.wb.total())
    ents = e.man()["entries"]
    got = [ents[e.url("/gone/%d.png" % i)].get("wayback") for i in range(9)]
    if got.count("http-429") != 5 or got.count("circuit-open") != 4: fail("5 URL wayback=http-429, 4 URL wayback=circuit-open, thấy %s" % got)
    if any(ents[e.url("/gone/%d.png" % i)].get("status") != "failed" for i in range(9)): fail("mọi URL đó là failed (thử lại ở lần chạy sau)")
finally:
    e.stop()

# E. 429 xen kẽ thành công thì không ngắt mạch (bộ đếm đặt lại khi một URL xong bằng cách khác)
paths = ["/ok/live.png"] + ["/gone/%d.png" % i for i in range(12)]
e = Env(paths)
try:
    e.wb.snaps = {"/gone/%d.png" % i: GOOD for i in range(12)}
    bad = {"/gone/%d.png" % i for i in (0, 1, 2, 3, 5, 6, 7, 8, 10)}   # 4 hỏng, tốt, 4 hỏng, tốt, 1 hỏng, tốt: không bao giờ 5 liên tiếp
    e.wb.pre = lambda kind, n, path: (429, {}) if path in bad else None
    p = e.mirror(back, ["--retries", "0", "--workers", "1"])
    ents = e.man()["entries"]
    okc = [i for i in range(12) if ents[e.url("/gone/%d.png" % i)].get("status") == "ok"]
    if okc != [4, 9, 11]: fail("URL 4, 9, 11 có bản lưu, các URL khác 429: chỉ 4, 9, 11 thành ok (ngắt mạch chỉ khi 5 URL LIÊN TIẾP hết lần thử), thấy %s" % okc)
finally:
    e.stop()
# F. ngắt mạch đếm cả timeout / lỗi mạng tới archive.org (không chỉ 429/503): Wayback treo 5 URL liên tiếp thì URL thứ 6 trở đi không có yêu cầu nào
paths = ["/ok/live.png"] + ["/gone/%d.png" % i for i in range(8)]
e = Env(paths)
try:
    e.wb.snaps = {"/gone/%d.png" % i: GOOD for i in range(8)}
    e.wb.pre = lambda kind, n, path: ("hang", 3)
    p = e.mirror(back, ["--retries", "0", "--workers", "1", "--timeout", "1"])
    if p.returncode != 0: fail("mã 0, thấy %s" % p.returncode)
    if e.wb.total() != 5: fail("5 URL liên tiếp timeout tới archive.org thì ngắt mạch: đúng 5 yêu cầu (mỗi URL 1, timeout không thử lại), thấy %d" % e.wb.total())
    got = [e.man()["entries"][e.url("/gone/%d.png" % i)].get("wayback") for i in range(8)]
    if got != ["timeout"] * 5 + ["circuit-open"] * 3: fail("5 URL wayback=timeout rồi 3 URL wayback=circuit-open, thấy %s" % got)
finally:
    e.stop()
ok("tốc độ <= 1 yêu cầu/giây, 1 yêu cầu một lúc, UA tự nhận, lùi theo Retry-After / gấp đôi, tối đa 3 lần thử lại, ngắt mạch sau 5 URL liên tiếp")
