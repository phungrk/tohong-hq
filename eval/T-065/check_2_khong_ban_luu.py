#!/usr/bin/env python3
"""T-065 tiêu chí 2: Wayback không có bản lưu (hoặc trả trang HTML, hoặc API trả rác) thì giữ failed như cũ: lý do của nguồn gốc, attempts như cũ,
URL gốc nguyên trong pool, mã thoát 0, ảnh khác không bị hỏng; dừng sớm khi cả mẫu 50 đều lỗi dù đã hỏi Wayback (spec mục 2, 4, 15-17).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_2_khong_ban_luu.py --back /home/user/tohong-back"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import *

back = need_back()
# A. vài URL không cứu được + 1 ảnh tốt (để mẫu không dừng sớm)
paths = ["/ok/live.png", "/gone/a.png", "/dead/b.png", "/html/c.png", "/gone/d-nojson.png", "/gone/e-raw404.png"]
e = Env(paths)
try:
    e.wb.snaps = {"/gone/d-nojson.png": ("nojson",), "/gone/e-raw404.png": ("raw404", TS)}
    pool0 = e.pool_bytes()
    p = e.mirror(back, ["--retries", "1"])
    if e.og.count("/dead/b.png") != 2: fail("522 thử lại theo --retries 1: nguồn gốc nhận 2 yêu cầu, thấy %d" % e.og.count("/dead/b.png"))
    if p.returncode != 0: fail("có ảnh lỗi (không cứu được) vẫn thoát 0, thấy %s; stderr %s" % (p.returncode, p.stderr[-200:]))
    ents = e.man()["entries"]
    # /dead/b.png (522, 5xx) thuộc mẫu: vẫn thử lại theo --retries (chỉ timeout không thử lại): attempts = 1 + retries = 2
    exp = {"/gone/a.png": ("http-404", 1, "none"), "/dead/b.png": ("http-522", 2, "none"), "/html/c.png": ("not-image", 1, "none"),
           "/gone/d-nojson.png": ("http-404", 1, "none"), "/gone/e-raw404.png": ("http-404", 1, "http-404")}
    for path, (why, att, wb) in exp.items():
        en = ents.get(e.url(path))
        if not en or en.get("status") != "failed": fail("%s: không có bản lưu dùng được -> failed, thấy %s" % (path, en))
        if en.get("reason") != why: fail("%s: reason giữ lý do của nguồn gốc (%s), thấy %r" % (path, why, en.get("reason")))
        if en.get("attempts") != att: fail("%s: attempts đếm yêu cầu tới nguồn gốc (%d), không đếm yêu cầu Wayback; thấy %r" % (path, att, en.get("attempts")))
        if en.get("wayback") != wb: fail("%s: wayback phải = %s, thấy %r" % (path, wb, en.get("wayback")))
        if en.get("fail_runs") != 1: fail("%s: fail_runs=1 như T-058" % path)
        if "file" in en or "source" in en: fail("%s: failed không có file/source" % path)
    if "FAILED %s http-404" % e.url("/gone/a.png") not in p.stdout: fail("phải in dòng FAILED <URL gốc> <reason> như cũ")
    s = need_summary(p, "A")
    if s.get("wayback") != "0" or s["failed"] != "5" or s["ok"] != "1": fail("SUMMARY wayback=0 failed=5 ok=1, thấy %s" % s)
    if e.pool_bytes() != pool0: fail("mirror không bao giờ ghi pool")
    if len(os.listdir(os.path.join(e.out, "v"))) != 1: fail("chỉ ảnh /ok/live.png có file trong out/v; thấy %s" % os.listdir(os.path.join(e.out, "v")))
    # lần chạy sau: failed được hỏi lại cả hai nguồn (không bao giờ coi là cuối cùng); lúc này Wayback đã có bản lưu
    e.wb.snaps["/gone/a.png"] = GOOD; e.wb.snaps["/dead/b.png"] = GOOD;  # dead/b (522, tạm thời) thuộc mẫu: cho nó ok để mẫu không dừng sớm
    e.wb.reqs.clear()
    p = e.mirror(back, ["--retries", "1"])
    en = e.man()["entries"][e.url("/gone/a.png")]
    if en.get("status") != "ok" or en.get("source") != "wayback": fail("lần chạy sau, Wayback có bản lưu: failed cũ phải thành ok: %s" % en)
    if not any(r["path"] == "/gone/a.png" for r in e.wb.reqs): fail("entry failed phải được hỏi lại ở lần chạy sau")
finally:
    e.stop()

# B. cả mẫu 50 đều lỗi dù đã hỏi Wayback: dừng sớm (mã 4), lý do là lý do của nguồn gốc, manifest không đổi, mỗi URL đúng một yêu cầu availability
e = Env(["/forbid/%d" % i for i in range(50)] + ["/ok/after.png"])
try:
    pool0 = e.pool_bytes()
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 4: fail("50/50 lỗi, Wayback không có gì: phải thoát mã 4 như T-058, thấy %s; stdout cuối: %s" % (p.returncode, p.stdout[-200:]))
    s = need_summary(p, "B")
    if s.get("stopped") != "early" or s.get("reason") != "http-403-50/50": fail("SUMMARY phải có stopped=early reason=http-403-50/50, thấy %s" % s)
    if s.get("wayback") != "0": fail("SUMMARY dừng sớm vẫn có wayback=0, thấy %s" % s)
    if e.man_bytes() is not None: fail("dừng sớm không được tạo manifest")
    if e.pool_bytes() != pool0: fail("dừng sớm không được đổi pool")
    if e.og.count("/ok/after.png") != 0: fail("URL thứ 51 không được gửi yêu cầu khi mẫu chưa có ok")
    if len([r for r in e.wb.of("avail")]) != 50 or e.wb.of("raw"): fail("mỗi URL trong mẫu: đúng 1 availability, không có raw (thấy %d / %d)" % (len(e.wb.of("avail")), len(e.wb.of("raw"))))
finally:
    e.stop()
ok("Wayback không có bản lưu: failed như cũ (reason/attempts của nguồn gốc, wayback=none), mã 0; mẫu 50 lỗi hết vẫn dừng sớm mã 4")
