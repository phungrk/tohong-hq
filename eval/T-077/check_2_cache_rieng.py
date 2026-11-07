#!/usr/bin/env python3
"""T-077 tiêu chí 2: mỗi lần chạy helper vite dùng cache riêng, không dùng cache chung node_modules/.vite. Quan sát được từ ngoài, không cần biết cách cài:
hai lần chạy chồng (small_tile_tooltip trên front gốc, C10 trên bản sao) với TMPDIR riêng của eval. Phải thấy (a) trong lúc chạy, TMPDIR có >= 2 thư mục cache khác tên (mỗi lần chạy một),
mỗi cái là một cache vite thật (có deps/_metadata.json, tức vite đã ghi vào đó); (b) cache chung của front gốc (realpath node_modules/.vite) không thêm/bớt/đổi file nào trước và sau.
Hợp đồng quan sát: cache riêng nằm trong thư mục tạm của hệ thống (os.tmpdir(), theo TMPDIR). Chạy: python3 eval/T-077/check_2_cache_rieng.py [--evalroot DIR] [--front DIR]. In PASS/FAIL; thoát 0/1."""
import sys, os, shutil, threading, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import c, h
tmp = c.private_tmp(); seen = {}; errs = []; done = threading.Event(); res = {}
def poll():
    while not done.is_set():
        for n in c.vite_caches(tmp): seen[n] = True
        time.sleep(0.2)
try:
    cp = c.front_copy(tmp, "front-x")
    before = c.cache_state(c.FRONT)
    pt = threading.Thread(target=poll); pt.start()
    ta = threading.Thread(target=lambda: res.__setitem__("A", c.run_c10(cp, tmp)[0])); tb = threading.Thread(target=lambda: res.__setitem__("B", c.run_stt(c.FRONT, tmp)[0]))
    ta.start(); tb.start(); ta.join(); tb.join(); done.set(); pt.join()
    after = c.cache_state(c.FRONT)
finally:
    done.set(); h.kill_pids(h.marked()); h.rm_probe_files(c.FRONT); shutil.rmtree(tmp, ignore_errors=True)
full = sorted(seen)
if len(full) < 2: errs.append(f"trong lúc hai lần chạy chồng chỉ thấy {len(full)} thư mục cache vite riêng (có deps/_metadata.json) trong TMPDIR, cần >= 2, mỗi lần chạy một")
ch = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
if ch: errs.append(f"cache chung node_modules/.vite bị ghi trong lúc chạy ({len(ch)} mục đổi, vd {ch[:3]})")
for k in ("A", "B"):
    if not res.get(k, "").startswith("PASS"): errs.append(f"lần chạy {k} không PASS ({res.get(k, '')[:80]}): không đo được cache")
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print(f"PASS {len(full)} cache riêng khác tên trong TMPDIR, cache chung không đổi ({len(before)} mục)")
