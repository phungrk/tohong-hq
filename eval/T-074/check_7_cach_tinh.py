#!/usr/bin/env python3
"""T-074 tiêu chí 7: cách tính đúng định nghĩa, đo QUA CÁC LỆNH (packets.mjs, match_eval.mjs) với một matcher giả trỏ bằng TOHONG_BACK
và người chấm giả có đáp án biết trước. Không import hàm nội bộ.
Pool giả: mỗi hạng mục 40 vendor f-<cat>-00..39 qua luật máy; vendor f-<cat>-PRICEY giá thấp nhất vượt ngân sách.
Đáp án giả: vendor số <5: cả 3 người co; số 5: 2 co 1 khong (đa số = co); số >=6: khong. Matcher giả đổi thứ tự theo FAKE_ORDER."""
import csv, hashlib, json, os, re, subprocess, sys, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CATS = ["photography", "makeup", "attire", "venue"]
def fail(m): print("FAIL " + m); sys.exit(1)
tmp = tempfile.mkdtemp()
back = os.path.join(tmp, "tohong-back"); os.makedirs(os.path.join(back, "lib"))
open(os.path.join(back, "package.json"), "w").write('{"type":"module"}')
open(os.path.join(back, "lib", "vendorMatcher.js"), "w").write('''
const CATS = @@CATS@@;
export const VENDOR_POOL = [];
for (const c of CATS) {
  for (let i = 0; i < 40; i++) VENDOR_POOL.push({ id: `f-${c}-${String(i).padStart(2, '0')}`, name: `Vendor ${c} ${i}`, category: c, city: 'HCMC', isVerified: true,
    rating: 4.5, reviewCount: 10, priceMin: 1, priceMax: 3, description: `mo ta ${i}`, photos: [] });
  VENDOR_POOL.push({ id: `f-${c}-PRICEY`, name: `Dat ${c}`, category: c, city: 'HCMC', isVerified: true, rating: 4.5, reviewCount: 10, priceMin: 999, priceMax: 999, description: 'dat', photos: [] });
}
const id = (c, i) => `f-${c}-${String(i).padStart(2, '0')}`;
export function computeMatches(p, { category, limit }) {
  const mode = process.env.FAKE_ORDER || 'asc', n = Number(p.id.slice(1));
  let order = Array.from({ length: 40 }, (_, i) => id(category, i));
  if (mode === 'desc') order = order.reverse();
  if (mode === 'pricey') order = [`f-${category}-PRICEY`, ...order];
  const swap = mode === 'bad15' ? 15 : mode === 'bad16' ? 16 : 0;   // hồ sơ P01..P<swap>: vendor số 4 bị thay bằng vendor số 10 (khong)
  if (swap && n <= swap) order[4] = id(category, 10);
  if (mode === 'worst') order = Array.from({ length: 40 }, (_, i) => id(category, 6 + i % 34));
  return { vendors: order.slice(0, limit).map((x) => ({ id: x })) };
}
'''.replace('@@CATS@@', json.dumps(CATS)))
env = dict(os.environ, TOHONG_BACK=back, T074_OUT=tmp)
def run(args, **kw):
    e = dict(env); e.update(kw.get("env", {}))
    r = subprocess.run(["node", "eval/T-074/" + args[0]] + args[1:], cwd=ROOT, capture_output=True, text=True, env=e)
    return r.returncode, (r.stdout + r.stderr)
def last(out): return [l for l in out.split("\n") if l.strip()][-1]
pk = os.path.join(tmp, "pk")
code, out = run(["packets.mjs", "make", "--graders", "3", "--out", pk], env={"FAKE_ORDER": "asc"})
if code: fail("make lỗi: " + out[-300:])
vid = lambda v: int(re.search(r"-(\d\d)$", v).group(1)) if re.search(r"-(\d\d)$", v) else 99
rows_total = 0
for g in (1, 2, 3):
    f = os.path.join(pk, f"G{g}.csv"); rows = list(csv.reader(open(f, encoding="utf-8")))
    for r in rows[1:]:
        if "PRICEY" in r[2]: fail("vendor trượt luật giá lọt vào gói chấm")
        n = vid(r[2]); r[-1] = "co" if n < 5 or (n == 5 and g != 3) else "khong"; rows_total += 1
    csv.writer(open(f, "w", encoding="utf-8", newline="")).writerows(rows)
json.dump({f"G{i}": {"is_external": True, "saw_system_scores": False, "touched_matching_weights": False} for i in (1, 2, 3)}, open(os.path.join(pk, "_private", "declarations.json"), "w"))
labels = os.path.join(tmp, "labels.json")
code, out = run(["packets.mjs", "import", "--dir", pk, "--out", labels])
if code: fail("import lỗi: " + out[-300:])
doc = json.load(open(labels))
if {g["relationship"] for g in doc["graders"]} != {"external"}: fail("import không lấy is_external từ khai báo")
bl = os.path.join(tmp, "baseline.json")
def ev(order, *extra):
    return run(["match_eval.mjs", "--labels", labels, "--baseline", bl, *extra], env={"FAKE_ORDER": order})
