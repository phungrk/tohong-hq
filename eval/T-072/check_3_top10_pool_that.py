#!/usr/bin/env python3
"""T-072 tiêu chí 3: 6 style x {ảnh cưới, makeup, áo cưới, nhà hàng} trên pool thật (968 vendor), với từng hồ sơ trong pool_profiles:
top 10 chứa min(10, số vendor khớp) vendor khớp. Phụ: trên toàn danh sách không vendor khớp nào đứng sau vendor không khớp (JS); Python stage 2 giữ top_n cho vendor khớp.
'Khớp' do eval tự tính từ tag trong pool + bảng expansion của style-cases.json, không tin styleCoverage. Mã thoát 0 = PASS."""
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
js = run(["node", os.path.join(HERE, "lib", "run_js.mjs"), repo, cases, "pool"])
bad = [f'{r["style"]}/{r["cat"]}/{r["profile"]}: top10 có {r["got"]} khớp, cần {r["expected"]}' for r in js if r["got"] != r["expected"]]
bad += [f'{r["style"]}/{r["cat"]}/{r["profile"]}: vendor không khớp đứng trước vendor khớp' for r in js if r["tier_violated"]]
py = run(["python3", "-W", "ignore", "-I", os.path.join(HERE, "lib", "run_py.py"), repo, cases, "rank"])
miss = [f"m{i}" for i in range(3) if f"m{i}" not in py["ids"]]
if miss: bad.append("PY stage 2 top_n=20 làm rơi vendor khớp " + ",".join(miss))
if bad: print(f"FAIL {len(bad)} lỗi trên {len(js)} tổ hợp; đầu tiên: " + " | ".join(bad[:3])); sys.exit(1)
print(f"PASS {len(js)} tổ hợp pool thật + Python stage 2")
