#!/usr/bin/env python3
"""T-098 adv-02 (adversary). Spec T-077 Hành vi 1, 4, 5: cache riêng "dưới os.tmpdir() (theo TMPDIR)", trang chạy được, sạch sau stop().
Input biên: (a) TMPDIR có khoảng trắng và dấu tiếng Việt; (b) TMPDIR là symlink tới thư mục khác (như /var -> /private/var trên macOS).
Mong đợi mỗi ca: trang, module chính và mọi deps đã tối ưu trả 200; có deps/_metadata.json dưới TMPDIR lúc chạy; cache chung không đổi; TMPDIR (cả đích symlink) sạch; front không dư '__*'. Mã thoát 0 = đạt."""
import os, shutil, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)
errs = []
w = tempfile.mkdtemp(prefix="t098a2-")
try:
    sp = os.path.join(w, "tmp có khoảng trắng"); os.mkdir(sp)
    real = os.path.join(w, "real"); os.mkdir(real); ln = os.path.join(w, "link"); os.symlink(real, ln)
    for name, t, chk in (("khoảng trắng", sp, sp), ("symlink", ln, real)):
        r = a.run(a.FRONT, t, w)
        e = []
        if not r.get("ready"): e.append("không dựng được: " + str(r.get("err"))[:120])
        if a.bad_status(r): e.append(f"mã HTTP khác 200: {a.bad_status(r)}")
        if not r.get("cache_seen"): e.append("không có cache riêng dưới TMPDIR")
        if r.get("shared_changed"): e.append(f"cache chung đổi {len(r['shared_changed'])} mục")
        left = sorted(n for n in os.listdir(chk) if n not in a.IGNORE_TMP)
        if left: e.append(f"TMPDIR còn {left[:3]}")
        if r.get("left_front"): e.append(f"front dư {r['left_front'][:3]}")
        if e: errs.append(f"({name}) " + "; ".join(e))
finally: shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS TMPDIR có khoảng trắng và TMPDIR symlink: trang + deps 200, cache riêng, cache chung không đổi, sạch sau stop()")
