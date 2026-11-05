#!/usr/bin/env python3
"""T-065 tiêu chí 4 (phần dừng sớm) và 5: nguồn gốc chết mà Wayback có ảnh thì công cụ chạy tiếp, không dừng sớm, và không còn hỏi nguồn gốc sau 50 URL đầu;
Wayback cũng không có thì dừng sớm mã 4 như T-058; cộng năm bất biến inv-001..005 xanh (spec mục 18-22).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_5_dung_som_bat_bien.py --back /home/user/tohong-back"""
import os, subprocess, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import *

back = need_back()
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

# A. nguồn gốc treo hoàn toàn, Wayback có đủ 80 ảnh: chạy tiếp, mã 0, không stopped=; nguồn gốc chỉ bị gọi cho 50 URL đầu, đúng 1 lần mỗi URL
paths = ["/hang/%d" % i for i in range(80)]
e = Env(paths, hang_secs=6)
try:
    e.wb.snaps = {p_: GOOD for p_ in paths}
    t = time.time()
    p = e.mirror(back, ["--timeout", "1"])
    if p.returncode != 0: fail("nguồn gốc chết nhưng Wayback có ảnh: phải chạy tiếp và thoát 0, thấy %s; stdout cuối: %s" % (p.returncode, p.stdout[-250:]))
    s = need_summary(p, "A")
    if "stopped" in s or "reason" in s: fail("không được dừng sớm khi Wayback cứu được ảnh: " + str(s))
    if (s["total"], s["ok"], s["failed"], s.get("wayback")) != ("80", "80", "0", "80"): fail("SUMMARY total=80 ok=80 failed=0 wayback=80, thấy %s" % s)
    for i in range(50):
        if e.og.count("/hang/%d" % i) != 1: fail("URL %d thuộc 50 URL đầu: nguồn gốc đúng 1 yêu cầu (timeout không thử lại), thấy %d" % (i, e.og.count("/hang/%d" % i)))
    late = [x for x in e.og.paths_hit() if x.startswith("/hang/") and int(x.split("/")[-1]) >= 50]
    if late: fail("sau 50 URL đầu đều lỗi kiểu nguồn chết (timeout), không gửi thêm yêu cầu nào tới nguồn gốc: " + str(late[:3]))
    if len(e.wb.of("avail")) != 80 or len(e.wb.of("raw")) != 80: fail("mỗi URL: 1 availability + 1 raw")
    if time.time() - t > 60: fail("quá chậm: %.0f giây" % (time.time() - t))
    ents = e.man()["entries"]
    if any(en.get("source") != "wayback" for en in ents.values()) or len(ents) != 80: fail("80 entry đều ok qua Wayback")
finally:
    e.stop()

# B. nguồn gốc chết, Wayback có DUY NHẤT ảnh thứ 50: một thành công trong mẫu thì không dừng sớm; URL sau đó bỏ qua nguồn gốc và ghi origin-skipped
paths = ["/hang/%d" % i for i in range(60)]
e = Env(paths, hang_secs=6)
try:
    e.wb.snaps = {"/hang/49": GOOD}
    p = e.mirror(back, ["--timeout", "1"])
    if p.returncode != 0: fail("một ảnh thành công trong mẫu thì không dừng sớm, mã 0, thấy %s; stdout cuối %s" % (p.returncode, p.stdout[-200:]))
    s = need_summary(p, "B")
    if (s["ok"], s["failed"], s.get("wayback")) != ("1", "59", "1") or "stopped" in s: fail("SUMMARY ok=1 failed=59 wayback=1, thấy %s" % s)
    ents = e.man()["entries"]
    a, b = ents[e.url("/hang/0")], ents[e.url("/hang/55")]
    if (a.get("reason"), a.get("attempts"), a.get("wayback")) != ("timeout", 1, "none"): fail("URL trong 50 đầu: reason=timeout attempts=1 wayback=none, thấy %s" % a)
    if (b.get("reason"), b.get("attempts"), b.get("wayback")) != ("origin-skipped", 0, "none"): fail("URL sau 50 đầu khi nguồn đã chết: reason=origin-skipped attempts=0 wayback=none, thấy %s" % b)
    if any(int(x.split("/")[-1]) >= 50 for x in e.og.paths_hit()): fail("URL thứ 51+ không được gọi nguồn gốc")
    if "FAILED %s origin-skipped" % e.url("/hang/55") not in p.stdout: fail("dòng FAILED dùng reason origin-skipped")
