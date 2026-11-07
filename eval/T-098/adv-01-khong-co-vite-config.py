#!/usr/bin/env python3
"""T-098 adv-01 (adversary). Spec T-077 Hành vi 1+2: MỖI lần gọi startViteDev dùng cache riêng dưới os.tmpdir(), vite không sửa cache chung node_modules/.vite.
Input biên: repo front KHÔNG có vite.config.* (bản sao front gốc, node_modules symlink về front gốc như h.front_copy, xoá vite.config.js).
Mong đợi: lúc chạy có deps/_metadata.json dưới TMPDIR riêng; cache chung (realpath) không đổi; TMPDIR sạch sau stop(). Mã thoát 0 = đạt."""
import os, shutil, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)
w = tempfile.mkdtemp(prefix="t098a1-"); t = os.path.join(w, "t"); os.mkdir(t)
try:
    f = a.front_copy(os.path.join(w, "front"), lambda d: [os.remove(os.path.join(d, n)) for n in os.listdir(d) if n.startswith("vite.config.")])
    r = a.run(f, t, w)
finally: shutil.rmtree(w, ignore_errors=True)
errs = []
if not r.get("ready"): errs.append("không dựng được vite: " + str(r.get("err"))[:150])
if not r.get("cache_seen"): errs.append("lúc chạy không có cache vite riêng (deps/_metadata.json) dưới TMPDIR")
if r.get("shared_changed"): errs.append(f"cache chung node_modules/.vite bị đổi ({len(r['shared_changed'])} mục, vd {r['shared_changed'][:3]})")
if r.get("left_tmp"): errs.append(f"TMPDIR còn {r['left_tmp'][:3]}")
if errs: print("FAIL repo không có vite.config: " + " | ".join(errs)); sys.exit(1)
print("PASS repo không có vite.config: cache riêng dưới TMPDIR, cache chung không đổi, TMPDIR sạch")
