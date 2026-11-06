#!/usr/bin/env python3
"""Nguồn: T-072 (spec products/T-072-hop-dong-style-chung.md v4, R3 + "Bất biến đề xuất" 1; qua Spec Gate 2026-11-06),
rút sau khi adversary accept T-080 (PR phungrk/tohong-back#39). CHỈ XANH SAU KHI PR #39 MERGE vào main.
INV-002 · Thiếu tag không bị phạt: hai vendor giống hệt nhau chỉ khác tag style, một tag lệch, một không tag, luôn cùng tổng điểm
ở cả hai đường (JS computeMatches trên vendor thật của pool, mọi hạng mục; Python compute_score), và vendor khớp gu luôn cao hơn cả hai.
Dùng bộ chạy eval/T-072/lib (run_js.mjs, run_py.py chế độ twins) và eval/T-072/style-cases.json.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Không có repo thì PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
T072 = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "T-072"))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))
             and os.path.isfile(os.path.join(c, "matcher", "matcher.py"))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy tohong-back)"); sys.exit(0)
cases = os.path.join(T072, "style-cases.json")
def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if p.returncode != 0: print("FAIL chạy lỗi " + os.path.basename(cmd[-3]) + ": " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
    return json.loads(p.stdout)
bad = []
for r in run(["node", os.path.join(T072, "lib", "run_js.mjs"), repo, cases, "twins"]):
    if "error" in r: bad.append("JS " + r["error"]); break
    if r["lech"] != r["khong_tag"]: bad.append(f'JS {r["cat"]}/{r["base"]}/{r["style"]}: lệch={r["lech"]} khác không-tag={r["khong_tag"]}')
    if not r["khop"] > r["lech"]: bad.append(f'JS {r["cat"]}/{r["base"]}/{r["style"]}: khớp={r["khop"]} không hơn lệch={r["lech"]}')
for r in run([sys.executable, "-W", "ignore", "-I", os.path.join(T072, "lib", "run_py.py"), repo, cases, "twins"]):
    if r["lech"] != r["khong_tag"]: bad.append(f'PY {r["style"]}: lệch={r["lech"]} khác không-tag={r["khong_tag"]}')
    if not r["khop"] > r["lech"]: bad.append(f'PY {r["style"]}: khớp={r["khop"]} không hơn lệch={r["lech"]}')
if bad: print(f"FAIL {len(bad)} vi phạm; " + " | ".join(bad[:3])); sys.exit(1)
print("PASS tag lệch = không tag (JS mọi hạng mục, Python), vendor khớp cao hơn")
