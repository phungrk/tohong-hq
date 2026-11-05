#!/usr/bin/env python3
"""T-070 adv-01 (tầng 3): mẫu dừng sớm có URL bị bỏ qua nguồn gốc (origin-skipped), spec T-069 mục 10 (b)-(d).
Dựng: manifest có 10 entry failed reason=http-404 (không phải ứng viên mẫu nhưng vẫn ở mẫu nguồn), nên mẫu 50 = dead/10..59,
mẫu nguồn = dead/0..49; nguồn chết -> dead/50..59 thành origin-skipped -> ra khỏi mẫu.
  X. Wayback 'none' cho tất cả: 40 URL còn trong mẫu đều (d) -> mã 4, không ghi đè manifest.
  Y. Như X nhưng một URL còn trong mẫu (dead/30) bị 429: (c) -> không dừng sớm, mã 0.
  Z. Như X nhưng Wayback có ảnh cho một URL origin-skipped (dead/55): (a) -> không dừng sớm, mã 0, entry ok source=wayback.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-070/adv-01-mau-co-origin-skipped.py"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-069", "lib"))
from t069 import *

back = need_back()
paths = [dead(i) for i in range(70)]

def setup(e):
    ents = {e.url(dead(i)): {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 1} for i in range(10)}
    json.dump({"version": 1, "baseUrl": BASE_URL, "entries": ents}, open(e.manifest, "w", encoding="utf-8"))
    return open(e.manifest, "rb").read()

# X
e = Env(paths)
try:
    before = setup(e)
    p = e.mirror(back, ["--retries", "0"])
    s = need_summary(p, "X")
    if p.returncode != 4: fail("X: 40 URL còn trong mẫu đều 'nguồn hỏng + không bản lưu' phải mã 4, thấy %s; %s" % (p.returncode, s))
    if e.man_bytes() != before: fail("X: mã 4 không được đổi manifest")
finally:
    e.stop()

# Y
e = Env(paths)
try:
    setup(e)
    e.wb.pre = lambda n, path: (429, {}) if path == dead(30) else None
    p = e.mirror(back, ["--retries", "0"])
    s = need_summary(p, "Y")
    if p.returncode != 0 or "stopped" in s: fail("Y: một URL trong mẫu bị 429 thì mẫu chưa kết luận, mã 0; thấy mã %s %s" % (p.returncode, s))
    en = e.man()["entries"][e.url(dead(30))]
    if en.get("wayback") != "rate-limited": fail("Y: dead/30 wayback=rate-limited, thấy %s" % en)
finally:
    e.stop()

# Z
e = Env(paths)
try:
    setup(e)
    e.wb.snaps = {dead(55): GOOD}
    p = e.mirror(back, ["--retries", "0"])
    s = need_summary(p, "Z")
    if p.returncode != 0 or "stopped" in s or s.get("wayback") != "1": fail("Z: URL origin-skipped cứu được từ Wayback là (a): mã 0 wayback=1; thấy mã %s %s" % (p.returncode, s))
    en = e.man()["entries"][e.url(dead(55))]
    if en.get("status") != "ok" or en.get("source") != "wayback": fail("Z: dead/55 phải ok source=wayback, thấy %s" % en)
finally:
    e.stop()
ok("mẫu có origin-skipped: X mã 4 không đổi manifest; Y một 429 -> mã 0; Z origin-skipped được Wayback cứu -> mã 0")
