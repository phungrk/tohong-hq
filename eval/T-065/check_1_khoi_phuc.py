#!/usr/bin/env python3
"""T-065 tiêu chí 1: nguồn gốc lỗi mà Wayback có bản lưu 200 -> tải từ Wayback (URL raw hậu tố id_), chuyển WebP <= 800px, entry ok kèm source/snapshot,
tên file theo URL gốc; hỏi Wayback bằng API availability; chỉ nhận bản lưu mã 200; kiểm là ảnh thật; không hỏi Wayback khi nguồn gốc ok hoặc quá lớn (spec mục 1-6, 11-13).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_1_khoi_phuc.py --back /home/user/tohong-back"""
import json, os, sys, urllib.parse
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import *

back = need_back()
paths = ["/ok/live.png", "/dead/a.png", "/gone/b.png", "/html/c.png", "/hang/d.png", "/gone/e-closest404.png", "/gone/f-unavailable.png",
         "/gone/g-htmlraw.png", "/gone/h-raw404.png", "/gone/Ảnh cưới (1).png", "/huge/big.jpg", "/gone/i-bigsnap.jpg", "/forbid/j.png"]
e = Env(paths, hang_secs=6)
try:
    u = e.url
    e.wb.snaps = {"/dead/a.png": "big", "/gone/b.png": ("img", GOOD[0], TS2), "/html/c.png": GOOD, "/hang/d.png": GOOD,
                  "/gone/e-closest404.png": ("closest", "404", TS), "/gone/g-htmlraw.png": ("html", TS), "/gone/h-raw404.png": ("raw404", TS),
                  "/gone/Ảnh cưới (1).png": GOOD, "/huge/big.jpg": GOOD, "/gone/i-bigsnap.jpg": "big", "/forbid/j.png": GOOD, "/ok/live.png": GOOD}
    # i-bigsnap: ảnh 2000x1000 -> 800 ; f-unavailable không có trong snaps -> available:false
    p = e.mirror(back, ["--timeout", "2", "--retries", "0"])
    if p.returncode != 0: fail("có ảnh thành công thì mirror phải thoát 0, thấy %s; stderr: %s" % (p.returncode, p.stderr[-300:]))
    ents = e.man()["entries"]

    # 1. ảnh khôi phục được: entry ok đủ trường, tên theo URL gốc
    want = ["/dead/a.png", "/gone/b.png", "/html/c.png", "/hang/d.png", "/gone/Ảnh cưới (1).png", "/forbid/j.png", "/gone/i-bigsnap.jpg"]
    for path in want:
        url = u(path); en = ents.get(url)
        vid = "marry_%04d" % paths.index(path)
        if not en or en.get("status") != "ok": fail("%s: nguồn gốc lỗi, Wayback có bản lưu 200 -> phải thành ok, thấy %s" % (path, en))
        if set(en) != {"status", "file", "width", "height", "bytes", "source", "snapshot"}: fail("%s: entry ok qua Wayback phải có đúng các trường status,file,width,height,bytes,source,snapshot: %s" % (path, sorted(en)))
        if en["source"] != "wayback": fail("%s: source phải = 'wayback', thấy %r" % (path, en["source"]))
        exp_ts = TS2 if path == "/gone/b.png" else TS
        if en["snapshot"] != exp_ts: fail("%s: snapshot phải = %s (14 chữ số lấy từ API), thấy %r" % (path, exp_ts, en["snapshot"]))
        if en["file"] != file_for(vid, url): fail("%s: tên file vẫn theo URL gốc (%s), thấy %s" % (path, file_for(vid, url), en["file"]))
        fp = os.path.join(e.out, en["file"])
        if not os.path.isfile(fp): fail("%s: thiếu file %s" % (path, en["file"]))
        fmt, (w, h) = webp_info(fp)
        if fmt != "WEBP": fail("%s: file ra phải là WebP, thấy %s" % (path, fmt))
        if (w, h) != (en["width"], en["height"]) or os.path.getsize(fp) != en["bytes"]: fail("%s: width/height/bytes không khớp file" % path)
    for path, exp in (("/dead/a.png", (800, 400)), ("/gone/i-bigsnap.jpg", (800, 400)), ("/gone/b.png", (300, 200))):
        _, sz = webp_info(os.path.join(e.out, ents[u(path)]["file"]))
        if sz != exp: fail("%s: ảnh từ Wayback cũng thu về rộng <= 800, không phóng to: mong %s, thấy %s" % (path, exp, sz))

    # 2. không khôi phục: bản lưu không phải 200, không có bản lưu, tải raw lỗi, raw là HTML của Wayback, nguồn quá lớn
    for path, why in (("/gone/e-closest404.png", "http-404"), ("/gone/f-unavailable.png", "http-404"), ("/gone/g-htmlraw.png", "http-404"),
                      ("/gone/h-raw404.png", "http-404"), ("/huge/big.jpg", "too-large")):
        en = ents.get(u(path))
        if not en or en.get("status") != "failed" or en.get("reason") != why: fail("%s: phải giữ failed reason=%s như cũ, thấy %s" % (path, why, en))
        if "file" in en or "source" in en or "snapshot" in en: fail("%s: entry failed không có file/source/snapshot" % path)
    if ents[u("/gone/g-htmlraw.png")].get("wayback") != "not-image": fail("raw trả HTML (200): entry failed phải ghi wayback=not-image")
    if ents[u("/gone/e-closest404.png")].get("wayback") != "none": fail("bản lưu gần nhất mã 404: coi là không có bản lưu, wayback=none")
    if ents[u("/gone/f-unavailable.png")].get("wayback") != "none": fail("available:false / không có bản lưu: wayback=none")
    if ents[u("/gone/h-raw404.png")].get("wayback") != "http-404": fail("raw trả 404: wayback=http-404, thấy %r" % ents[u("/gone/h-raw404.png")].get("wayback"))
    if os.path.exists(os.path.join(e.out, file_for("marry_%04d" % paths.index("/gone/g-htmlraw.png"), u("/gone/g-htmlraw.png")))): fail("trang HTML của Wayback không được ghi thành file ảnh")

    # 3. nguồn ok thì không hỏi Wayback, không có source
    live = ents[u("/ok/live.png")]
    if live.get("status") != "ok" or "source" in live or "snapshot" in live: fail("ảnh tải được từ nguồn gốc: ok, KHÔNG có source/snapshot: %s" % live)
    # too-large: không hỏi Wayback
    if any(r["path"] == "/huge/big.jpg" for r in e.wb.reqs): fail("lỗi too-large không được hỏi Wayback")
    if any(r["path"] == "/ok/live.png" for r in e.wb.reqs): fail("nguồn gốc tải được thì không hỏi Wayback")

    # 4. cách hỏi
    av = e.wb.of("avail")
    for path in want + ["/gone/e-closest404.png", "/gone/f-unavailable.png", "/gone/g-htmlraw.png", "/gone/h-raw404.png"]:
        mine = [r for r in av if r["path"] == path]
        if len(mine) != 1: fail("%s: phải hỏi availability đúng 1 lần, thấy %d" % (path, len(mine)))
        if mine[0]["orig"] != u(path): fail("%s: tham số url của availability phải giải mã phần trăm đúng bằng URL gốc %r, thấy %r" % (path, u(path), mine[0]["orig"]))
        if "/wayback/available?" not in mine[0]["raw"]: fail("phải dùng API /wayback/available?url=…")
    for path in want:
        raws = [r for r in e.wb.of("raw") if r["path"] == path]
        if len(raws) != 1: fail("%s: phải tải raw đúng 1 lần, thấy %d" % (path, len(raws)))
        if raws[0]["ts"] != ents[u(path)]["snapshot"]: fail("%s: URL raw phải dạng /web/<snapshot>id_/<URL gốc>" % path)
        if raws[0]["orig"] != u(path): fail("%s: URL gốc trong URL raw phải đúng từng ký tự: %r" % (path, raws[0]["orig"]))
    if any(r["kind"] == "other" for r in e.wb.reqs): fail("Wayback chỉ nhận /wayback/available và /web/<ts>id_/…, không đi theo URL 'url' trong JSON của API: " + str([r["raw"] for r in e.wb.reqs if r["kind"] == "other"][:2]))
    for r in e.wb.reqs:
        if "tohong" not in r["ua"].lower(): fail("yêu cầu tới archive.org phải có User-Agent tự nhận chứa 'tohong', thấy %r" % r["ua"])

    # 5. SUMMARY
    s = need_summary(p, "SUMMARY")
    if s.get("wayback") != str(len(want)): fail("SUMMARY phải có wayback=%d, thấy %s" % (len(want), s))
    if s["new"] != str(len(want) + 1) or s["failed"] != "5" or s["total"] != str(len(paths)): fail("SUMMARY new=%d failed=5 total=%d, thấy %s" % (len(want) + 1, len(paths), s))
    if list(s)[-1] != "wayback" and "stopped" not in s: fail("wayback= phải ở cuối dòng SUMMARY (sau missing=)")
    if "wayback=" not in p.stdout.splitlines()[-1]: fail("SUMMARY phải là dòng cuối")

    # 6. entry failed cũ có bản lưu: thành ok, bỏ attempts/fail_runs
    e2 = Env(["/gone/old.png"])
    try:
        e2.wb.snaps = {"/gone/old.png": GOOD}
        write_manifest(e2.manifest, {e2.url("/gone/old.png"): {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 2}})
        p2 = e2.mirror(back, ["--retries", "0"])
        en = e2.man()["entries"][e2.url("/gone/old.png")]
        if en.get("status") != "ok" or en.get("source") != "wayback" or "attempts" in en or "fail_runs" in en or "reason" in en or "wayback" in en:
            fail("entry failed cũ khôi phục được: thành ok (source/snapshot), bỏ reason/attempts/fail_runs/wayback: %s" % en)
    finally:
        e2.stop()

    # 7. không bật cờ: hành vi cũ, không trường wayback; tham số thử nghiệm bị từ chối (mã 2, một dòng lỗi rõ, không traceback)
    e3 = Env(["/ok/live.png", "/gone/z.png"])
    try:
        e3.wb.snaps = {"/gone/z.png": GOOD}
        p3 = e3.mirror(back, ["--retries", "0"], wayback=False)
        if p3.returncode != 0: fail("không bật cờ: chạy như T-051, mã 0, thấy %s; stderr %s" % (p3.returncode, p3.stderr[-200:]))
        en = e3.man()["entries"][e3.url("/gone/z.png")]
        if en.get("status") != "failed" or en.get("reason") != "http-404" or "wayback" in en: fail("không bật cờ: failed như T-051, không có trường wayback: %s" % en)
        if "wayback" in (summary_line(p3.stdout) or ""): fail("không bật cờ thì SUMMARY không có wayback=")
        def reject(args, what, mention):
            os.path.exists(e3.manifest) and os.remove(e3.manifest)
            r = run(cli(back) + ["mirror", "--pool", e3.pool, "--manifest", e3.manifest, "--out", e3.out, "--base-url", BASE_URL] + args, timeout=60)
            if r.returncode != 2: fail("%s: phải thoát mã 2, thấy %s (stderr: %s)" % (what, r.returncode, r.stderr[-200:]))
            err = r.stderr.strip()
            if not err or "Traceback" in err or "    at " in err or len(err.splitlines()) > 3: fail("%s: stderr phải là một dòng lỗi rõ (<= 3 dòng, không stack trace), thấy: %r" % (what, err[-300:]))
            if mention not in err: fail("%s: dòng lỗi phải nêu %r, thấy %r" % (what, mention, err))
            if os.path.exists(e3.manifest): fail("%s: từ chối thì không ghi manifest" % what)
        reject(["--wayback-base", e3.wb.base], "--wayback-base khi không có --fallback wayback", "--wayback-base")
        reject(["--wayback-interval", "50"], "--wayback-interval khi không có --fallback wayback", "--wayback-interval")
        reject(["--wayback-backoff", "50"], "--wayback-backoff khi không có --fallback wayback", "--wayback-backoff")
        reject(["--fallback", "wayback", "--wayback-base", "http://wayback.invalid", "--wayback-interval", "10"], "base không phải loopback + interval < 1000", "--wayback-interval")
        reject(["--fallback", "wayback", "--wayback-interval", "10"], "base mặc định + interval < 1000", "--wayback-interval")
        reject(["--fallback", "wayback", "--wayback-backoff", "100"], "base mặc định + backoff < 2000", "--wayback-backoff")
        reject(["--fallback", "khac"], "--fallback giá trị lạ", "--fallback")
        if e3.wb.total(): fail("các lần bị từ chối không được gửi yêu cầu nào tới Wayback (thấy %d)" % e3.wb.total())
        # base loopback thì interval/backoff thấp được nhận
        os.path.exists(e3.manifest) and os.remove(e3.manifest)
        r = run(cli(back) + ["mirror", "--pool", e3.pool, "--manifest", e3.manifest, "--out", e3.out, "--base-url", BASE_URL, "--retries", "0", "--fallback", "wayback",
                             "--wayback-base", e3.wb.base, "--wayback-interval", "10", "--wayback-backoff", "10"], timeout=60)
        if r.returncode != 0: fail("base loopback thì --wayback-interval/--wayback-backoff thấp được nhận: mã %s, %s" % (r.returncode, r.stderr[-200:]))
    finally:
        e3.stop()
finally:
    e.stop()
ok("Wayback khôi phục ảnh khi nguồn gốc lỗi: availability + raw id_, chỉ mã 200, là ảnh thật, manifest source/snapshot, tên file theo URL gốc")
