#!/usr/bin/env python3
"""T-136 tiêu chí 5: công cụ sinh file matcher TỪ CHỐI (thoát 1, không ghi/đổi file --out) khi (a) pool có id mà nguồn không có (sẽ làm matcher thiếu vendor app đang hiện),
(b) pool rỗng, (c) nguồn không đọc được / không có mảng vendors. File --out đã có sẵn thì giữ nguyên từng byte. Không mạng. In PASS / FAIL <lý do>."""
import os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
T = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools/scraper/build_pool.py"))), None)
if not T: print("PASS chưa áp dụng (thiếu repo tohong)"); sys.exit(0)
tool = os.path.join(T, "tools/scraper/build_matcher_vendors.py")
if not os.path.isfile(tool): print("FAIL chưa có tools/scraper/build_matcher_vendors.py"); sys.exit(1)
fx = lambda n: os.path.join(HERE, "fixtures", n); d = tempfile.mkdtemp()
bad = os.path.join(d, "rac.json"); open(bad, "w").write('{"khong":"co vendors"}')
for label, src, pool in (("pool có id thiếu ở nguồn", fx("source.json"), "pool_thieu_nguon.js"), ("pool rỗng", fx("source.json"), "pool_rong.js"), ("nguồn không có vendors", bad, "pool_ok.js"), ("nguồn không tồn tại", os.path.join(d, "khong-co.json"), "pool_ok.js")):
    out = os.path.join(d, "out.json"); open(out, "wb").write(b"CU")
    r = subprocess.run([sys.executable, "-I", tool, "--source", src, "--pool-js", fx(pool), "--out", out], cwd=T, capture_output=True, text=True)
    if r.returncode != 1: print(f"FAIL {label}: phải thoát 1, được {r.returncode}"); sys.exit(1)
    if open(out, "rb").read() != b"CU": print(f"FAIL {label}: file --out bị đổi"); sys.exit(1)
    if not (r.stdout + r.stderr).strip(): print(f"FAIL {label}: không nói lý do"); sys.exit(1)
print("PASS")
