#!/usr/bin/env python3
"""T-069 tiêu chí 5: giới hạn tốc độ tới archive.org mặc định 1 yêu cầu/2 giây (sàn 1 yêu cầu/giây), tính cả chuyển hướng, một URL một lúc; 429/503 lùi theo Retry-After
hoặc 2/4/8 giây (nhân với --wayback-backoff), tối đa 3 lần thử lại; tham số hạ tốc độ bị từ chối mã 2 (spec mục 13-17).
Chạy (mất khoảng 40-60 giây): cd /home/user/tohong-hq && python3 -I eval/T-069/check_4_toc_do.py"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t069 import *

back = need_back()
R = ["--retries", "0"]

def gaps(reqs): return [b["t"] - a["t"] for a, b in zip(reqs, reqs[1:])]

# A. tốc độ mặc định (không truyền --wayback-interval): >= 2 giây giữa hai yêu cầu bắt đầu, kể cả yêu cầu chuyển hướng; mỗi lúc một yêu cầu dù --workers 4
paths = [dead(i) for i in range(3)]
e = Env(paths)
try:
    e.wb.snaps = {x: GOOD for x in paths}
    p = e.mirror(back, R + ["--workers", "4"], fast=False, timeout=120)
    if p.returncode != 0: fail("A: mã 0, thấy %s; %s" % (p.returncode, p.stdout[-200:]))
    ws = e.wb.of("wb")
    if len(ws) != 6: fail("A: 3 URL x 2 yêu cầu (mốc + chuyển hướng) = 6, thấy %d" % len(ws))
    g = gaps(ws)
    if min(g) < 1.9: fail("A: mặc định hai yêu cầu cách nhau >= 2 giây, thấy khoảng nhỏ nhất %.2f giây" % min(g))
    if max(g) > 6: fail("A: khoảng cách lớn bất thường %.1f giây" % max(g))
    if e.wb.max_cur > 1: fail("A: %d yêu cầu Wayback cùng lúc" % e.wb.max_cur)
    if e.wb.of("avail"): fail("A: không gọi availability")
finally:
    e.stop()

# B. giãn cách tính cả chuyển hướng trung gian (interval 400 ms)
e = Env([dead(0)])
try:
    e.wb.snaps = {dead(0): ("hops", 3, TS)}
    c = e.cmd(back, R, fast=False) + ["--wayback-interval", "400", "--wayback-backoff", "100"]
    p = run(c, timeout=60)
    ws = e.wb.of("wb")
    if len(ws) != 5: fail("B: 1 mốc + 3 trung gian + 1 bản lưu = 5 yêu cầu, thấy %d" % len(ws))
    if min(gaps(ws)) < 0.36: fail("B: chuyển hướng cũng chịu giãn cách 400 ms, thấy %.2f giây" % min(gaps(ws)))
finally:
    e.stop()

# C. 429 kèm Retry-After: 1 -> chờ >= 1 giây rồi gửi lại cùng yêu cầu; sau đó thành công
e = Env(["/ok/small.png", dead(1)])
try:
    e.wb.snaps = {dead(1): GOOD}
    e.wb.pre = lambda n, path: (429, {"Retry-After": "1"}) if (path == dead(1) and n <= 2) else None
    p = e.mirror(back, R)
    ws = e.wb.of("wb")
    if p.returncode != 0 or e.man()["entries"][e.url(dead(1))].get("source") != "wayback": fail("C: sau 2 lần 429 rồi thành công thì ảnh phải ok qua Wayback; %s" % p.stdout[-200:])
    g = gaps(ws)
    if g[0] < 0.95 or g[1] < 0.95: fail("C: sau 429 kèm Retry-After: 1 phải chờ >= 1 giây, thấy %s" % [round(x, 2) for x in g[:2]])
    if ws[0]["raw"] != ws[1]["raw"] or ws[1]["raw"] != ws[2]["raw"]: fail("C: thử lại phải là cùng yêu cầu")
finally:
    e.stop()

# D. 429 không Retry-After: lùi gấp đôi (backoff 100 -> 100, 200, 400 ms); đúng 4 yêu cầu rồi bỏ cuộc (3 lần thử lại)
e = Env(["/ok/small.png", dead(1)])
try:
    e.wb.snaps = {dead(1): GOOD}
    e.wb.pre = lambda n, path: (429, {}) if path == dead(1) else None
    p = e.mirror(back, R)
    ws = e.wb.of("wb")
    if len(ws) != 4: fail("D: 1 + 3 lần thử lại = đúng 4 yêu cầu, thấy %d" % len(ws))
    g = gaps(ws)
    for got, want in zip(g, (0.09, 0.19, 0.39)):
        if got < want: fail("D: lùi 100/200/400 ms (nhân đôi mỗi lần), khoảng thấy %s" % [round(x, 3) for x in g])
    if e.man()["entries"][e.url(dead(1))].get("wayback") != "rate-limited": fail("D: hết lần thử thì wayback=rate-limited")
finally:
    e.stop()

# E. từ chối tham số hạ tốc độ (mã 2, một dòng trên stderr nêu tên tham số, không ghi manifest, không yêu cầu mạng)
e = Env([dead(0)])
try:
    base = cli(back) + ["mirror", "--pool", e.pool, "--manifest", e.manifest, "--out", e.out, "--base-url", BASE_URL]
    tries = [("--wayback-", base + ["--wayback-base", e.wb.base, "--wayback-interval", "500"], False),
             ("--wayback-interval", base + ["--fallback", "wayback", "--wayback-base", "http://web.example.invalid", "--wayback-interval", "500"], True),
             ("--wayback-backoff", base + ["--fallback", "wayback", "--wayback-base", "http://web.example.invalid", "--wayback-backoff", "1000"], True)]
    for name, c, _ in tries:
        p = run(c, timeout=30)
        if p.returncode != 2: fail("E: %s phải bị từ chối mã 2, thấy %s" % (c[-2:], p.returncode))
        if name not in p.stderr: fail("E: stderr phải nêu %s, thấy %r" % (name, p.stderr[-150:]))
    if e.man_bytes() is not None or e.og.hits: fail("E: bị từ chối thì không ghi manifest, không yêu cầu nào")
finally:
    e.stop()
ok("mặc định >= 2 giây giữa hai yêu cầu (kể cả chuyển hướng), một lúc một yêu cầu; 429 lùi theo Retry-After hoặc nhân đôi, tối đa 3 lần thử lại; sàn tốc độ")
