#!/usr/bin/env python3
"""T-069 tiêu chí 3: dòng FAILED ghi thêm `wayback=<lý do>` và entry failed có trường `wayback` (spec mục 7-8):
none, rate-limited, circuit-open, network, not-image, too-large, http-<mã>. Không hỏi Wayback thì không có hậu tố.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-069/check_2_ly_do.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t069 import *

back = need_back()
# (tên, snap, hàm ép lỗi, wayback mong đợi, thêm tham số)
always = lambda code, hdr=None: (lambda n, path: (code, hdr or {}) if path == dead(1) else None)
cases = [
    ("không bản lưu", None, None, "none", []),
    ("429 mãi", ("img", GOOD[0], TS), always(429), "rate-limited", []),
    ("503 kèm Retry-After", ("img", GOOD[0], TS), always(503, {"Retry-After": "0"}), "rate-limited", []),
    ("ngắt kết nối", ("reset",), None, "network", []),
    ("treo quá --timeout", ("img", GOOD[0], TS), lambda n, path: ("hang", 4) if path == dead(1) else None, "network", ["--timeout", "1"]),
    ("bản lưu là HTML", ("html", TS), None, "not-image", []),
    ("403", ("img", GOOD[0], TS), always(403), "http-403", []),
    ("502", ("img", GOOD[0], TS), always(502), "http-502", []),
    ("bản lưu mã 410", ("status", 410), None, "http-410", []),
]
for name, sp, pre, want, extra in cases:
    e = Env(["/ok/small.png", dead(1)])
    try:
        if sp is not None: e.wb.snaps[dead(1)] = sp
        e.wb.pre = pre
        p = e.mirror(back, ["--retries", "0"] + extra)
        if p.returncode != 0: fail("%s: mã thoát 0 (mẫu có URL ok), thấy %s; stderr %s" % (name, p.returncode, p.stderr[-200:]))
        u = e.url(dead(1)); en = e.man()["entries"][u]
        if (en.get("status"), en.get("reason"), en.get("wayback")) != ("failed", "http-522", want): fail("%s: entry phải failed reason=http-522 wayback=%s, thấy %s" % (name, want, en))
        fl = failed_line(p, u)
        if fl != "FAILED %s http-522 wayback=%s" % (u, want): fail("%s: dòng phải là 'FAILED <URL> http-522 wayback=%s', thấy %r" % (name, want, fl))
        if e.wb.of("avail"): fail("%s: không được gọi availability" % name)
    finally:
        e.stop()

# circuit-open: sau 5 URL liên tiếp kết thúc vì lỗi tạm thời của Wayback, URL còn lại không có yêu cầu nào và mang wayback=circuit-open
paths = [dead(i) for i in range(8)]
e = Env(["/ok/small.png"] + paths)
try:
    e.wb.pre = lambda n, path: (429, {})
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("circuit-open: mã thoát 0, thấy %s" % p.returncode)
    ents = e.man()["entries"]
    got = [ents[e.url(x)].get("wayback") for x in paths]
    if got != ["rate-limited"] * 5 + ["circuit-open"] * 3: fail("5 URL đầu rate-limited, 3 URL sau circuit-open; thấy %s" % got)
    if failed_line(p, e.url(paths[7])) != "FAILED %s http-522 wayback=circuit-open" % e.url(paths[7]): fail("dòng FAILED circuit-open: %r" % failed_line(p, e.url(paths[7])))
    if len({r["path"] for r in e.wb.of("wb")}) != 5: fail("sau ngắt mạch không còn yêu cầu nào tới Wayback; URL đã hỏi: %s" % sorted({r['path'] for r in e.wb.of('wb')}))
finally:
    e.stop()

# URL có kết quả khác (ok, hoặc 404 rõ) đặt lại bộ đếm ngắt mạch: 4 lỗi tạm, 1 none, 4 lỗi tạm -> chưa ngắt mạch
paths = [dead(i) for i in range(9)]
e = Env(["/ok/small.png"] + paths)
try:
    e.wb.snaps = {dead(4): None}
    e.wb.pre = lambda n, path: None if path == dead(4) else (429, {})
    p = e.mirror(back, ["--retries", "0"])
    ents = e.man()["entries"]; got = [ents[e.url(x)].get("wayback") for x in paths]
    if "circuit-open" in got: fail("1 kết quả khác ở giữa phải đặt lại bộ đếm, nhưng thấy circuit-open: %s" % got)
finally:
    e.stop()

# không hỏi Wayback thì không có hậu tố: nguồn gốc too-large (không hỏi); hoặc chạy không cờ
e = Env(["/ok/small.png", "/huge/1", "/gone/2"])
try:
    p = e.mirror(back, ["--retries", "0"])
    fl = failed_line(p, e.url("/huge/1"))
    if fl != "FAILED %s too-large" % e.url("/huge/1"): fail("too-large không hỏi Wayback nên dòng là 'FAILED <URL> too-large' không hậu tố, thấy %r" % fl)
    if "wayback" in e.man()["entries"][e.url("/huge/1")]: fail("entry too-large không có trường wayback")
    os.remove(e.manifest)
    p2 = e.mirror(back, ["--retries", "0"], wayback=False)
    fl2 = failed_line(p2, e.url("/gone/2"))
    if fl2 != "FAILED %s http-404" % e.url("/gone/2"): fail("không cờ: dòng FAILED giữ khuôn cũ, thấy %r" % fl2)
finally:
    e.stop()
ok("FAILED ghi wayback=<lý do> cho none, rate-limited, circuit-open, network, not-image, http-xxx; không hỏi thì không có hậu tố")
