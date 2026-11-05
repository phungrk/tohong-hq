#!/usr/bin/env python3
"""T-069 tiêu chí 1 và 2: nguồn gốc lỗi mà web.archive.org có bản lưu -> tải thẳng /web/<ts>id_/<URL gốc>, theo chuyển hướng (<= 5), entry ok source=wayback,
snapshot = mốc sau chuyển hướng; KHÔNG BAO GIỜ gọi /wayback/available (spec mục 1-4, 6).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-069/check_1_lay_anh.py   (tự tìm tohong-back; hoặc thêm --back <thư mục>)"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t069 import *

back = need_back()
SEEN_AVAIL = []

def check_clean(e, what):
    SEEN_AVAIL.extend(e.wb.of("avail"))
    if e.wb.of("avail"): fail("%s: công cụ vẫn gọi /wayback/available (%d lần); spec mục 2 cấm" % (what, len(e.wb.of("avail"))))
    if e.wb.of("other"): fail("%s: yêu cầu lạ tới Wayback: %s" % (what, e.wb.of("other")[0]["raw"]))
    if e.wb.max_cur > 1: fail("%s: %d yêu cầu Wayback cùng lúc" % (what, e.wb.max_cur))

# A. một ảnh, một chuyển hướng: yêu cầu đầu tiên đúng dạng, snapshot lấy từ URL sau chuyển hướng
paths = [dead(0), "/gone/1"]
e = Env(paths)
try:
    e.wb.snaps = {dead(0): ("img", GOOD[0], TS), "/gone/1": ("img", GOOD[0], TS2)}
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("mã thoát phải 0, thấy %s; stdout cuối: %s; stderr: %s" % (p.returncode, p.stdout[-250:], p.stderr[-200:]))
    s = need_summary(p, "A")
    if (s["total"], s["ok"], s["failed"], s.get("wayback")) != ("2", "2", "0", "2"): fail("SUMMARY total=2 ok=2 failed=0 wayback=2, thấy %s" % s)
    ents = e.man()["entries"]
    u0 = e.url(dead(0)); en = ents[u0]
    want = {"status": "ok", "file": file_for("marry_0000", u0), "source": "wayback", "snapshot": TS}
    for k, v in want.items():
        if en.get(k) != v: fail("entry %s: %s phải là %r, thấy %r (entry: %s)" % (u0, k, v, en.get(k), en))
    if set(en) != {"status", "file", "width", "height", "bytes", "source", "snapshot"}: fail("entry ok qua Wayback đúng 7 trường, thấy %s" % sorted(en))
    if ents[e.url("/gone/1")].get("snapshot") != TS2: fail("snapshot phải lấy từ URL sau chuyển hướng (%s), thấy %s" % (TS2, ents[e.url("/gone/1")]))
    fmt, size = webp_info(os.path.join(e.out, en["file"]))
    if fmt != "WEBP": fail("file phải là WebP, thấy %s" % fmt)
    ws = e.wb.of("wb")
    if len(ws) != 4: fail("2 URL x (1 yêu cầu mốc + 1 yêu cầu bản lưu) = 4 yêu cầu Wayback, thấy %d" % len(ws))
    first = ws[0]
    if first["ts"] != ENTRY_TS or first["raw"] != "/web/%sid_/%s" % (ENTRY_TS, u0): fail("yêu cầu đầu tiên phải là GET /web/%sid_/<URL gốc nguyên văn>, thấy %s" % (ENTRY_TS, first["raw"]))
    if ws[1]["ts"] != TS: fail("yêu cầu thứ hai phải theo Location tới mốc %s, thấy %s" % (TS, ws[1]["ts"]))
    if any("tohong" not in r["ua"].lower() for r in ws): fail("A: mọi yêu cầu tới Wayback mang User-Agent tự nhận chứa 'tohong'")
    check_clean(e, "A")
finally:
    e.stop()

# B. URL mẫu của Capu (2026-11-05): .../web/20240730154649/https://www.marry.vn/images/detailed/111/anh-cuoi-dinh-ha-thu-4.jpg mở ra ảnh thật
cp = "/dead" + CAPU_PATH
e = Env([cp])
try:
    e.wb.snaps = {cp: ("img", BIG[0], "20240730154649")}
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("B: mã thoát phải 0, thấy %s; %s" % (p.returncode, p.stdout[-200:]))
    en = e.man()["entries"][e.url(cp)]
    if en.get("source") != "wayback" or en.get("snapshot") != "20240730154649": fail("B: ảnh mẫu của Capu phải thành ok source=wayback snapshot=20240730154649, thấy %s" % en)
    if en["width"] != 800: fail("B: ảnh rộng 2000 phải thu về 800, thấy %s" % en["width"])
    if e.wb.of("wb")[0]["orig"] != e.url(cp): fail("B: phần sau id_/ phải đúng URL gốc, thấy %s" % e.wb.of("wb")[0]["orig"])
    check_clean(e, "B")
finally:
    e.stop()

# C. chuyển hướng: 4 lần thêm (5 chuyển hướng tổng) vẫn nhận; 5 lần thêm (6 chuyển hướng), vòng lặp, host lạ: không nhận
e = Env(["/ok/small.png", dead(1), dead(2), dead(3), dead(4)])
try:
    e.wb.snaps = {dead(1): ("hops", 4, TS), dead(2): ("hops", 5, TS), dead(3): ("loop",), dead(4): ("foreign",)}
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("C: mã thoát 0 (mẫu có URL ok), thấy %s; %s" % (p.returncode, p.stdout[-200:]))
    ents = e.man()["entries"]
    if ents[e.url(dead(1))].get("snapshot") != TS: fail("C: 5 chuyển hướng (1 mốc + 4 trung gian) phải được theo, thấy %s" % ents[e.url(dead(1))])
    for i, name in ((2, "6 chuyển hướng"), (3, "vòng lặp"), (4, "chuyển hướng sang host khác")):
        en = ents[e.url(dead(i))]
        if en.get("status") != "failed" or not str(en.get("wayback", "")).startswith("http-3"): fail("C: %s phải failed với wayback=http-3xx, thấy %s" % (name, en))
    n3 = len([r for r in e.wb.of("wb") if r["path"] == dead(3)])
    if n3 > 6: fail("C: vòng lặp phải dừng sau tối đa 6 yêu cầu (1 + 5 chuyển hướng), thấy %d" % n3)
    check_clean(e, "C")
finally:
    e.stop()

# D. không bản lưu / bản lưu hỏng: giữ failed, reason của NGUỒN GỐC, attempts của nguồn gốc
cases = [(dead(0), None, "none"), (dead(1), ("html", TS), "not-image"), (dead(2), ("status", 404), "none"), (dead(3), ("status", 410), "http-410")]
e = Env(["/ok/small.png"] + [c[0] for c in cases])
try:
    for pth, sp, _ in cases:
        if sp is not None: e.wb.snaps[pth] = sp
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("D: mã thoát 0, thấy %s" % p.returncode)
    ents = e.man()["entries"]
    for pth, sp, want in cases:
        en = ents[e.url(pth)]
        if (en.get("status"), en.get("reason"), en.get("attempts"), en.get("wayback")) != ("failed", "http-522", 1, want):
            fail("D: %s phải failed reason=http-522 attempts=1 wayback=%s, thấy %s" % (pth, want, en))
        if "source" in en or "snapshot" in en: fail("D: entry failed không có source/snapshot")
    check_clean(e, "D")
finally:
    e.stop()

# E. nguồn gốc ok hoặc too-large không hỏi Wayback; không có cờ thì không một yêu cầu nào tới Wayback
e = Env(["/ok/small.png", "/huge/1", dead(2)])
try:
    e.wb.snaps = {"/ok/small.png": GOOD, "/huge/1": GOOD, dead(2): GOOD}
    p = e.mirror(back, ["--retries", "0"])
    asked = {r["path"] for r in e.wb.of("wb")}
    if asked != {dead(2)}: fail("E: chỉ URL nguồn gốc lỗi (không phải too-large) được hỏi Wayback, thấy %s" % sorted(asked))
    check_clean(e, "E")
    e.wb.reqs.clear(); os.remove(e.manifest)
    p = e.mirror(back, ["--retries", "0"], wayback=False)
    if e.wb.total() != 0: fail("E: không --fallback wayback thì không yêu cầu nào tới Wayback, thấy %d" % e.wb.total())
finally:
    e.stop()
ok("tải thẳng /web/%sid_/ + theo chuyển hướng; snapshot theo URL cuối; không availability; mẫu Capu; không bản lưu giữ failed" % ENTRY_TS)
