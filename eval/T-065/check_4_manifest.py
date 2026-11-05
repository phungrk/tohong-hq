#!/usr/bin/env python3
"""T-065 tiêu chí 4: manifest. Entry ok qua Wayback thêm source/snapshot, tên file vẫn theo URL gốc và id vendor nhỏ nhất; entry ok cũ (nguồn gốc) không bao giờ bị đổi,
hạ, hay hỏi Wayback (kể cả khi thiếu file và khôi phục thất bại: MISSING mã 3); chạy lại không tải gì; rewrite dùng được entry mới (spec mục 11-14).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_4_manifest.py --back /home/user/tohong-back"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import *

back = need_back()

# A. ok cũ giữ từng trường; thiếu file + Pages không có + nguồn chết -> MISSING mã 3, KHÔNG hỏi Wayback, entry nguyên
e = Env(["/ok/live.png", "/dead/gone-file.png", "/gone/new.png"])
try:
    u = e.url
    f_old, f_miss = file_for("marry_0000", u("/ok/live.png")), "v/marry_0001-aaaaaaaaaaaa.webp"
    old = {u("/ok/live.png"): ok_entry(f_old), u("/dead/gone-file.png"): ok_entry(f_miss)}
    write_manifest(e.manifest, old)
    os.makedirs(os.path.join(e.out, "v"), exist_ok=True); open(os.path.join(e.out, f_old), "wb").write(WEBP)
    e.wb.snaps = {"/dead/gone-file.png": GOOD, "/gone/new.png": GOOD, "/ok/live.png": GOOD}
    p = e.mirror(back, ["--retries", "0", "--restore-from", e.og.url("/nopages")])
    if p.returncode != 3: fail("entry ok thiếu file, khôi phục lỗi, nguồn gốc lỗi: MISSING, mã 3 như T-051 (Wayback không dùng để khôi phục entry ok), thấy %s; stderr %s" % (p.returncode, p.stderr[-200:]))
    ents = e.man()["entries"]
    for k in old:
        if ents[k] != old[k]: fail("entry ok cũ phải giữ từng trường: %s -> %s" % (old[k], ents[k]))
    if any(r["path"] in ("/ok/live.png", "/dead/gone-file.png") for r in e.wb.reqs): fail("entry ok (kể cả thiếu file) không được hỏi Wayback")
    if ents[u("/gone/new.png")].get("source") != "wayback": fail("URL mới vẫn được khôi phục từ Wayback")
    if "MISSING %s" % f_miss not in p.stdout: fail("phải in MISSING <file>")
    s = need_summary(p, "A")
    if s.get("missing") != "1" or s.get("wayback") != "1": fail("SUMMARY missing=1 wayback=1, thấy %s" % s)
finally:
    e.stop()

# B. tên file: URL dùng chung hai vendor -> id nhỏ nhất; chạy lại không tải gì; rewrite
e = Env(["/gone/shared.png"])
try:
    u = e.url
    from t065 import vendor, write_pool
    write_pool(e.pool, [vendor("marry_zzz", [u("/gone/shared.png")]), vendor("marry_aaa", [u("/gone/shared.png")]), vendor("marry_mmm", [u("/gone/keep.png"), u("/gone/other.png")])])
    e.wb.snaps = {"/gone/shared.png": GOOD, "/gone/other.png": ("img", GOOD[0], TS2)}
    p = e.mirror(back, ["--retries", "0"])
    en = e.man()["entries"][u("/gone/shared.png")]
    if en.get("file") != file_for("marry_aaa", u("/gone/shared.png")): fail("URL dùng chung: id vendor nhỏ nhất (marry_aaa), thấy %s" % en.get("file"))
    en2 = e.man()["entries"][u("/gone/other.png")]
    if en2.get("snapshot") != TS2: fail("snapshot theo từng URL")
    m1 = e.man_bytes(); files1 = {f: os.path.getmtime(os.path.join(e.out, f)) for f in (en["file"], en2["file"])}
    e.wb.reqs.clear(); e.og.hits.clear()
    p = e.mirror(back, ["--retries", "0"])
    s = need_summary(p, "B2")
    wbn = len([r for r in e.wb.reqs if r["path"] in ("/gone/shared.png", "/gone/other.png")])
    if wbn or e.og.count("/gone/shared.png") or e.og.count("/gone/other.png") or s.get("reused") != "2" or s.get("new") != "0":
        fail("chạy lại: entry ok qua Wayback không tải lại, không hỏi lại cả hai nguồn (reused=2 new=0 wayback=0); Wayback %d yêu cầu; SUMMARY %s" % (wbn, s))
    for f, t in files1.items():
        if os.path.getmtime(os.path.join(e.out, f)) != t: fail("không ghi lại file đã có")
    # nguồn gốc sống lại: entry ok qua Wayback không bị tải lại, không đổi source
    # rewrite: ảnh ok qua Wayback được thay bằng Pages URL
    from t051 import cli, run
    write_pool(e.pool, [vendor("marry_zzz", [u("/gone/shared.png")]), vendor("marry_aaa", [u("/gone/shared.png")]), vendor("marry_mmm", [u("/gone/keep.png"), u("/gone/other.png")])])
    r = run(cli(back) + ["rewrite", "--pool", e.pool, "--manifest", e.manifest])
    if r.returncode != 0: fail("rewrite phải chạy được với entry có source: " + r.stderr[-200:])
    pool, _ = read_pool(e.pool)
    urls = [p_["url"] for v in pool for p_ in v["photos"]]
    if urls.count(BASE_URL + "/" + en["file"]) != 2 or BASE_URL + "/" + en2["file"] not in urls or u("/gone/keep.png") not in urls: fail("rewrite đổi ảnh ok thành Pages URL, giữ ảnh lỗi: " + str(urls))
    r = run(cli(back) + ["rewrite", "--pool", e.pool, "--manifest", e.manifest, "--check"])
    if r.returncode != 0: fail("rewrite --check phải xanh sau rewrite")
finally:
    e.stop()

# C. nguồn gốc sống lại sau khi đã có ok qua Wayback: giữ nguyên (không đổi source, không đổi file)
e = Env(["/ok/live.png", "/ok/other.png"])
try:
    u = e.url
    f = file_for("marry_0001", u("/ok/other.png"))
    ent = ok_entry(f, source="wayback", snapshot=TS)
    write_manifest(e.manifest, {u("/ok/other.png"): ent})
    os.makedirs(os.path.join(e.out, "v"), exist_ok=True); open(os.path.join(e.out, f), "wb").write(WEBP)
    p = e.mirror(back, ["--retries", "0"])
    if e.man()["entries"][u("/ok/other.png")] != ent: fail("entry ok qua Wayback không bị đổi khi nguồn gốc sống lại: " + str(e.man()["entries"][u("/ok/other.png")]))
    if e.og.count("/ok/other"): fail("entry ok có file thì không tải lại từ nguồn gốc")
    if e.man()["entries"][u("/ok/live.png")].get("status") != "ok" or "source" in e.man()["entries"][u("/ok/live.png")]: fail("URL mới tải được từ nguồn gốc: không có source")
finally:
    e.stop()
ok("manifest: source/snapshot, tên file theo URL gốc, ok cũ không đổi và không hỏi Wayback, chạy lại không tải, rewrite dùng được")
