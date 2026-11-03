#!/usr/bin/env python3
"""T-051 tiêu chí 4: chạy lại được (idempotent): lần hai không tải lại ảnh đã xong; thêm ảnh mới chỉ tải ảnh mới; máy sạch khôi phục ảnh từ Pages.
Chạy: python3 eval/T-051/check_4_chay_lai.py --back /đường/dẫn/tohong-back. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, json, shutil, hashlib
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *

def snap(d):
    r = {}
    for root, _, fs in os.walk(d):
        for f in fs:
            if f == '_headers': continue
            p = os.path.join(root, f); r[os.path.relpath(p, d)] = (hashlib.sha256(open(p, "rb").read()).hexdigest(), os.stat(p).st_mtime_ns)
    return r

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")
w = Work()
pages = None
try:
    s1 = need_summary(w.mirror(back), "lần 1")
    if s1["new"] != len(OK_URLS) or s1["ok"] != len(OK_URLS) or s1["failed"] != len(BAD_URLS) or s1["total"] != len(OK_URLS) + len(BAD_URLS):
        fail(f"lần 1: SUMMARY sai {s1} (cần total={len(OK_URLS)+len(BAD_URLS)} ok={len(OK_URLS)} new={len(OK_URLS)} failed={len(BAD_URLS)})")
    files1, man1 = snap(w.out), w.man()
    hits1 = dict(w.fm.hits)
    s2 = need_summary(w.mirror(back), "lần 2")
    if s2["new"] != 0 or s2["reused"] != len(OK_URLS): fail(f"lần 2 phải new=0 reused={len(OK_URLS)}, thấy {s2}")
    for p in OK_URLS:
        if w.fm.hits.get(p, 0) != hits1.get(p, 0): fail(f"lần 2 tải lại ảnh đã xong {p}")
    if snap(w.out) != files1: fail("lần 2 ghi lại/đổi file ảnh đã có (nội dung hoặc mtime)")
    man2 = w.man()
    for u, e in man1["entries"].items():
        if e["status"] == "ok" and man2["entries"][u] != e: fail(f"lần 2 đổi entry ok của {u}")
    # thêm vendor có ảnh mới: chỉ ảnh đó được tải
    w.fm.hits.clear()
    vs = w.vendors + [vendor("marry_fff000000006", [w.fm.url("/ok/late.jpg")])]
    w.fm.late_ready = True
    write_pool(w.pool, vs)
    s3 = need_summary(w.mirror(back), "lần 3")
    if s3["new"] != 1: fail(f"lần 3 chỉ 1 ảnh mới, thấy new={s3['new']}")
    for p in OK_URLS:
        if w.fm.hits.get(p, 0): fail(f"lần 3 tải lại ảnh đã xong {p}")
    # máy sạch (Actions): thư mục ra rỗng, ảnh có sẵn trên "Pages" -> khôi phục từ Pages (--restore-from), không đụng tới nguồn
    pages = FakePages(w.out)
    out2 = os.path.join(w.tmp, "out2"); w.fm.hits.clear()
    s4 = need_summary(w.mirror(back, out=out2, extra=["--restore-from", pages.origin]), "lần 4 (máy sạch)")
    nok = s3["ok"]
    if s4["restored"] != nok or s4["new"] != 0: fail(f"máy sạch phải restored={nok} new=0, thấy {s4}")
    for p in OK_URLS + ["/ok/late.jpg"]:
        if w.fm.hits.get(p, 0): fail(f"máy sạch tải lại từ nguồn {p} thay vì khôi phục từ Pages")
    for e in w.man()["entries"].values():
        if e["status"] == "ok" and not os.path.isfile(os.path.join(out2, e["file"])): fail("máy sạch: thiếu file " + e["file"])
    # lần chạy THẬT thứ hai trong đời: pool đã được rewrite (URL là Pages) -> mirror không coi URL Pages là nguồn, vẫn dựng đủ thư mục ra cho deploy
    if w.rewrite(back).returncode != 0: fail("rewrite lỗi")
    w.fm.hits.clear(); out3 = os.path.join(w.tmp, "out3"); before_m = w.man()["entries"]
    s5 = need_summary(w.mirror(back, out=out3, extra=["--restore-from", pages.origin]), "lần 5 (pool đã rewrite)")
    if s5["new"] != 0 or s5["restored"] != nok: fail(f"pool đã rewrite: phải new=0 restored={nok}, thấy {s5}")
    for p in OK_URLS + ["/ok/late.jpg"]:
        if w.fm.hits.get(p, 0): fail(f"pool đã rewrite: tải lại ảnh đã xong {p}")
    man5 = w.man()["entries"]
    for u, e in before_m.items():
        if e["status"] == "ok" and man5.get(u) != e: fail("pool đã rewrite: manifest mất/đổi entry ok của " + u)
    for e in man5.values():
        if e["status"] == "ok" and not os.path.isfile(os.path.join(out3, e["file"])): fail("pool đã rewrite: thư mục ra thiếu " + e["file"])
    # rewrite hai lần = một lần (đã kiểm ở tiêu chí 1)
    ok("chạy lại: 0 yêu cầu thừa, file không đổi, ảnh mới chỉ tải 1 lần, máy sạch khôi phục từ Pages")
finally:
    if pages: pages.stop()
    w.stop()
