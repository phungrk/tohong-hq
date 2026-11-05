#!/usr/bin/env python3
"""T-058 tiêu chí 6: entry ok cũ không bị đổi (dừng sớm: manifest nguyên byte; chạy tiếp: entry giữ nguyên) và không tính vào mẫu 50 đầu (reused, restored không cứu).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_6_entry_ok_cu.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

import json
def setup(env, n_bad, extra_paths=()):
    # 2 entry ok ở đầu danh sách: một đã có file trong out (reused), một thiếu file nhưng Pages giả có (restored)
    env.set_pool(["/ok/reused.png", "/ok/restored.png"] + ["/forbid/%d" % i for i in range(n_bad)] + list(extra_paths))
    f1, f2 = "v/marry_0000-111111111111.webp", "v/marry_0001-222222222222.webp"
    ents = {env.fk.url("/ok/reused.png"): ok_entry(f1), env.fk.url("/ok/restored.png"): ok_entry(f2)}
    write_manifest(env.manifest, ents)
    os.makedirs(os.path.join(env.out, "v"), exist_ok=True)
    open(os.path.join(env.out, f1), "wb").write(WEBP)
    return ents

# A. 50 lỗi 403 sau 2 entry ok: ok không tính vào mẫu -> vẫn dừng sớm; manifest nguyên byte
e = Env([])
try:
    setup(e, 50)
    man0, pool0 = e.man_bytes(), e.pool_bytes()
    p = e.mirror(back, ["--restore-from", e.fk.url("/webp")])
    need_stop(p, e, 50, "http-403", pool0, man0)
finally:
    e.stop()
# B. 49 lỗi + 1 ok mới: chạy tiếp; hai entry ok cũ giữ nguyên từng trường
e = Env([])
try:
    ents = setup(e, 49, ["/ok/new.png"])
    p = e.mirror(back, ["--restore-from", e.fk.url("/webp")])
    if p.returncode != 0: fail("phải chạy tiếp, thoát 0, thấy %s" % p.returncode)
    now = json.load(open(e.manifest, encoding="utf-8"))["entries"]
    for u, v in ents.items():
        if now.get(u) != v: fail("entry ok cũ bị đổi: %s -> %s" % (v, now.get(u)))
    if now[e.fk.url("/ok/new.png")]["status"] != "ok": fail("ảnh ok mới phải thành entry ok")
    s = kv(summary_line(p.stdout))
    if (s.get("reused"), s.get("restored"), s.get("failed")) != ("1", "1", "49"): fail("SUMMARY reused=1 restored=1 failed=49, thấy " + str(s))
finally:
    e.stop()
ok("entry ok cũ nguyên vẹn và không tính vào mẫu")
