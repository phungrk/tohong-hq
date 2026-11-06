#!/usr/bin/env python3
"""T-072 tiêu chí 2: hai vendor giống hệt nhau, một có tag lệch, một không tag -> cùng tổng điểm (cả JS trên vendor thật của pool và Python).
Phụ: vendor khớp style có tổng điểm > cả hai. Mã thoát 0 = PASS."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), os.path.join(HERE, "..", "..", "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))), None)
if not repo: print("FAIL không tìm thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(1)
cases = os.path.join(HERE, "style-cases.json")
def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if p.returncode != 0: print("FAIL chạy lỗi " + cmd[0] + ": " + (p.stderr or p.stdout)[-200:]); sys.exit(1)
    return json.loads(p.stdout)
js = run(["node", os.path.join(HERE, "lib", "run_js.mjs"), repo, cases, "twins"])
py = run(["python3", "-W", "ignore", "-I", os.path.join(HERE, "lib", "run_py.py"), repo, cases, "twins"])
bad = []
for r in js:
    if "error" in r: bad.append("JS " + r["error"]); break
    if r["lech"] != r["khong_tag"]: bad.append(f'JS {r["cat"]}/{r["base"]}/{r["style"]}: lệch={r["lech"]} khác không-tag={r["khong_tag"]}')
    if not r["khop"] > r["lech"]: bad.append(f'JS {r["cat"]}/{r["base"]}/{r["style"]}: khớp={r["khop"]} không hơn lệch={r["lech"]}')
for r in py:
    if r["lech"] != r["khong_tag"]: bad.append(f'PY {r["style"]}: lệch={r["lech"]} khác không-tag={r["khong_tag"]}')
    if not r["khop"] > r["lech"]: bad.append(f'PY {r["style"]}: khớp={r["khop"]} không hơn lệch={r["lech"]}')
if bad: print(f"FAIL {len(bad)} ca sai; đầu tiên: " + " | ".join(bad[:3])); sys.exit(1)
print(f"PASS JS {len(js)} cặp, PY {len(py)} cặp")
