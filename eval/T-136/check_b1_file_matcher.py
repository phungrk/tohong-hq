#!/usr/bin/env python3
"""T-136 tiêu chí 4 (đồng bộ: định dạng + tập id). Chạy NGUYÊN VĂN công cụ sinh file matcher trên dữ liệu mẫu (không mạng, không Google, không GCS):
  python3 tools/scraper/build_matcher_vendors.py --source <pool-vendors.json> --pool-js <vendorPool.generated.js> --out <file>   (cwd = gốc repo tohong)
Mong: file = {"vendors":[...]} chỉ gồm vendor có id trong pool (đúng tập, không thừa không thiếu), mỗi vendor giữ NGUYÊN bản ghi nguồn (kể cả latitude/longitude/contact/reviews/verification_status),
thứ tự theo nguồn, hai lần chạy cho cùng byte (không dấu thời gian lúc chạy), và matcher thật (matcher/match.py load_vendors của tohong-back) nạp được.
Tự tìm repo: TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back. Thiếu repo: PASS chưa áp dụng. In PASS / FAIL <lý do>."""
import json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
def find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)): return os.path.abspath(c)
T = find("TOHONG_REPO", "tools/scraper/build_pool.py", "tohong"); B = find("TOHONG_BACK_REPO", "matcher/match.py", "tohong-back")
if not T or not B: print("PASS chưa áp dụng (thiếu repo tohong hoặc tohong-back)"); sys.exit(0)
tool = os.path.join(T, "tools/scraper/build_matcher_vendors.py")
if not os.path.isfile(tool): print("FAIL chưa có tools/scraper/build_matcher_vendors.py"); sys.exit(1)
fx = lambda n: os.path.join(HERE, "fixtures", n)
d = tempfile.mkdtemp(); o1, o2 = os.path.join(d, "a.json"), os.path.join(d, "b.json")
run = lambda pool, out: subprocess.run([sys.executable, "-I", tool, "--source", fx("source.json"), "--pool-js", fx(pool), "--out", out], cwd=T, capture_output=True, text=True)
r = run("pool_ok.js", o1)
if r.returncode != 0: print("FAIL công cụ thoát", r.returncode, (r.stderr or r.stdout)[-200:].replace("\n", " ")); sys.exit(1)
got = json.load(open(o1, encoding="utf-8")); src = json.load(open(fx("source.json"), encoding="utf-8"))["vendors"]
if not isinstance(got, dict) or not isinstance(got.get("vendors"), list): print('FAIL file phải là {"vendors":[...]}'); sys.exit(1)
want = [x for x in src if x["id"] in {"marry_aaaaaaaaaaa1", "marry_aaaaaaaaaaa2", "marry_aaaaaaaaaaa3"}]
if [x["id"] for x in got["vendors"]] != [x["id"] for x in want]: print("FAIL tập/thứ tự id sai:", [x["id"] for x in got["vendors"]]); sys.exit(1)
if got["vendors"] != want: print("FAIL bản ghi vendor bị đổi so với nguồn"); sys.exit(1)
if (got.get("stats") or {}).get("total") != 3: print("FAIL stats.total phải = 3"); sys.exit(1)
r2 = run("pool_ok.js", o2)
if r2.returncode != 0 or open(o1, "rb").read() != open(o2, "rb").read(): print("FAIL hai lần chạy khác byte"); sys.exit(1)
code = "import sys;sys.path.insert(0,%r);from match import load_vendors;v=load_vendors(%r);print(len(v),all(x.get('id') and x.get('categories') for x in v))" % (os.path.join(B, "matcher"), o1)
m = subprocess.run([sys.executable, "-I", "-c", code], capture_output=True, text=True)
if m.stdout.strip() != "3 True": print("FAIL matcher thật không nạp được file:", (m.stderr or m.stdout)[-200:].replace("\n", " ")); sys.exit(1)
print("PASS")