finally:
    e.stop()

# C. Wayback cũng không có: giữ luật cũ T-058: dừng sớm mã 4, reason của nguồn gốc, manifest/pool nguyên, URL 51+ không bị gọi
paths = ["/hang/%d" % i for i in range(50)] + ["/ok/after.png"] * 1
e = Env(paths, hang_secs=6)
try:
    pool0 = e.pool_bytes()
    p = e.mirror(back, ["--timeout", "1"])
    if p.returncode != 4: fail("nguồn gốc chết, Wayback không có: dừng sớm mã 4, thấy %s" % p.returncode)
    s = need_summary(p, "C")
    if s.get("stopped") != "early" or s.get("reason") != "timeout-50/50": fail("stopped=early reason=timeout-50/50, thấy %s" % s)
    if e.man_bytes() is not None or e.pool_bytes() != pool0: fail("dừng sớm không ghi manifest, không đổi pool")
    if e.og.count("/ok/after.png"): fail("URL 51 không được gọi")
    if e.wb.of("raw"): fail("không có bản lưu thì không có yêu cầu raw")
finally:
    e.stop()

# D. nguồn gốc còn sống (50 URL đầu có 1 ok, còn lại 403): nguồn gốc KHÔNG bị bỏ qua cho URL sau đó
paths = ["/ok/live.png"] + ["/forbid/%d" % i for i in range(70)]
e = Env(paths)
try:
    e.wb.snaps = {"/forbid/60": GOOD}
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("mã 0, thấy %s" % p.returncode)
    for i in (0, 49, 60, 69):
        if e.og.count("/forbid/%d" % i) != 1: fail("nguồn gốc còn sống (có ảnh ok trong 50 URL đầu): URL %d vẫn phải được thử ở nguồn gốc" % i)
    if e.man()["entries"][e.url("/forbid/60")].get("source") != "wayback": fail("URL 60 khôi phục từ Wayback sau khi nguồn gốc 403")
    if any(en.get("reason") == "origin-skipped" for en in e.man()["entries"].values()): fail("nguồn còn sống thì không có origin-skipped")
finally:
    e.stop()

# E. nguồn chết nhưng đa số lỗi là 404 (ảnh bị xoá) không phải kiểu nguồn chết: không bỏ qua nguồn gốc
paths = ["/gone/%d" % i for i in range(60)] + ["/ok/late.png"]
e = Env(paths)
try:
    e.wb.snaps = {"/gone/3": GOOD}
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("1 ảnh qua Wayback trong mẫu: mã 0, thấy %s" % p.returncode)
    if e.og.count("/ok/late.png") != 1 or e.man()["entries"][e.url("/ok/late.png")].get("source"): fail("50 URL đầu đều 404 (không phải timeout/403/5xx/429/lỗi mạng) thì nguồn gốc không bị coi là chết: URL sau vẫn tải từ nguồn gốc")
finally:
    e.stop()

# F. 60 entry failed vĩnh viễn từ trước + 5 URL mới, nguồn treo: nguồn gốc chỉ bị gọi cho 50 URL đầu cần tải
paths = ["/hang/%d" % i for i in range(65)]
e = Env(paths, hang_secs=6)
try:
    e.wb.snaps = {p_: GOOD for p_ in paths}
    write_manifest(e.manifest, {e.url("/hang/%d" % i): {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 1} for i in range(60)})
    p = e.mirror(back, ["--timeout", "1"])
    if p.returncode != 0: fail("mã 0, thấy %s; stdout cuối %s" % (p.returncode, p.stdout[-200:]))
    n = len({x for x in e.og.paths_hit()})
    if n != 50: fail("nguồn gốc chỉ bị gọi cho 50 URL đầu cần tải (kể cả failed vĩnh viễn), thấy %d URL" % n)
    if need_summary(p, "F").get("wayback") != "65": fail("65 ảnh qua Wayback")
finally:
    e.stop()

