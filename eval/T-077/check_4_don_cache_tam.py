#!/usr/bin/env python3
"""T-077 tiêu chí 4: dọn cache tạm sau chạy. Với TMPDIR riêng của eval, ba tình huống (small_tile_tooltip trên front gốc): (a) chạy PASS; (b) chạy FAIL (bản sao đột biến mất title);
(c) bị SIGTERM giữa chừng (chỉ gửi tới tiến trình node chính, như `timeout`/Ctrl-C). Mỗi tình huống: (1) trong lúc chạy PHẢI thấy có cache riêng trong TMPDIR (nếu không thì chưa có gì để dọn: FAIL),
(2) sau khi tiến trình thoát và tiến trình con mang dấu bị dọn, TMPDIR không còn gì (trừ node-compile-cache của node), (3) front không còn file '__*' mới.
Chạy: python3 eval/T-077/check_4_don_cache_tam.py [--evalroot DIR] [--front DIR]. In PASS/FAIL; thoát 0/1."""
import sys, os, shutil, subprocess, signal, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import c, h
errs = []
def m2(d):
    p = os.path.join(d, "src/vendorIllustrations.jsx"); s = open(p, encoding="utf-8").read(); n = s.replace("title={chip ? undefined : label}", "title={undefined}")
    if n == s: raise RuntimeError("không phá được bản sao"); 
    open(p, "w", encoding="utf-8").write(n)
def scenario(name, front, tmp, term=False):
    p = subprocess.Popen(["node", c.STT, "--repo", front], env=c.env_tmp(tmp), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    seen = False; t0 = time.time(); termed = False
    while p.poll() is None and time.time() - t0 < 300:
        names = [n for n in c.left(tmp) if n not in ("front-ok", "front-m2")]
        if names and any(os.path.isdir(os.path.join(tmp, n)) for n in names): seen = True
        if term and seen and not termed and time.time() - t0 > 4:
            p.send_signal(signal.SIGTERM); termed = True
        time.sleep(0.2)
    if p.poll() is None:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
    p.wait()
    h.kill_pids(h.marked())  # chromium mồ côi sau SIGTERM không thuộc phần helper
    time.sleep(1.5)
    if not seen: errs.append(f"({name}) không thấy cache riêng nào trong TMPDIR lúc chạy: không có gì để dọn")
    rest = [n for n in c.left(tmp) if n not in ("front-ok", "front-m2")]
    if rest: errs.append(f"({name}) còn lại trong TMPDIR sau chạy: {rest[:3]}")
tmp = c.private_tmp(); snap0 = h.snapshot(c.FRONT)
try:
    scenario("a PASS", c.FRONT, tmp)
    d = c.front_copy(tmp, "front-m2", m2); scenario("b FAIL", d, tmp)
    scenario("c SIGTERM giữa chừng", c.FRONT, tmp, term=True)
    extra = h.snapshot(c.FRONT) - snap0
    if extra: errs.append(f"front còn file thử mới: {sorted(extra)[:3]}")
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(c.FRONT); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS cả ba tình huống (PASS, FAIL, SIGTERM): có cache riêng lúc chạy, TMPDIR sạch sau chạy, front không dư file")
