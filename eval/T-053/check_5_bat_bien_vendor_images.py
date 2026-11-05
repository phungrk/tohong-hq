#!/usr/bin/env python3
"""T-053 (ADR-024) tiêu chí 5: hai bất biến vendor-images (lib/vendor_img_inv.cjs --only 1, lib/small_tile_tooltip.cjs) đổi sang helper mà kết quả không đổi và không để lại vite:
(a) PASS trên front main khi vite lạ chiếm cả dải cổng cũ; (b) vẫn FAIL trên bản front bị phá có chủ đích; (c) mỗi lần chạy xong không còn vite do eval tạo.
Gọi thẳng file lib với --repo (các .sh bọc ngoài 'chưa áp dụng' khi repo không có git, bản sao bị phá không có git). In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, shutil, re, subprocess, signal
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
front = sys.argv[sys.argv.index("--front") + 1] if "--front" in sys.argv else h.FRONT
L = os.path.join(h.HQ, "eval/invariants/planner/front/vendor-images/lib")
RUNS = (("INV-vendor_img_inv", [os.path.join(L, "vendor_img_inv.cjs"), "--only", "1"]), ("INV-small_tile_tooltip", [os.path.join(L, "small_tile_tooltip.cjs")]))

def run(argv, repo, timeout=300):
    p = subprocess.Popen(["node"] + argv + ["--repo", repo], env=h.env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try: out, _ = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, signal.SIGKILL)
        except OSError: pass
        out, _ = p.communicate(); out += "\nFAIL quá hạn"
    ls = [l for l in out.strip().splitlines() if l.strip()]
    return ls[-1] if ls else "FAIL không có output"

def mutate(dst):
    f = os.path.join(dst, "src/vendorImages.js"); s = open(f, encoding="utf-8").read()
    n = re.sub(r"return \{ isGood: \(url\) => results\.get\(url\) === true, isBad: \(url\) => results\.get\(url\) === false \};", "return { isGood: () => true, isBad: () => false };", s)
    if n == s: raise RuntimeError("vendorImages.js đã đổi dạng, cập nhật mutate()")
    open(f, "w", encoding="utf-8").write(n)

base = set(h.vite_pids(front)); errs = []; tmp = h.scratch(); dst = os.path.join(tmp, "front-hong")
def leak(label):
    new = {p: c for p, c in h.vite_pids(front).items() if p not in base} | {p: c for p, c in (h.vite_pids(dst).items() if os.path.isdir(dst) else [])}
    if new: errs.append(f"{label}: còn {len(new)} vite ({next(iter(new.values()))[:60]})"); h.kill_pids(new)
try:
    with h.Decoy() as d:
        for name, argv in RUNS:
            line = run(argv, front)
            if not line.startswith("PASS"): errs.append(f"{name} trên main (vite lạ chiếm dải cổng) đáng ra PASS, thấy: {line[:100]}")
            import time; time.sleep(1.5); leak(f"{name} chạy xong")
    h.front_copy(dst, mutate)
    for name, argv in RUNS:
        line = run(argv, dst)
        if not line.startswith("FAIL"): errs.append(f"{name} trên bản front bị phá đáng ra FAIL, thấy: {line[:100]}")
        import time; time.sleep(1.5); leak(f"{name} (bản bị phá) chạy xong")
finally:
    h.kill_pids(set(h.vite_pids(front)) - base)
    if os.path.isdir(dst): h.kill_pids(h.vite_pids(dst))
    for f in os.listdir(front):
        if f.startswith(("__vimg", "__inv004")): os.unlink(os.path.join(front, f))
    shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS hai bất biến vendor-images: PASS trên main, FAIL trên bản bị phá, không để lại vite")