# H. hai lần chạy liên tiếp trên cùng manifest: nguồn chết, Wayback có một phần. Lần 1 ngắt mạch; lần 2 phải mã 0 (entry đã có trường wayback không vào mẫu dừng sớm)
paths = ["/dead/%d" % i for i in range(60)]
e = Env(paths)
try:
    e.wb.snaps = {"/dead/%d" % i: GOOD for i in range(20)}
    e.wb.pre = lambda kind, n, path: (429, {}) if path in {"/dead/%d" % i for i in range(20, 25)} else None
    p = e.mirror(back, ["--retries", "0", "--workers", "1"])
    if p.returncode != 0: fail("lần 1: 20 ảnh qua Wayback trong mẫu, mã 0, thấy %s" % p.returncode)
    ents = e.man()["entries"]
    cb = [i for i in range(60) if ents[e.url("/dead/%d" % i)].get("wayback") == "circuit-open"]
    if len(cb) != 35: fail("lần 1: 35 URL (25..59) bị ngắt mạch wayback=circuit-open, thấy %d" % len(cb))
    # lần 2: Wayback hết 429, có bản lưu cho 20..39, không có cho 40..59
    e.wb.pre = None; e.wb.reqs.clear(); e.og.hits.clear()
    e.wb.snaps = {"/dead/%d" % i: GOOD for i in range(40)}
    p = e.mirror(back, ["--retries", "0", "--workers", "1"])
    if p.returncode != 0: fail("lần 2: entry failed đã được hỏi Wayback không vào mẫu dừng sớm, mẫu rỗng thì không dừng sớm: mã 0, thấy %s; stdout cuối: %s" % (p.returncode, p.stdout[-200:]))
    s2 = need_summary(p, "H2")
    if "stopped" in s2 or s2.get("wayback") != "20": fail("lần 2: không stopped=, wayback=20 (URL 20..39), thấy %s" % s2)
    ents = e.man()["entries"]
    if [i for i in range(60) if ents[e.url("/dead/%d" % i)].get("status") == "ok"] != list(range(40)): fail("lần 2: URL 0..39 là ok (circuit-open ở lần 1 được hỏi lại và thành ok)")
    if any(ents[e.url("/dead/%d" % i)].get("wayback") != "none" for i in range(40, 60)): fail("lần 2: URL 40..59 failed với wayback=none")
    if len([r for r in e.wb.of("avail") if r["path"] in {"/dead/%d" % i for i in range(20, 60)}]) != 40: fail("lần 2: 40 URL failed phải được hỏi lại Wayback")
    # lần 3: giữ nguyên, vẫn mã 0
    p = e.mirror(back, ["--retries", "0", "--workers", "1"])
    if p.returncode != 0: fail("lần 3: vẫn mã 0, thấy %s" % p.returncode)
finally:
    e.stop()

