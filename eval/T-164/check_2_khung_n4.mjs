// T-164 tiêu chí 2: khung N4 = P25..P75 (nội suy tuyến tính, vị trí (n-1)p) của TRUNG ĐIỂM giá riêng hợp lệ (đã làm tròn 0,1tr như pool) theo hạng mục, làm tròn 0,1tr (Math.round(x*10)/10);
// n >= 10 mới dùng (priceSource "estimate_category", priceAsOf = tháng last_scraped mới nhất của mẫu); n < 10 => giá mặc định cũ của hạng mục, priceSource "estimate_default", priceAsOf null.
// Giá riêng quá 365 ngày (tính từ cuối tháng last_scraped tới --as-of) rơi về N4 và không còn là mẫu. Khung chỉ lấy mẫu từ giá riêng hợp lệ: không bao giờ từ vendor ước tính (không tự tham chiếu).
// Tính lại khi chạy lại generator (sinh đầy đủ, hoặc --prices-only --in <nguồn> --base <pool> --out <pool>): kết quả chỉ phụ thuộc đầu vào + --as-of, không phụ thuộc thứ tự bản ghi hay giá trị giá đang nằm trong pool nền.
import fs from "node:fs";
import { EXPECTED, INPUTS, genFull, gen, readPool, rec, near, sameExpected, priceOf, PRICE_FIELDS, DEFAULTS, UNIT, r1, pct, tmpdir } from "./_lib.mjs";
import path from "node:path";
const fails = []; const bad = (m) => fails.push(m);
const done = () => { if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); } console.log("PASS"); };

