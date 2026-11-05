#!/usr/bin/env python3
"""T-070 adv-03 (tầng 3): bộ đếm ngắt mạch (spec T-069 mục 11) với các kết luận rõ khác 'none', và ngắt mạch khi nguồn gốc chết.
  A. --workers 1, thứ tự hỏi: 4x429, http-410 (bản lưu mã 410), 4x429, chuyển hướng sang host lạ (http-302), 4x429, ảnh ok, 4x lỗi tạm
     -> các kết luận rõ (410, 302, ok) đặt bộ đếm về 0: KHÔNG ngắt mạch, không URL nào circuit-open.
  B. 5 lỗi tạm khác loại liên tiếp (403, 502, ngắt kết nối, treo quá --timeout, 503 hết lần thử) -> ngắt mạch; URL sau là circuit-open, không yêu cầu.
  C. 120 URL, nguồn chết, archive.org 429 hoàn toàn: mã 0, chỉ 5 URL được hỏi Wayback, URL sau mẫu nguồn là origin-skipped
     không chạm nguồn gốc, dòng 'FAILED <URL> origin-skipped wayback=circuit-open', SUMMARY retry-later=120 circuit=open.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-070/adv-03-ngat-mach-dat-lai-va-nguon-chet.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-069", "lib"))
from t069 import *

back = need_back()

# A
paths = [dead(i) for i in range(19)]
e = Env(["/ok/small.png"] + paths)
try:
    e.wb.snaps = {dead(4): ("status", 410), dead(9): ("foreign",), dead(14): ("img", GOOD[0], TS)}
    e.wb.pre = lambda n, path: None if path in (dead(4), dead(9), dead(14)) else (429, {})
    p = e.mirror(back, ["--retries", "0", "--workers", "1"])
    if p.returncode != 0: fail("A: mã 0, thấy %s" % p.returncode)
    s = need_summary(p, "A")
    ents = e.man()["entries"]; got = [ents[e.url(x)].get("wayback", ents[e.url(x)].get("status")) for x in paths]
    want = ["rate-limited"] * 4 + ["http-410"] + ["rate-limited"] * 4 + ["http-302"] + ["rate-limited"] * 4 + ["ok"] + ["rate-limited"] * 4
    if got != want: fail("A: kết luận rõ 410/302/ok phải đặt lại bộ đếm; mong %s, thấy %s" % (want, got))
    if "circuit" in s: fail("A: không được ngắt mạch: %s" % s)
finally:
    e.stop()

# B
paths = [dead(i) for i in range(8)]
e = Env(["/ok/small.png"] + paths)
try:
    e.wb.snaps = {x: ("img", GOOD[0], TS) for x in paths}
    plan = {dead(0): (403, {}), dead(1): (502, {}), dead(2): ("reset",), dead(3): ("hang", 4), dead(4): (503, {"Retry-After": "0"})}
    e.wb.pre = lambda n, path: plan.get(path)
    p = e.mirror(back, ["--retries", "0", "--workers", "1", "--timeout", "1"])
    if p.returncode != 0: fail("B: mã 0, thấy %s" % p.returncode)
    ents = e.man()["entries"]; got = [ents[e.url(x)].get("wayback") for x in paths]
    want = ["http-403", "http-502", "network", "network", "rate-limited", "circuit-open", "circuit-open", "circuit-open"]
    if got != want: fail("B: mong %s, thấy %s" % (want, got))
    asked = {r["path"] for r in e.wb.of("wb")}
    if asked & {dead(5), dead(6), dead(7)}: fail("B: sau ngắt mạch không được hỏi Wayback, thấy %s" % sorted(asked))
    if need_summary(p, "B").get("circuit") != "open": fail("B: SUMMARY circuit=open")
finally:
    e.stop()

# C
paths = [dead(i) for i in range(120)]
e = Env(paths)
try:
    e.wb.pre = lambda n, path: (429, {})
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("C: mã 0, thấy %s; %s" % (p.returncode, p.stdout[-300:]))
    s = need_summary(p, "C")
    if (s.get("failed"), s.get("retry-later"), s.get("circuit")) != ("120", "120", "open") or "stopped" in s: fail("C: SUMMARY failed=120 retry-later=120 circuit=open, thấy %s" % s)
    if len({r["path"] for r in e.wb.of("wb")}) != 5: fail("C: chỉ 5 URL được hỏi Wayback")
    if any(e.og.count(dead(i)) for i in range(50, 120)): fail("C: URL sau mẫu nguồn không được chạm nguồn gốc khi nguồn chết")
    u = e.url(dead(100))
    if failed_line(p, u) != "FAILED %s origin-skipped wayback=circuit-open" % u: fail("C: dòng FAILED của dead/100: %r" % failed_line(p, u))
    if len(e.man()["entries"]) != 120: fail("C: manifest phải có 120 entry")
finally:
    e.stop()
ok("ngắt mạch: 410/302/ok đặt lại bộ đếm; 5 lỗi tạm khác loại ngắt mạch; nguồn chết + 429 hoàn toàn -> mã 0, 5 URL hỏi, origin-skipped wayback=circuit-open")
