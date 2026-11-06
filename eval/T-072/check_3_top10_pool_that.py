#!/usr/bin/env python3
"""T-072 tiêu chí 3b (ADR-026): 6 style x {ảnh cưới, makeup, áo cưới, nhà hàng} x 4 hồ sơ trên pool thật (968 vendor, JS).
Với mỗi tổ hợp, đếm vendor khớp (eval tự tính từ tag trong pool + bảng expansion, không tin styleCoverage) trong top 10 trả về.
So với baseline-top10.json (đo trên code trước T-072). PASS khi TỔNG số vendor khớp trong top 10 trên 96 tổ hợp không ít hơn baseline.
Lưu ý (đã chạy thử, xem spec): luật cộng điểm không giữ được "mỗi tổ hợp không ít hơn" (tag lệch hết bị phạt 0 nên cạnh tranh được hơn); tổng thì giữ được.
In kèm danh sách tổ hợp tụt để Capu thấy, không tính là lỗi. Mã thoát 0 = PASS."""
import hashlib, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), os.path.join(HERE, "..", "..", "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))), None)
if not repo: print("FAIL không tìm thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(1)
cases = os.path.join(HERE, "style-cases.json")
base = json.load(open(os.path.join(HERE, "baseline-top10.json"), encoding="utf-8"))
sha = hashlib.sha256(open(os.path.join(repo, "lib", "vendorPool.generated.js"), "rb").read()).hexdigest()
if sha != base["pool_sha256"]: print("FAIL baseline-top10.json đo trên pool khác (sha lệch): Product phải đo lại baseline trên bản trước thay đổi"); sys.exit(1)
p = subprocess.run(["node", os.path.join(HERE, "lib", "run_js.mjs"), repo, cases, "pool"], capture_output=True, text=True, timeout=300)
if p.returncode != 0: print("FAIL chạy lỗi node: " + (p.stderr or p.stdout)[-200:]); sys.exit(1)
js = json.loads(p.stdout)
keys = [f'{r["profile"]}|{r["style"]}|{r["cat"]}' for r in js]
missing = [k for k in keys if k not in base["counts"]]
if missing or len(js) != len(base["counts"]): print(f"FAIL lưới {len(js)} tổ hợp không khớp baseline {len(base['counts'])}"); sys.exit(1)
before = sum(base["counts"][k] for k in keys); after = sum(r["got"] for r in js)
down = [f'{r["style"]}/{r["cat"]}/{r["profile"]}:{base["counts"][k]}->{r["got"]}' for r, k in zip(js, keys) if r["got"] < base["counts"][k]]
if after < before: print(f"FAIL tổng vendor khớp trong top 10 tụt: {before} -> {after} trên {len(js)} tổ hợp; {len(down)} tổ hợp tụt, vd " + " | ".join(down[:3])); sys.exit(1)
print(f"PASS tổng vendor khớp trong top 10: {before} -> {after} trên {len(js)} tổ hợp (thông tin: {len(down)} tổ hợp tụt riêng lẻ)")
