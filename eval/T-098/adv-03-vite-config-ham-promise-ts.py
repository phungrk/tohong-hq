#!/usr/bin/env python3
"""T-098 adv-03 (adversary). Spec T-077 Hành vi 1, 2, 5: cache riêng mọi lần chạy, kết quả không đổi; vite.config hợp lệ ở mọi dạng vite cho phép.
Input biên (bản sao front, node_modules symlink): vite.config.js dạng (a) hàm đồng bộ ({command, mode}) => ({...}), (b) hàm async,
(c) export default Promise, (d) vite.config.ts (đổi tên), (e) base config đã có cacheDir riêng trỏ vào node_modules/.vite-khac (helper phải ghi đè).
Mong đợi mỗi ca: trang + deps 200, define __APP_VERSION__ vẫn áp dụng (module chính 200), cache riêng dưới TMPDIR, cache chung không đổi, TMPDIR sạch, không dư '__*'. Mã thoát 0 = đạt."""
import os, shutil, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)
SRC = open(os.path.join(a.FRONT, "vite.config.js"), encoding="utf-8").read()
OBJ = SRC.split("export default defineConfig(", 1)[1].rsplit(")", 1)[0]
HEAD = SRC.split("export default", 1)[0]
CASES = {
    "hàm": ("vite.config.js", HEAD + "export default ({ command, mode }) => (" + OBJ + ")\n"),
    "hàm async": ("vite.config.js", HEAD + "export default async ({ command, mode }) => { await new Promise(r => setTimeout(r, 50)); return (" + OBJ + ") }\n"),
    "Promise": ("vite.config.js", HEAD + "export default new Promise(r => setTimeout(() => r(" + OBJ + "), 50))\n"),
    "ts": ("vite.config.ts", SRC),
    "base có cacheDir": ("vite.config.js", SRC.replace("defineConfig({", "defineConfig({\n  cacheDir: 'node_modules/.vite-adv03',", 1)),
}
errs = []
w = tempfile.mkdtemp(prefix="t098a3-")
try:
    for name, (fn, body) in CASES.items():
        d = os.path.join(w, "f-" + str(len(errs)) + "-" + fn + name.replace(" ", "_"))
        def mut(x, fn=fn, body=body):
            os.remove(os.path.join(x, "vite.config.js")); open(os.path.join(x, fn), "w", encoding="utf-8").write(body)
        f = a.front_copy(d, mut)
        t = os.path.join(w, "t-" + name.replace(" ", "_")); os.mkdir(t)
        r = a.run(f, t, w); e = []
        if not r.get("ready"): e.append("không dựng được: " + str(r.get("err"))[:120])
        if a.bad_status(r): e.append(f"HTTP khác 200: {a.bad_status(r)}")
        if not r.get("cache_seen"): e.append("không có cache riêng dưới TMPDIR")
        if r.get("shared_changed"): e.append(f"cache chung đổi {len(r['shared_changed'])} mục")
        if os.path.isdir(os.path.join(a.FRONT, "node_modules", ".vite-adv03")): e.append("vite ghi vào cacheDir của base config"); shutil.rmtree(os.path.join(a.FRONT, "node_modules", ".vite-adv03"), ignore_errors=True)
        if r.get("left_tmp"): e.append(f"TMPDIR còn {r['left_tmp'][:3]}")
        if r.get("left_front"): e.append(f"front dư {r['left_front'][:3]}")
        if e: errs.append(f"({name}) " + "; ".join(e))
finally: shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print(f"PASS {len(CASES)} dạng vite.config (hàm, hàm async, Promise, .ts, base có cacheDir): trang + deps 200, cache riêng, cache chung không đổi, sạch")