def rate(out, c):
    m = re.search(rf"^{c} +\d+ +\d+/\d+ +(\d+(?:\.\d)?)%", out, re.M); return float(m.group(1)) if m else None
# 1. Đa số 2/3 = phù hợp, hoà không có; asc: top 5 = số 0..4 -> 100%. Chưa có baseline: chỉ đo, PASS ghi rõ "baseline lần đầu", không ngưỡng.
code, out = ev("asc")
if code or not last(out).startswith("PASS baseline lần đầu"): fail("lần đầu phải PASS 'baseline lần đầu' (không ngưỡng): " + last(out))
for c in CATS:
    if rate(out, c) != 100.0: fail(f"{c}: top 5 toàn vendor 3/3 co phải ra 100%, ra {rate(out, c)}")
# 2. Ghi baseline; ghi lần hai bị từ chối
code, out = ev("asc", "--save-baseline")
if code or not os.path.exists(bl): fail("--save-baseline không ghi được baseline: " + last(out))
code, out = ev("asc", "--save-baseline")
if code == 0 or "không ghi đè" not in last(out): fail("ghi đè baseline phải bị từ chối: " + last(out))
code, out = ev("asc")
if code or not last(out).startswith("PASS không hạng mục nào tụt"): fail("so baseline giống hệt phải PASS: " + last(out))
# 3. Tụt đúng 10 điểm (15/150 vị trí, vendor số 10 = khong) thì đạt; 16/150 thì FAIL
code, out = ev("bad15")
if code or rate(out, "photography") != 90.0: fail(f"tụt đúng 10 điểm phải PASS, ra mã {code}, tỉ lệ {rate(out, 'photography')}: {last(out)}")
code, out = ev("bad16")
if code == 0 or not last(out).startswith("FAIL tụt quá 10"): fail("tụt 10,7 điểm phải FAIL 'tụt quá 10': " + last(out))
# 4. Tốt lên không bị chặn (baseline thấp hơn): dùng worst ghi baseline riêng
bl2 = os.path.join(tmp, "baseline2.json")
code, out = run(["match_eval.mjs", "--labels", labels, "--baseline", bl2, "--save-baseline"], env={"FAKE_ORDER": "worst"})
if code or rate(out, "makeup") != 0.0: fail("matcher xấu nhất phải ra 0% và vẫn ghi được baseline: " + last(out))
code, out = run(["match_eval.mjs", "--labels", labels, "--baseline", bl2], env={"FAKE_ORDER": "asc"})
if code or "+100.0" not in out: fail("tốt lên so với baseline phải PASS và in độ lệch dương: " + last(out))
# 5. Luật máy: vendor giá thấp nhất vượt ngân sách đứng đầu top 5 -> không phù hợp, vẫn nằm mẫu số: 4/5 = 80%, tụt 20 -> FAIL
code, out = ev("pricey")
if rate(out, "attire") != 80.0 or code == 0: fail(f"vendor trượt luật giá đầu top 5 phải ra 80% và FAIL tụt: tỉ lệ {rate(out, 'attire')}, {last(out)}")
# 6. Vendor top 5 chưa có nhãn (đảo ngược: top 5 = số 39..35, ngoài top 15 và gần như ngoài ngẫu nhiên): không được làm tỉ lệ tụt giả,
#    phải báo phủ nhãn thấp, FAIL cần chấm thêm, và ghi danh sách cần chấm
code, out = ev("desc")
if code == 0 or "phủ nhãn" not in last(out): fail("top 5 chưa có nhãn phải FAIL báo phủ nhãn: " + last(out))
if not os.path.exists(os.path.join(tmp, "t074-unlabeled.json")): fail("thiếu t074-unlabeled.json")
# vị trí chưa chấm không được tính là 'không phù hợp': tỉ lệ in ra chỉ trên vị trí đã chấm, nên không thể thấp giả; mẫu số (covered) < tổng 150
m = re.search(r"^venue +\d+ +(\d+)/(\d+) ", out, re.M)
if not m or int(m.group(2)) >= 150: fail("vị trí chưa chấm vẫn nằm trong mẫu số: " + (m.group(0) if m else out[-200:]))

# 7. Baseline vô hiệu khi nhãn đổi
doc["labels"][0]["fit"] = not doc["labels"][0]["fit"]; json.dump(doc, open(labels, "w"))
code, out = ev("asc")
if code == 0 or "baseline vô hiệu" not in last(out): fail("nhãn đổi sau baseline phải FAIL baseline vô hiệu: " + last(out))
print("PASS cách tính qua lệnh: đa số 2/3, luật máy loại vendor vượt giá, chưa chấm ra khỏi mẫu số và báo phủ nhãn, lần đầu chỉ đo, tụt đúng 10 điểm đạt/10,7 FAIL, tốt lên đạt, không ghi đè baseline, nhãn đổi vô hiệu baseline")
