#!/usr/bin/env python3
"""Tầng 3 (adversary, T-080). R1/R2/R5/R6 ở đường JS trên input biên mà check_1/check_4 không chạm:
  - cặp đôi '  KOREAN ' + 'korean' (trùng sau chuẩn hoá), vendor 'Soft ': khớp, coverage {1,1}, nói "Hàn Quốc", không "soft"/"nhẹ nhàng";
  - style lạ không có nhãn ('boho' / vendor 'Boho '): khớp (R2 không danh sách trắng), coverage {1,1}, KHÔNG in 'boho' ở đâu;
  - một chiều: cặp đôi 'minimalist', vendor 'modern': không khớp, style 0.5, không chữ gu/phong cách/style;
  - formatMatchBlock: style_preferences ['  Korean '], style_tags ['SOFT'] -> "Phù hợp vì" có "Hàn Quốc", không tag thô;
    style_tags null / thiếu khoá: không lỗi, không chữ gu/phong cách/style.
Repo: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Mã thoát 0 = đạt."""
import json, os, subprocess, sys, tempfile

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))), None)
if not repo: print("ERROR không tìm thấy tohong-back/lib"); sys.exit(2)

JS = r'''
import path from "node:path"; import { pathToFileURL } from "node:url";
const repo = process.argv[2];
const { computeMatches } = await import(pathToFileURL(path.join(repo, "lib/vendorMatcher.js")).href);
const { formatMatchBlock } = await import(pathToFileURL(path.join(repo, "lib/matchFormatter.js")).href);
const bad = [];
const mk = (id, tags) => ({ id, name: "Vendor Thử " + id, category: "photography", catLabel: "Chụp ảnh", catIcon: "camera", description: "",
  styles: tags, tags, priceMin: 10, priceMax: 20, city: "HCMC", rating: 4.5, reviewCount: 60, photos: [],
  availability: [1,2,3,4,5,6,7,8,9,10,11,12], isVerified: true });
const run = (couple, tags) => {
  const r = computeMatches({ city: "HCMC", weddingDate: "2027-03-15", budgetTotal: 300, guestCount: 200, preferredStyles: couple },
                           { pool: [mk("t1", tags)], category: "photography", limit: 5 });
  const v = r.vendors.find((x) => x.id === "t1");
  const texts = [...v.match.reasons.map((x) => x.label), v.match.whyThisVendor, r.whyThoseVendors ?? ""].join(" || ");
  return { v, texts };
};
const GU = /(^|[^\p{L}])(gu|phong cách|style)([^\p{L}]|$)/iu;
// 1
{ const { v, texts } = run(["  KOREAN ", "korean"], ["Soft "]);
  if (v.match.scoreBreakdown.style !== 1) bad.push(`1 style ${v.match.scoreBreakdown.style}`);
  if (JSON.stringify(v.match.styleCoverage) !== '{"matched":1,"total":1}') bad.push(`1 coverage ${JSON.stringify(v.match.styleCoverage)}`);
  if (!texts.includes("Hàn Quốc")) bad.push(`1 thiếu "Hàn Quốc": ${texts}`);
  if (/soft|nhẹ nhàng|korean/i.test(texts)) bad.push(`1 tag thô/nhãn sai: ${texts}`); }
// 2
{ const { v, texts } = run(["boho"], ["Boho "]);
  if (v.match.scoreBreakdown.style !== 1) bad.push(`2 style ${v.match.scoreBreakdown.style}`);
  if (JSON.stringify(v.match.styleCoverage) !== '{"matched":1,"total":1}') bad.push(`2 coverage ${JSON.stringify(v.match.styleCoverage)}`);
  if (/boho/i.test(texts)) bad.push(`2 in style không nhãn: ${texts}`); }
// 3
{ const { v, texts } = run(["minimalist"], ["modern"]);
  if (v.match.scoreBreakdown.style !== 0.5) bad.push(`3 style ${v.match.scoreBreakdown.style}`);
  if (v.match.styleCoverage.matched !== 0) bad.push(`3 coverage ${JSON.stringify(v.match.styleCoverage)}`);
  if (GU.test(texts.replaceAll("Vendor Thử t1", ""))) bad.push(`3 nói gu khi matched=0: ${texts}`); }
// 4 formatMatchBlock
const item = (tags) => { const o = { name: "Studio X", price_range: { min_vnd: 15e6, max_vnd: 20e6, unit: "package" }, score: 80, boost_detail: [] };
  if (tags !== undefined) o.style_tags = tags; return o; };
const line = (s) => (s.split("\n").find((l) => l.includes("Phù hợp vì")) || "");
try {
  const s = formatMatchBlock({ matches: [item(["SOFT"])] }, { category: "photography", style_preferences: ["  Korean "] });
  if (!line(s).includes("Hàn Quốc")) bad.push(`4 "Phù hợp vì" thiếu "Hàn Quốc": ${line(s) || "(không có dòng)"}`);
  if (/soft|korean/i.test(s.replace("Studio X", ""))) bad.push(`4 tag thô trong block`);
  for (const t of [null, undefined]) {
    const s2 = formatMatchBlock({ matches: [item(t)] }, { category: "photography", style_preferences: ["korean"] });
    if (GU.test(line(s2))) bad.push(`4 style_tags=${t} vẫn nói gu: ${line(s2)}`);
  }
} catch (e) { bad.push(`4 lỗi: ${e.message}`); }
console.log(JSON.stringify(bad));
'''
with tempfile.TemporaryDirectory() as d:
    f = os.path.join(d, "adv02.mjs"); open(f, "w", encoding="utf-8").write(JS)
    p = subprocess.run(["node", f, repo], capture_output=True, text=True, timeout=120)
if p.returncode != 0: print("FAIL chạy lỗi: " + (p.stderr or p.stdout)[-400:]); sys.exit(1)
bad = json.loads(p.stdout.strip().splitlines()[-1])
if bad: print(f"FAIL {len(bad)} vi phạm; " + " | ".join(bad[:4])); sys.exit(1)
print("PASS JS: chuẩn hoá hoa/thường/khoảng trắng/trùng, style lạ không in, một chiều, formatMatchBlock nhãn + style_tags null")
