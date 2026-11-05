#!/usr/bin/env python3
"""T-069 tiêu chí 4: lỗi tạm thời của Wayback (429, 503, ngắt mạch, network, timeout, 403, 5xx) không tính là hỏng cho mẫu 50, không gây mã 4;
chỉ 'nguồn gốc hỏng và Wayback trả lời rõ là không có bản lưu' mới dừng sớm. Ngắt mạch kết thúc bằng mã 0, ghi manifest, SUMMARY có circuit=open (spec mục 9-12).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-069/check_3_dung_som.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t069 import *

back = need_back()
R = ["--retries", "0"]
paths60 = [dead(i) for i in range(60)]

# A. archive.org giới hạn 429 hoàn toàn, nguồn gốc chết: KHÔNG mã 4; ngắt mạch; mã 0; manifest ghi đủ; SUMMARY retry-later=60 circuit=open
e = Env(paths60)
try:
    e.wb.pre = lambda n, path: (429, {})
    p = e.mirror(back, R)
    if p.returncode != 0: fail("A: archive.org 429 không được gây mã thoát khác 0, thấy %s; stdout cuối: %s" % (p.returncode, p.stdout[-250:]))
    s = need_summary(p, "A")
    if "stopped" in s: fail("A: không được dừng sớm: %s" % s)
    if (s["total"], s["ok"], s["failed"], s.get("wayback"), s.get("retry-later"), s.get("circuit")) != ("60", "0", "60", "0", "60", "open"):
        fail("A: SUMMARY total=60 ok=0 failed=60 wayback=0 retry-later=60 circuit=open, thấy %s" % s)
    ents = e.man()["entries"]
    if len(ents) != 60 or any(en.get("status") != "failed" or "wayback" not in en for en in ents.values()): fail("A: manifest phải ghi 60 entry failed, mỗi entry có wayback")
    if len({r["path"] for r in e.wb.of("wb")}) != 5: fail("A: sau 5 URL liên tiếp lỗi tạm thì ngắt mạch, không hỏi thêm")
    A_manifest = e.manifest; A_env = e
    # E. archive.org hồi phục, cùng manifest: entry đã có wayback ra khỏi mẫu, lần chạy hai ra mã 0 và cứu được ảnh
    e.wb.pre = None; e.wb.reqs.clear(); e.wb.snaps = {x: GOOD for x in paths60}
    p = e.mirror(back, R)
    if p.returncode != 0: fail("E: chạy lại sau khi Wayback hồi phục phải mã 0, thấy %s; %s" % (p.returncode, p.stdout[-250:]))
    s = need_summary(p, "E")
    if (s["ok"], s["failed"], s.get("wayback"), s.get("retry-later")) != ("60", "0", "60", "0") or "circuit" in s: fail("E: lần hai ok=60 failed=0 wayback=60 retry-later=0 không circuit; thấy %s" % s)
finally:
    e.stop()

# B. mẫu 50 đều: nguồn gốc 522 và Wayback trả lời rõ 'không có bản lưu' -> dừng sớm mã 4, không ghi manifest, không hỏi URL 51+
e = Env(paths60)
try:
    p = e.mirror(back, R)
    if p.returncode != 4: fail("B: nguồn chết + Wayback nói rõ không có bản lưu cho cả mẫu 50 phải mã 4, thấy %s" % p.returncode)
    s = need_summary(p, "B")
    if s.get("stopped") != "early" or not s.get("reason", "").endswith("-50/50"): fail("B: SUMMARY stopped=early reason=…-50/50, thấy %s" % s)
    if e.man_bytes() is not None: fail("B: mã 4 không ghi manifest")
    if any(int(r["path"].split("/")[-1]) >= 50 for r in e.wb.of("wb")): fail("B: URL thứ 51+ không được hỏi Wayback")
finally:
    e.stop()

# C. 49 'không có bản lưu' rõ + 1 URL bị 429: mẫu chưa kết luận được -> KHÔNG dừng sớm (mã 0)
e = Env(paths60)
try:
    e.wb.pre = lambda n, path: (429, {}) if path == dead(25) else None
    p = e.mirror(back, R)
    if p.returncode != 0: fail("C: một URL bị 429 trong mẫu thì mẫu không kết luận, mã 0; thấy %s; %s" % (p.returncode, p.stdout[-250:]))
    if "stopped" in need_summary(p, "C"): fail("C: không dừng sớm")
    if e.man()["entries"][e.url(dead(25))].get("wayback") != "rate-limited": fail("C: URL 25 wayback=rate-limited")
finally:
    e.stop()

# D. mẫu đều bị Wayback ngắt kết nối / 503 lẫn lộn: không mã 4
e = Env(paths60)
try:
    e.wb.pre = lambda n, path: (503, {"Retry-After": "0"}) if int(path.split("/")[-1]) % 2 else ("reset",)
    p = e.mirror(back, R)
    if p.returncode != 0: fail("D: lỗi network/503 của Wayback không được gây mã 4, thấy %s" % p.returncode)
finally:
    e.stop()

# F. một URL được Wayback cứu trong mẫu thì không bao giờ dừng sớm (49 'none' + 1 ảnh)
e = Env(paths60)
try:
    e.wb.snaps = {dead(49): GOOD}
    p = e.mirror(back, R)
    s = need_summary(p, "F")
    if p.returncode != 0 or s.get("wayback") != "1" or "stopped" in s: fail("F: 49 none + 1 ảnh qua Wayback: mã 0 wayback=1 không stopped; thấy %s mã %s" % (s, p.returncode))
finally:
    e.stop()
ok("429/503/network/ngắt mạch của Wayback không gây mã 4 (mã 0, manifest ghi, circuit=open); 50/50 'không bản lưu' vẫn mã 4; chạy lại sau hồi phục mã 0")