# I. ghi manifest theo mốc: giết tiến trình giữa chừng, manifest vẫn đọc được và có các entry ok đã xong (mỗi 100 URL xử lý xong, sau khi mẫu dừng sớm đã qua)
import signal, json as _json
n_fast = 130
paths = ["/ok/live.png"] + ["/gone/%d.png" % i for i in range(1, n_fast)] + ["/gone/slow%d.png" % i for i in range(5)]
e = Env(paths)
try:
    e.wb.snaps = {p_: GOOD for p_ in paths}
    e.wb.pre = lambda kind, n, path: ("hang", 60) if path.startswith("/gone/slow") else None
    pr = subprocess.Popen(e.cmd(back, ["--retries", "0", "--workers", "1", "--timeout", "50"]), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    t0 = time.time()
    try:
        while time.time() - t0 < 120 and not any(r["path"].startswith("/gone/slow") for r in e.wb.reqs): time.sleep(0.2)
        if not any(r["path"].startswith("/gone/slow") for r in e.wb.reqs): fail("chưa tới URL chậm sau 120 giây")
        time.sleep(0.5)
    finally:
        pr.kill(); pr.wait(); pr.stdout.close(); pr.stderr.close()
    if not os.path.exists(e.manifest): fail("đã xử lý 130 URL (> 100) mà bị giết thì manifest phải có sẵn từ mốc 100")
    try: m = _json.load(open(e.manifest, encoding="utf-8"))
    except Exception as ex: fail("manifest sau khi bị giết phải đọc được: %s" % ex)
    oks = [(u_, en) for u_, en in m["entries"].items() if en.get("status") == "ok"]
    if len(oks) < 100: fail("manifest theo mốc phải có >= 100 entry ok đã xong, thấy %d" % len(oks))
    if any(not os.path.isfile(os.path.join(e.out, en["file"])) for _, en in oks): fail("mọi entry ok trong manifest theo mốc phải có file trong --out")
finally:
    e.stop()

# J. chưa qua mẫu dừng sớm thì không ghi manifest theo mốc: 50 URL treo đứng đầu, 120 entry ok sau đó (xử lý trong lúc chờ mẫu, done vượt 100) rồi mẫu lỗi hết -> mã 4, manifest nguyên byte
hang = ["/hang/%d" % i for i in range(50)]
oks_p = ["/ok/r%d.png" % i for i in range(120)]
e = Env(hang + oks_p, hang_secs=6)
try:
    ents0 = {}
    os.makedirs(os.path.join(e.out, "v"), exist_ok=True)
    for i, p_ in enumerate(oks_p):
        f_ = "v/marry_%04d-%s.webp" % (50 + i, ("%012x" % i)); ents0[e.url(p_)] = ok_entry(f_); open(os.path.join(e.out, f_), "wb").write(WEBP)
    write_manifest(e.manifest, ents0)
    man0 = e.man_bytes()
    p = e.mirror(back, ["--timeout", "1", "--retries", "0"])
    if p.returncode != 4: fail("mẫu 50 treo, Wayback không có: mã 4, thấy %s" % p.returncode)
    if e.man_bytes() != man0: fail("mã 4 không đổi manifest từng byte, kể cả khi done đã vượt 100 trước lúc dừng (chưa qua mẫu thì không ghi theo mốc)")
finally:
    e.stop()

# K. origin-skipped áp ngay trong lần chạy: URL mẫu dừng sớm bị bỏ qua nguồn gốc ra khỏi mẫu; mẫu rỗng thì không dừng sớm (mã 0, ghi manifest)
old = ["/dead/%d" % i for i in range(60)]
new = ["/dead/new%d" % i for i in range(5)]
e = Env(old + new)
try:
    write_manifest(e.manifest, {e.url(p_): {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 1} for p_ in old})
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("5 URL mới đều bị bỏ qua nguồn gốc (nguồn chết) và Wayback không có: ra khỏi mẫu, mẫu rỗng, mã 0, thấy %s; stdout cuối %s" % (p.returncode, p.stdout[-200:]))
    s = need_summary(p, "K")
    if "stopped" in s or s["failed"] != "65": fail("không stopped=, failed=65, thấy %s" % s)
    en = e.man()["entries"][e.url("/dead/new0")]
    if (en.get("reason"), en.get("attempts"), en.get("wayback")) != ("origin-skipped", 0, "none"): fail("URL mới: origin-skipped attempts=0 wayback=none, thấy %s" % en)
    # nhưng mẫu còn URL thật sự hỏi nguồn gốc mà lỗi hết thì vẫn dừng sớm: 1 URL mới nằm trong 50 đầu
finally:
    e.stop()

# L. 522 (5xx) trong mẫu nguồn thử lại theo --retries (chỉ timeout không thử lại): nguồn gốc nhận <= 50 x (1 + retries) yêu cầu, không URL nào từ thứ 51
paths = ["/dead/%d" % i for i in range(70)]
e = Env(paths)
try:
    e.wb.snaps = {p_: GOOD for p_ in paths}
    p = e.mirror(back, ["--retries", "2"])
    if p.returncode != 0: fail("mã 0, thấy %s" % p.returncode)
    hits = e.og.paths_hit()
    if len(hits) > 150: fail("nguồn gốc nhận tối đa 50 x (1 + retries) = 150 yêu cầu, thấy %d" % len(hits))
    if any(int(x.split("/")[-1]) >= 50 for x in hits): fail("URL thứ 51+ không được gọi nguồn gốc")
    if any(e.og.count("/dead/%d" % i) != 3 for i in range(50)): fail("522 thuộc 5xx: mỗi URL mẫu nguồn nhận 1 + 2 yêu cầu")
finally:
    e.stop()

# G. bất biến inv-001..005 của vùng xanh (chạy đúng tệp trong bể)
inv = os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images")
files = sorted(f for f in os.listdir(inv) if f[:4] == "inv-" and f.endswith(".py") and f[4:7] in ("001", "002", "003", "004", "005"))
if len(files) != 5: fail("thiếu bất biến trong bể: %s" % files)
envv = dict(os.environ, TOHONG_BACK_REPO=back)
for f in files:
    r = subprocess.run(["python3", "-I", os.path.join(inv, f)], capture_output=True, text=True, env=envv, cwd=back, timeout=300)
    if r.returncode != 0: fail("bất biến %s đỏ: %s" % (f, (r.stdout + r.stderr).strip()[-300:]))
ok("nguồn chết + Wayback có ảnh: chạy tiếp, bỏ qua nguồn sau 50 URL; Wayback không có: dừng sớm mã 4; inv-001..005 xanh")
