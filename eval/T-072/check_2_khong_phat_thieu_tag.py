#!/usr/bin/env python3
"""T-072 tiêu chí 2 + 3a (ADR-026): hai vendor giống hệt nhau, một có tag lệch, một không tag -> cùng tổng điểm (JS trên vendor thật của pool, Python).
3a: vendor khớp có tổng điểm > cả hai VÀ đứng trên cả hai trong danh sách trả về (đo thứ tự, không chỉ điểm):
  JS = danh sách đầy đủ của hạng mục (pool thật + 3 anh em); Python = stage 2 (score_and_rank) và đường chat đầy đủ qua MMR (stage 3).
Luật R8 cho đường chat (một luật, đo trên hai ca): giữa một vendor khớp và một vendor không khớp, vendor có điểm sau boost cao hơn đứng trên (bằng điểm thì vendor khớp đứng trên).
  Ca sinh đôi: 4 vendor khớp cùng tag + 4 không khớp, điểm khớp cao hơn -> mọi vendor khớp phải đứng trước (loại MMR gốc).
  Ca ngược (Spec critic, D2): 6 vendor khớp điểm thấp (vượt ngân sách, rating 3,6) + 6 không khớp điểm cao (đúng ngân sách, rating 4,9), top 5 -> vendor không khớp phải đứng trên
  (loại cách chia nhóm "khớp lên trước"). Mã thoát 0 = PASS."""
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
    o = r.get("order", [])
    if o and not (o.index("twin_m") < o.index("twin_a") and o.index("twin_m") < o.index("twin_b")): bad.append(f'JS {r["cat"]}/{r["base"]}/{r["style"]}: thứ tự {o}, vendor khớp không đứng đầu')
for r in py:
    if r["lech"] != r["khong_tag"]: bad.append(f'PY {r["style"]}: lệch={r["lech"]} khác không-tag={r["khong_tag"]}')
    if not r["khop"] > r["lech"]: bad.append(f'PY {r["style"]}: khớp={r["khop"]} không hơn lệch={r["lech"]}')
rk = run(["python3", "-W", "ignore", "-I", os.path.join(HERE, "lib", "run_py.py"), repo, cases, "rank"])
if rk["stage2"][0] != "M" : bad.append(f'PY stage 2: thứ tự {rk["stage2"]}, vendor khớp M không đứng đầu')
def cross_violations(name, lst):
    # R8 đường chat: giữa vendor khớp (id bắt đầu m) và không khớp (u), vendor điểm sau boost cao hơn đứng trên; bằng điểm thì vendor khớp đứng trên.
    out = []
    for i, (x, sx) in enumerate(lst):
        for y, sy in lst[i + 1:]:
            if x[0] == y[0]: continue
            if sx < sy or (sx == sy and x.startswith("u")): out.append(f"{name}: {x}({sx}) đứng trên {y}({sy}) trái thứ tự điểm")
    return out
pl = rk["pipeline"]
if sum(1 for x, _ in pl if x.startswith("m")) != 4: bad.append(f"PY đường chat (sinh đôi): top 6 chỉ có {sum(1 for x, _ in pl if x.startswith('m'))}/4 vendor khớp ({[x for x, _ in pl]})")
bad += cross_violations("PY đường chat (sinh đôi)", pl)
ng = rk["nguoc"]
if len(ng) != 5: bad.append(f"PY đường chat (ngược): trả {len(ng)} vendor, cần 5")
bad += cross_violations("PY đường chat (ngược)", ng)
if bad: print(f"FAIL {len(bad)} ca sai; đầu tiên: " + " | ".join(bad[:3])); sys.exit(1)
print(f"PASS JS {len(js)} cặp (điểm + thứ tự), PY {len(py)} cặp, PY stage 2 + đường chat (ca sinh đôi + ca ngược)")
