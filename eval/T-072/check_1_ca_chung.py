#!/usr/bin/env python3
"""T-072 tiêu chí 1: một file ca JSON chạy chung cho Node và Python; hai đường cho CÙNG điểm style ở mọi ca (và khớp giá trị kỳ vọng).
Repo sản phẩm: biến TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back (cùng quy ước INV của vùng). Mã thoát 0 = PASS."""
import json, os, subprocess, sys, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), os.path.join(HERE, "..", "..", "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))), None)
if not repo: print("FAIL không tìm thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(1)
cases = os.path.join(HERE, "style-cases.json")
C = json.load(open(cases, encoding="utf-8"))

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if p.returncode != 0: print("FAIL chạy lỗi " + cmd[0] + ": " + (p.stderr or p.stdout)[-200:]); sys.exit(1)
    return json.loads(p.stdout)

copy = os.path.join(repo, "test", "fixtures", "style-cases.json")
if not os.path.isfile(copy): print("FAIL repo chưa có test/fixtures/style-cases.json (bản chép nguyên văn của file ca)"); sys.exit(1)
h = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
if h(copy) != h(cases): print("FAIL test/fixtures/style-cases.json khác eval/T-072/style-cases.json"); sys.exit(1)

js = {r["id"]: r for r in run(["node", os.path.join(HERE, "lib", "run_js.mjs"), repo, cases, "cases"])}
py = {r["id"]: r for r in run(["python3", "-W", "ignore", "-I", os.path.join(HERE, "lib", "run_py.py"), repo, cases, "cases"])}
bad = []
for c in C["cases"]:
    j, p = js.get(c["id"], {}), py.get(c["id"], {})
    if "error" in j: bad.append(f'{c["id"]}: JS {j["error"]}'); continue
    if j.get("style") != c["style"]: bad.append(f'{c["id"]}: JS style={j.get("style")} cần {c["style"]}')
    if p.get("style") != c["style"]: bad.append(f'{c["id"]}: PY style={p.get("style")} cần {c["style"]}')
    if j.get("style") != p.get("style"): bad.append(f'{c["id"]}: JS và PY lệch nhau')
    cov = j.get("coverage")
    if cov != {"matched": c["matched"], "total": c["total"]}: bad.append(f'{c["id"]}: JS styleCoverage={cov} cần matched={c["matched"]} total={c["total"]}')
if bad: print("FAIL " + str(len(bad)) + " ca sai; đầu tiên: " + " | ".join(bad[:4])); sys.exit(1)
print(f"PASS {len(C['cases'])} ca, JS = PY = kỳ vọng")
