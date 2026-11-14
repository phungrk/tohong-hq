#!/usr/bin/env python3
"""Nguồn: T-159 (spec products/T-159-ghep-vendor-theo-bang-du-toan.md v2, H1-H5, H7, "Bất biến đề xuất" INV-H; handoffs/T-159-D1.md, T-159-v2.md),
qua Spec Gate 2026-11-14 (spec-critic). Nằm ở eval/T-159/bat-bien-cho-merge/ cho tới khi PR code T-159 merge, sau đó chuyển vào
eval/invariants/planner/vendor/images/ (đỏ trước khi có code là đúng).
INV-H · allocated_tr > 0 trong bảng dự toán là nguồn ngân sách hạng mục của CẢ chat và tab Vendor, và tab dùng MỘT số cho mọi thứ hiển thị;
đọc bảng lỗi không ném. Hồ sơ tổng 300tr (tổng x tỷ lệ ảnh cưới = 30tr):
 (1) chat: 6 vendor ảnh priceMin 38; phân bổ ảnh 40tr -> 5 ứng viên; phân bổ 20tr -> 0 (nới x1,2 = 24 chưa tới 38);
 (2) tab /match: vendor priceMax 12 / 30; phân bổ ảnh 20tr -> điểm ngân sách 1 / 0, câu dưới danh sách "khoảng 20tr cho", chip "Rẻ hơn 8tr";
 (3) bảng hỏng (không phải JSON) hoặc R2 ném khi đọc bảng -> chat và tab không ném, HTTP 200, rơi về tổng x tỷ lệ (chat 5 ứng viên với priceMin 28; tab điểm 1 với priceMax 30).
Dùng eval/T-159/_lib.mjs (pool đông cứng eval/T-140/fixtures/pool-frozen.json, R2 giả trong bộ nhớ, mọi fetch bị cấm).
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo. Chạy không tham số (python3 -I), từ cwd nào cũng được."""
import json, os, subprocess, sys, tempfile

HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # tìm gốc tohong-hq ở mọi độ sâu
    HQ = os.path.dirname(HQ)
if HQ == "/":
    print("FAIL không tìm thấy gốc tohong-hq (scripts/gate.py)"); sys.exit(1)
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-back"))
          if c and os.path.isfile(os.path.join(c, "lib", "contextBuilder.js"))), None)
if not B:
    print("PASS chưa áp dụng (thiếu tohong-back)"); sys.exit(0)
LIB = os.path.join(HQ, "eval", "T-159", "_lib.mjs")
if not os.path.isfile(LIB):
    print("FAIL thiếu " + LIB); sys.exit(1)

JS = r'''
const L = await import(__LIB__);
const { loadBack, chat, tabMatch, eligible, overlayKeep, keepPrice, doc, coupleProfile, budgetScoreOf, BUDGET_KEY, done } = L;
const M = await loadBack(); const fails = [];
const P = coupleProfile({ budget: 300 });
const six = eligible(M, "photography").slice(0, 6);
if (six.length < 6) { console.log("FAIL pool đông cứng thiếu vendor ảnh"); process.exit(1); }
// (1) chat
for (const [a, n] of [[40, 5], [20, 0]]) {
  const r = await chat(M, { profile: P, budgetDoc: doc({ photography: a }), overlay: overlayKeep(M, "photography", keepPrice(six, 38, 39)) });
  if (r.err) fails.push(`(1) chat phân bổ ${a}tr: ném ${r.err.message}`); else if (r.ids.length !== n) fails.push(`(1) chat phân bổ ${a}tr: ${r.ids.length} ứng viên, mong ${n}`);
}
// (2) tab: điểm, câu, chip theo cùng một số
{
  const [X, Y] = six;
  const ov = overlayKeep(M, "photography", [{ id: X.id, priceMin: 8, priceMax: 12 }, { id: Y.id, priceMin: 10, priceMax: 30 }]);
  const r = await tabMatch(M, "photography", { profile: P, budgetDoc: doc({ photography: 20 }), overlay: ov });
  if (r.err || r.status !== 200) fails.push(`(2) tab lỗi ${r.err?.message || r.status}`);
  else {
    const sx = budgetScoreOf(r, X.id), sy = budgetScoreOf(r, Y.id);
    if (sx !== 1 || sy !== 0) fails.push(`(2) tab điểm ngân sách ${sx}/${sy}, mong 1/0`);
    const s = r.body?.whyThoseVendors || "";
    if (!/khoảng 20tr cho/.test(s)) fails.push(`(2) câu dưới danh sách "${s.slice(0, 70)}" không chứa "khoảng 20tr cho"`);
    const labels = (r.body?.vendors?.find((v) => v.id === X.id)?.match?.reasons || []).map((x) => x.label || x);
    if (!labels.includes("Rẻ hơn 8tr")) fails.push(`(2) chip của vendor priceMax 12: ${JSON.stringify(labels)}, mong có "Rẻ hơn 8tr"`);
  }
}
// (3) bảng hỏng / R2 ném: không ném, rơi về tổng x tỷ lệ
{
  const v = six[0];
  const boom = (k) => { if (k === BUDGET_KEY) throw new Error("R2 sập (INV-H)"); };
  for (const [label, o] of [["bảng không phải JSON", { budgetDoc: "{hỏng" }], ["R2 ném khi đọc bảng", { onGet: boom }]]) {
    const c = await chat(M, { profile: P, overlay: overlayKeep(M, "photography", keepPrice(six, 28, 29)), ...o });
    if (c.err) fails.push(`(3) chat, ${label}: ném ${c.err.message}`); else if (c.ids.length !== 5) fails.push(`(3) chat, ${label}: ${c.ids.length} ứng viên, mong 5`);
    const t = await tabMatch(M, "photography", { profile: P, overlay: overlayKeep(M, "photography", [{ id: v.id, priceMin: 10, priceMax: 30 }]), ...o });
    if (t.err || t.status !== 200) fails.push(`(3) tab, ${label}: lỗi ${t.err?.message || t.status}`); else if (budgetScoreOf(t, v.id) !== 1) fails.push(`(3) tab, ${label}: điểm ${budgetScoreOf(t, v.id)}, mong 1`);
  }
}
done(fails);
'''

from urllib.parse import quote
js = JS.replace("__LIB__", json.dumps("file://" + quote(LIB)))
env = dict(os.environ, TOHONG_BACK_REPO=B)
with tempfile.TemporaryDirectory(prefix="inv-h-") as d:
    f = os.path.join(d, "inv_h.mjs")
    with open(f, "w", encoding="utf-8") as fh:
        fh.write(js)
    try:
        p = subprocess.run(["node", f], cwd=HQ, env=env, capture_output=True, text=True, timeout=600)
    except Exception as e:
        print(f"FAIL không chạy được node: {e}"); sys.exit(1)
lines = (p.stdout or "").strip().splitlines()
last = lines[-1] if lines else (p.stderr or "").strip()[-300:]
if p.returncode == 0 and last.startswith("PASS"):
    print("PASS INV-H " + last); sys.exit(0)
print("FAIL INV-H " + last[:600]); sys.exit(1)
