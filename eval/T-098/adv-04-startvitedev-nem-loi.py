#!/usr/bin/env python3
"""T-098 adv-04 (adversary). Spec T-077 Hành vi 4 ("khi eval FAIL ... mục cache riêng bị xoá") + hợp đồng helper "dọn file thử" (INV-001 planner, T-053):
khi startViteDev NÉM LỖI (không trả stop), ngay sau khi lỗi tới tay người gọi, lúc tiến trình node vẫn còn sống, không còn mục nào của các lần thử dưới TMPDIR
và không còn file '__*' của helper trong repo.
Input biên: (a) vite.config.js ném lỗi khi nạp (vite thoát sớm, helper thử lại 3 lần); (b) repo không có node_modules/.bin/vite (spawn ENOENT, lỗi fatal).
Mã thoát 0 = đạt."""
import os, shutil, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)
errs = []
w = tempfile.mkdtemp(prefix="t098a4-")
try:
    f1 = a.front_copy(os.path.join(w, "f1"), lambda d: open(os.path.join(d, "vite.config.js"), "w").write("throw new Error('adv04 cau hinh hong')\n"))
    f2 = os.path.join(w, "f2"); shutil.copytree(a.FRONT, f2, ignore=shutil.ignore_patterns("node_modules", ".git", "dist"), symlinks=True)
    for name, f in (("config ném lỗi", f1), ("không có vite", f2)):
        t = os.path.join(w, "t-" + name.replace(" ", "_")); os.mkdir(t)
        r = a.run(f, t, w); e = []
        if r.get("ready"): e.append("startViteDev lẽ ra phải ném lỗi")
        if r.get("during_tmp"): e.append(f"sau khi ném lỗi (node còn sống) TMPDIR còn {r['during_tmp'][:3]}")
        if r.get("during_front"): e.append(f"sau khi ném lỗi repo còn {r['during_front'][:3]}")
        if r.get("left_tmp"): e.append(f"sau thoát TMPDIR còn {r['left_tmp'][:3]}")
        if e: errs.append(f"({name}) " + "; ".join(e))
finally: shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS startViteDev ném lỗi (config hỏng, thiếu vite): TMPDIR và repo sạch ngay khi lỗi tới người gọi")