/* A. sinh đầy đủ == đầu ra mong đợi cho cả 867 vendor */
const g = genFull(INPUTS); if (!g.ok) { console.log("FAIL " + g.msg); process.exit(1); }
let nBad = 0, first = "";
for (const [id, e] of Object.entries(EXPECTED.vendors)) { const v = g.pool.get(id); if (!sameExpected(v, e)) { nBad++; first ||= `${id}: ${JSON.stringify(priceOf(v))} mong ${JSON.stringify(e)}`; } }
if (nBad) bad(`sinh đầy đủ lệch ${nBad}/867 vendor, vd ${first}`);
/* B. --prices-only: các trường khác y nguyên; tự sửa lại giá ước tính bị sửa tay (không tự tham chiếu); idempotent */
{
  const base = g.pool; const tam = [...base.values()].map((v) => ({ ...v }));
  // phá pool nền: ước tính bị đổi số, legacy bị đổi số, một trường khác bị đổi để biết nó phải giữ nguyên
  for (const v of tam) { if (v.priceSource !== "legacy_marry") { v.priceMin = 999; v.priceMax = 1999; } }
  const lg = tam.find((v) => v.priceSource === "legacy_marry"); if (lg) lg.priceMin = 0.1;
  const probe = tam.find((v) => v.category === "photography"); const oldName = probe.name; probe.name = "TÊN KHÁC GIỮ NGUYÊN";
  const d = tmpdir("po"); const baseF = path.join(d, "base.js"); const outF = path.join(d, "out.js");
  fs.writeFileSync(baseF, "// AUTO-GENERATED\nexport const GENERATED_VENDOR_POOL = " + JSON.stringify(tam) + ";\n");
  const r = gen(["--prices-only", "--in", g.inF, "--base", baseF, "--out", outF, "--as-of", EXPECTED.as_of]);
  if (r.status !== 0 || !fs.existsSync(outF)) bad("--prices-only không chạy được: " + r.out.slice(-160).replace(/\n/g, " "));
  else {
    const out = new Map(readPool(outF).map((v) => [v.id, v])); let n = 0, f1 = "";
    for (const [id, e] of Object.entries(EXPECTED.vendors)) if (!sameExpected(out.get(id), e)) { n++; f1 ||= id; }
    if (n) bad(`--prices-only lệch ${n} vendor (nhất là ước tính bị sửa tay phải được tính lại), vd ${f1}`);
    const o2 = out.get(probe.id); if (!o2 || o2.name !== "TÊN KHÁC GIỮ NGUYÊN") bad("--prices-only đổi trường không phải giá (name)");
    const strip = (v) => { const c = { ...v }; for (const k of PRICE_FIELDS) delete c[k]; return JSON.stringify(c); };
    const diffOther = [...out.values()].filter((v) => strip(v) !== strip(tam.find((t) => t.id === v.id))).length; if (diffOther) bad(`--prices-only đổi ${diffOther} vendor ở trường ngoài giá`);
    // idempotent: chạy lần nữa trên chính đầu ra
    const out2F = path.join(d, "out2.js"); const r2 = gen(["--prices-only", "--in", g.inF, "--base", outF, "--out", out2F, "--as-of", EXPECTED.as_of]);
    if (r2.status !== 0 || fs.readFileSync(outF, "utf8") !== fs.readFileSync(out2F, "utf8")) bad("--prices-only không idempotent (chạy lần hai trên đầu ra lần một cho byte khác)");
  }
}
/* C. thứ tự bản ghi đầu vào không ảnh hưởng */
{ const g3 = genFull([...INPUTS].reverse()); if (!g3.ok) bad("đảo thứ tự đầu vào: " + g3.msg); else { let n = 0; for (const [id, e] of Object.entries(EXPECTED.vendors)) if (!sameExpected(g3.pool.get(id), e)) n++; if (n) bad(`đảo thứ tự đầu vào đổi giá của ${n} vendor`); } }
/* D. tính lại: đổi một giá hợp lệ => khung hạng mục đó đổi đúng theo công thức, hạng mục khác không đổi; thêm giá rác => khung không đổi */
{
  const mids = (cat, recs) => recs.filter((x) => x.categories[0] === cat && x.price_range && EXPECTED.vendors[x.id]?.priceSource === "legacy_marry").map((x) => (Math.round(x.price_range.min_vnd / 1e5) / 10 + Math.round(x.price_range.max_vnd / 1e5) / 10) / 2);
  const tgt = INPUTS.find((x) => x.categories[0] === "photography" && EXPECTED.vendors[x.id].priceSource === "legacy_marry");
  const mod = INPUTS.map((x) => (x.id === tgt.id ? { ...x, price_range: { ...x.price_range, min_vnd: 140000000, max_vnd: 140000000 } } : x));
  const g4 = genFull(mod);
  if (!g4.ok) bad("đổi một giá: " + g4.msg); else {
    const arr = mids("photography", INPUTS).filter((_, i, a) => true); const idx = INPUTS.filter((x) => x.categories[0] === "photography" && EXPECTED.vendors[x.id].priceSource === "legacy_marry").findIndex((x) => x.id === tgt.id);
    arr[idx] = 140; const want = { min: r1(pct(arr, 0.25)), max: r1(pct(arr, 0.75)) };
    const est = [...g4.pool.values()].find((v) => v.category === "photography" && v.priceSource === "estimate_category");
    if (!est || !near(est.priceMin, want.min) || !near(est.priceMax, want.max)) bad(`đổi một giá photography thành 140tr: khung phải ${want.min}-${want.max}, thấy ${est ? est.priceMin + "-" + est.priceMax : "không có vendor ước tính"}`);
    const other = [...g4.pool.values()].find((v) => v.category === "venue" && v.priceSource === "estimate_category"); const e0 = EXPECTED.frames.venue;
    if (!other || !near(other.priceMin, e0.priceMin) || !near(other.priceMax, e0.priceMax)) bad("đổi giá photography làm đổi khung venue");
  }
  const junk = [rec("t_j1", "photography", 1, 1), rec("t_j2", "photography", 900000000, 900000000), rec("t_j3", "photography", 500000000000, 500000000000)];
  const g5 = genFull([...INPUTS, ...junk]);
  if (!g5.ok) bad("thêm giá rác: " + g5.msg); else { const est = [...g5.pool.values()].find((v) => v.category === "photography" && v.id.startsWith("marry_") && v.priceSource === "estimate_category"); const e0 = EXPECTED.frames.photography; if (!est || !near(est.priceMin, e0.priceMin) || !near(est.priceMax, e0.priceMax)) bad("thêm 3 giá rác làm đổi khung photography (giá rác không được vào mẫu)"); }
}
/* E. cỡ mẫu: 9 mẫu hợp lệ => mặc định cũ (estimate_default); 10 mẫu => P25-P75 (estimate_category); 1 vendor không giá làm nhân chứng */
{
  const mk = (n) => [...Array.from({ length: n }, (_, i) => rec("t_s" + i, "makeup", (2 + i) * 1000000, (4 + i) * 1000000)), rec("t_witness", "makeup", 0, 0, { noPrice: true })];
  for (const [n, src] of [[9, "estimate_default"], [10, "estimate_category"]]) {
    const gg = genFull(mk(n)); if (!gg.ok) { bad(`n=${n}: ${gg.msg}`); continue; }
    const w = gg.pool.get("t_witness");
    if (w?.priceSource !== src) { bad(`n=${n}: priceSource ${w?.priceSource}, mong ${src}`); continue; }
    if (n === 9 && !(near(w.priceMin, DEFAULTS.makeup[0]) && near(w.priceMax, DEFAULTS.makeup[1]))) bad(`n=9: phải dùng giá mặc định cũ ${DEFAULTS.makeup}, thấy ${w.priceMin}-${w.priceMax}`);
    if (n === 10) { const mids = Array.from({ length: 10 }, (_, i) => ((2 + i) + (4 + i)) / 2); if (!(near(w.priceMin, r1(pct(mids, 0.25))) && near(w.priceMax, r1(pct(mids, 0.75))) && w.priceAsOf === "2026-06")) bad(`n=10: mong ${r1(pct(mids, 0.25))}-${r1(pct(mids, 0.75))} asOf 2026-06, thấy ${w.priceMin}-${w.priceMax} ${w.priceAsOf}`); }
  }
}
/* F. tuổi: đúng 365 ngày vẫn là giá riêng; 366 ngày rơi về N4 và không còn là mẫu (cuối tháng 2026-06 = 2026-06-30) */
{
  const mk = () => [...Array.from({ length: 12 }, (_, i) => rec("t_a" + i, "attire", (2 + i) * 1000000, (3 + i) * 1000000)), rec("t_witness", "attire", 0, 0, { noPrice: true })];
  const a = genFull(mk(), "2027-06-30"); const b = genFull(mk(), "2027-07-01");
  if (!a.ok || !b.ok) bad("as-of tuổi: generator lỗi");
  else {
    if (a.pool.get("t_a0")?.priceSource !== "legacy_marry") bad("as-of 2027-06-30 (đúng 365 ngày): giá phải còn là legacy_marry");
    if (b.pool.get("t_a0")?.priceSource === "legacy_marry") bad("as-of 2027-07-01 (366 ngày): giá phải rơi về N4");
    if (b.pool.get("t_witness")?.priceSource !== "estimate_default") bad("as-of 2027-07-01: mọi mẫu quá hạn nên không đủ 10 mẫu, vendor ước tính phải về estimate_default, thấy " + b.pool.get("t_witness")?.priceSource);
  }
}
done();
