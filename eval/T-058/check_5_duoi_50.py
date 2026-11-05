#!/usr/bin/env python3
"""T-058 tiêu chí 5: định nghĩa mẫu. Dưới 50 URL: tất cả lỗi thì dừng sớm (k = tổng); có 1 ok thì chạy tiếp. Entry failed vĩnh viễn và entry mồ côi không thuộc mẫu; entry failed tạm thời thuộc mẫu.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_5_duoi_50.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

e = Env(["/forbid/%d" % i for i in range(7)])
try:
    pool0 = e.pool_bytes()
    p = e.mirror(back)
    need_stop(p, e, 7, "http-403", pool0, None)
finally:
    e.stop()
e = Env(["/forbid/%d" % i for i in range(6)] + ["/ok/0.png"])
try:
    p = e.mirror(back)
    if p.returncode != 0: fail("6 lỗi + 1 ok: phải chạy tiếp, thoát 0, thấy %s" % p.returncode)
    s = summary_line(p.stdout)
    if "stopped" in s or kv(s).get("ok") != "1" or kv(s).get("failed") != "6": fail("SUMMARY sai: %s" % s)
finally:
    e.stop()
e = Env(["/forbid/0"])
try:
    p = e.mirror(back)
    need_stop(p, e, 1, "http-403", e.pool_bytes(), None)
finally:
    e.stop()
import json
def fent(reason, runs=1): return {"status": "failed", "reason": reason, "attempts": 1, "fail_runs": runs}
# a. nguồn khoẻ, 7 entry failed vĩnh viễn (vẫn 404), không có ảnh mới: mã 0, không dừng sớm
e = Env(["/nope/%d" % i for i in range(7)])
try:
    write_manifest(e.manifest, {e.fk.url("/nope/%d" % i): fent("http-404") for i in range(7)})
    p = e.mirror(back)
    if p.returncode != 0: fail("7 entry failed vĩnh viễn, không URL mới: phải thoát 0, thấy %s" % p.returncode)
    if "stopped" in (summary_line(p.stdout) or ""): fail("không được dừng sớm khi mẫu rỗng")
finally:
    e.stop()
# b. nguồn khoẻ, 60 entry failed vĩnh viễn đứng trước 5 URL mới: 5 URL mới được mirror, mã 0
e = Env(["/nope/%d" % i for i in range(60)] + ["/ok/new%d.png" % i for i in range(5)])
try:
    write_manifest(e.manifest, {e.fk.url("/nope/%d" % i): fent(["http-404", "http-410", "not-image", "too-large", "http-400"][i % 5]) for i in range(60)})
    p = e.mirror(back)
    if p.returncode != 0: fail("60 entry vĩnh viễn + 5 URL mới: phải thoát 0, thấy %s; %s" % (p.returncode, (summary_line(p.stdout) or p.stderr[-150:])))
    s = kv(summary_line(p.stdout))
    if (s.get("ok"), s.get("failed"), s.get("new")) != ("5", "60", "5") or "stopped" in s: fail("5 URL mới phải được mirror: " + str(s))
    ents = json.load(open(e.manifest, encoding="utf-8"))["entries"]
    if sum(1 for v in ents.values() if v["status"] == "ok") != 5: fail("manifest phải có 5 entry ok mới")
    if any(e.fk.paths_hit().count("/nope/%d" % i) < 1 for i in range(60)): fail("entry failed vĩnh viễn vẫn phải được thử lại (T-051 mục 12), ngoài mẫu")
finally:
    e.stop()
# c. 50 entry failed tạm thời (timeout) thuộc mẫu, đều timeout lại, kèm 10 URL mới đứng sau: dừng sớm, mã 4, URL mới không bị gọi
e = Env(["/hang/%d" % i for i in range(50)] + ["/ok/new%d.png" % i for i in range(10)], hang_secs=4)
try:
    write_manifest(e.manifest, {e.fk.url("/hang/%d" % i): fent("timeout", 1) for i in range(50)})
    man0, pool0 = e.man_bytes(), e.pool_bytes()
    p = e.mirror(back, ["--timeout", "1"], timeout=90)
    need_stop(p, e, 50, "timeout", pool0, man0)
    if any(x.startswith("/ok/") for x in e.fk.paths_hit()): fail("URL mới thứ 51 trở đi bị gọi trước khi quyết định dừng")
finally:
    e.stop()
# c2. cùng 50 entry nhưng đã thất bại liên tiếp 3 lần (fail_runs=3, host chết kiểu network): ra khỏi mẫu; nguồn chính khoẻ -> mã 0, 5 URL mới được mirror
DEAD = "http://127.0.0.1:1/dead/%d"
e = Env([DEAD % i for i in range(50)] + ["/ok/healed.png"] + ["/ok/new%d.png" % i for i in range(5)])
try:
    ents = {DEAD % i: fent("network", 3) for i in range(50)}
    ents[e.fk.url("/ok/healed.png")] = fent("network", 2)
    write_manifest(e.manifest, ents)
    p = e.mirror(back)
    if p.returncode != 0: fail("50 entry fail_runs=3 + 5 URL mới, nguồn khoẻ: phải thoát 0, thấy %s; %s" % (p.returncode, summary_line(p.stdout) or p.stderr[-150:]))
    s = kv(summary_line(p.stdout))
    if (s.get("ok"), s.get("failed")) != ("6", "50") or "stopped" in s: fail("5 URL mới + 1 entry lành lại phải ok: " + str(s))
    now = json.load(open(e.manifest, encoding="utf-8"))["entries"]
    if any(now[DEAD % i].get("fail_runs") != 4 or now[DEAD % i]["status"] != "failed" for i in range(50)): fail("entry vẫn hỏng phải tăng fail_runs 3 -> 4")
    if any("fail_runs" in v for v in now.values() if v["status"] == "ok"): fail("entry thành ok phải bỏ trường fail_runs")
finally:
    e.stop()
# c3. URL mới thất bại lần đầu có fail_runs=1 (kèm 1 URL tốt để không dừng sớm)
e = Env(["/ok/a.png", "/forbid/a"])
try:
    p = e.mirror(back)
    now = json.load(open(e.manifest, encoding="utf-8"))["entries"]
    if p.returncode != 0 or now[e.fk.url("/forbid/a")].get("fail_runs") != 1: fail("entry failed mới phải có fail_runs=1: " + str(now))
finally:
    e.stop()
# d. entry mồ côi (URL đã rời pool, lý do tạm thời) không thuộc mẫu và không gây dừng sớm
e = Env(["/ok/%d.png" % i for i in range(3)])
try:
    write_manifest(e.manifest, {"http://127.0.0.1:9/gone/%d" % i: fent("timeout") for i in range(60)})
    p = e.mirror(back)
    if p.returncode != 0: fail("entry mồ côi không được gây dừng sớm, thấy mã %s" % p.returncode)
    if "stopped" in (summary_line(p.stdout) or ""): fail("SUMMARY không được có stopped=")
    if any("/gone/" in x for x in e.fk.paths_hit()): fail("entry mồ côi không được gửi yêu cầu")
finally:
    e.stop()
ok("mẫu: dưới 50 URL xét toàn bộ; failed vĩnh viễn và mồ côi không thuộc mẫu; failed tạm thời (fail_runs<3) thuộc mẫu, từ fail_runs>=3 thì ra khỏi mẫu")
