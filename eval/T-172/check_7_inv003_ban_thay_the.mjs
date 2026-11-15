// T-172 tiêu chí 7: BẢN THAY THẾ đề nghị cho eval/T-164/check_6_ghep_vendor.mjs (cái mà bất biến planner/vendor/inv-003 đang chạy). Chief ghi ADR rồi trỏ inv-003 sang file này; không ai sửa check_6 cũ.
// Giữ A (ước tính dùng như giá cũ cho lọc/điểm/thứ tự), B (không chip ngân sách, không đếm vào "tầm giá"/"giá dao động"), D (pool không priceSource giữ chip).
// Phần C và E của check_6 đo CHỮ NHÃN (prompt phải chứa nhãn; "(giá ước tính theo hạng mục)"; "rõ giá (kèm nhãn giá)"). Thay bằng phần F: cùng tính chất inv-003 phía AI nhưng KHÔNG phụ thuộc nhãn có hay không,
// nên XANH cả trên main lẫn sau T-172, đổi trỏ được ngay: (F1) hướng dẫn chat có đúng một dòng chứa "không khẳng định" và "ngân sách" khi có ứng viên ước tính; (F2) "Phù hợp vì" của ứng viên ước tính không chứa "ngân sách"
// (quét 5 hạng mục x 3 ngân sách), của twin giá riêng thì chứa; (F3) mục chat của ứng viên ước tính khác mục của twin giá riêng cùng số (ngoài tên); (F4) prompt câu "vì sao hợp" của vendor ước tính khác prompt của twin giá riêng cùng số (ngoài tên).
import * as L from "./_lib.mjs";
import { stampedBack, loadModules, setNow, restoreNow, EXPECTED, LABEL } from "../T-164/_lib.mjs";
import { tab, chat, coupleProfile, CID, AUTH, MSG_BY_CAT } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const CATS = ["photography", "attire", "makeup", "decor", "transport"];
const dirA = stampedBack();                                                                   // pool đóng dấu đúng spec
const dirB = stampedBack({ stamp: (v, x) => { Object.assign(v, x); if (x.priceSource !== "legacy_marry") { v.priceSource = "legacy_marry"; v.priceAsOf = "2026-06"; } } }); // cùng số, mọi vendor coi là giá riêng
const [A, B] = [await loadModules(dirA), await loadModules(dirB)];
setNow("2026-11-14T08:00:00Z");
/* A. tương đương */
const sig = (r) => (r.body?.vendors || []).map((v) => `${v.id}:${v.match.totalScore}:${JSON.stringify(v.match.scoreBreakdown)}`).join("|");
for (const cat of CATS) for (const bc of [3, 10, 30]) {
  const prof = coupleProfile({ budget: 300, budget_by_category: { [cat]: bc } });
  const [ra, rb] = [await tab(A, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50`, profile: prof }), await tab(B, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50`, profile: prof })];
  if (ra.err || rb.err) { bad(`tab ${cat} ${bc}tr: lỗi ${(ra.err || rb.err).message}`); continue; }
  if (!ra.body.vendors.length) { bad(`tab ${cat}: không có vendor (eval không đo)`); continue; }
  if (sig(ra) !== sig(rb)) bad(`tab ${cat} ngân sách ${bc}tr: điểm/thứ tự khác khi chỉ đổi nhãn nguồn giá (ước tính phải được dùng như giá cũ)`);
  const ca = await chat(A, { message: `${MSG_BY_CAT[cat]} ${bc}tr`, profile: coupleProfile({ budget: 300 }) }); const cb = await chat(B, { message: `${MSG_BY_CAT[cat]} ${bc}tr`, profile: coupleProfile({ budget: 300 }) });
  if (ca.err || cb.err) { bad(`chat ${cat} ${bc}tr: lỗi`); continue; }
  if (ca.ids.join() !== cb.ids.join()) bad(`chat ${cat} ${bc}tr: ứng viên khác khi chỉ đổi nhãn nguồn giá: ${ca.ids.length} vs ${cb.ids.length}`);
  if (ca.md?.relaxations_applied?.join() !== cb.md?.relaxations_applied?.join()) bad(`chat ${cat} ${bc}tr: việc nới ngân sách khác nhau`);
}
/* B. cặp sinh đôi: A1,A2 = ước tính; B1,B2 = giá riêng; cùng số ở từng cặp; ẩn mọi photography khác */
const mk = async (spec) => {
  const ids = {};
  const dir = stampedBack({ mut: (arr) => {
    const tw = arr.filter((v) => v.category === "photography" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, spec.length);
    tw.forEach((v, i) => { Object.assign(v, spec[i]); ids[i] = v.id; });
  } });
  const M = await loadModules(dir); const ov = {};
  for (const v of M.POOL) if (v.category === "photography" && !Object.values(ids).includes(v.id)) ov[v.id] = { hidden: true, hidden_reason: "eval T-164" };
  return { M, ids, ov };
};
const EST = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "estimate_category", priceAsOf: "2026-06" });
const REAL = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "legacy_marry", priceAsOf: "2026-06" });
{
  const { M, ids, ov } = await mk([EST(6, 8), REAL(6, 8)]);
  for (const [bc, kind] of [[20, "dư"], [8, "vừa đủ"]]) {
    const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300, budget_by_category: { photography: bc } }), overlay: ov });
    const va = r.body?.vendors?.find((v) => v.id === ids[0]), vb = r.body?.vendors?.find((v) => v.id === ids[1]);
    if (!va || !vb) { bad(`cặp sinh đôi ${kind}: thiếu vendor trong tab`); continue; }
    if (va.match.scoreBreakdown.budget !== 1 || vb.match.scoreBreakdown.budget !== 1) bad(`cặp sinh đôi ngân sách ${bc}tr: điểm ngân sách phải 1 cho cả hai (ước tính dùng như giá cũ), thấy ${va.match.scoreBreakdown.budget}/${vb.match.scoreBreakdown.budget}`);
    const lab = (v) => (v.match.reasons || []).map((x) => x.label).filter((l) => /ngân sách|^Rẻ hơn/.test(l));
    if (lab(va).length) bad(`vendor ước tính nhận chip khẳng định ngân sách: ${lab(va)}`);
    if (!lab(vb).length) bad(`vendor giá riêng cùng số mất chip "Trong ngân sách"/"Rẻ hơn" (hành vi cũ phải giữ)`);
  }
}
{ // câu danh sách: 1 ước tính + 2 giá riêng (6-8, 7-9), ngân sách dư
  const { M, ids, ov } = await mk([EST(4, 15.3), REAL(6, 8), REAL(7, 9)]);
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300, budget_by_category: { photography: 30 } }), overlay: ov });
  const w = r.body?.whyThoseVendors || "";
  if (!/Phần lớn nằm trong tầm giá/.test(w)) bad(`1 ước tính + 2 giá riêng trong ngân sách: câu phải là "Phần lớn nằm trong tầm giá" (chỉ đếm giá riêng, 2/3), thấy "${w}"`);
  if (!/6–9tr/.test(w) || /15[.,]3|4–/.test(w)) bad(`"giá dao động" chỉ tính vendor giá riêng (6–9tr), thấy "${w}"`);
}
{ // 2 ước tính + 1 giá riêng: không đủ giá riêng để khẳng định tỷ lệ
  const { M, ids, ov } = await mk([EST(4, 15.3), EST(5, 14), REAL(6, 8)]);
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300, budget_by_category: { photography: 30 } }), overlay: ov });
  const w = r.body?.whyThoseVendors || "";
  if (/tầm giá/.test(w)) bad(`2 ước tính + 1 giá riêng: không được nói "nằm trong tầm giá", thấy "${w}"`);
}
{ // toàn ước tính: không câu khẳng định, không "giá dao động"
  const { M, ids, ov } = await mk([EST(4, 15.3), EST(5, 14)]);
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300, budget_by_category: { photography: 30 } }), overlay: ov });
  const w = r.body?.whyThoseVendors || ""; if (!w) bad("toàn ước tính: vẫn phải có câu giới thiệu danh sách"); if (/tầm giá|dao động/.test(w)) bad(`toàn ước tính: không được nêu tầm giá/dao động, thấy "${w}"`);
}
/* D. pool không priceSource: hành vi cũ (chip xuất hiện) */
{
  const ids = {}; const dir = stampedBack({ mut: (arr) => { const tw = arr.filter((v) => v.category === "photography" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 1); tw.forEach((v) => { v.priceMin = 6; v.priceMax = 8; delete v.priceSource; delete v.priceAsOf; ids[0] = v.id; }); } });
  const M = await loadModules(dir); const ov = {}; for (const v of M.POOL) if (v.category === "photography" && v.id !== ids[0]) ov[v.id] = { hidden: true, hidden_reason: "eval T-164" };
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300, budget_by_category: { photography: 20 } }), overlay: ov });
  const v = r.body?.vendors?.[0]; if (!v || !(v.match.reasons || []).some((x) => /ngân sách|^Rẻ hơn/.test(x.label))) bad("pool không priceSource: chip ngân sách phải xuất hiện như cũ");
}
/* F. phía AI của inv-003, không phụ thuộc nhãn */
{
  const { M, ids, ov, nameOf } = await L.twinBack([{ cat: "photography", price: L.EST(6, 8) }, { cat: "photography", price: L.REAL(6, 8) }]);
  const r = await chat(M, { message: MSG_BY_CAT.photography, profile: coupleProfile({ budget: 300 }), overlay: ov });
  const block = L.candBlock(r.sp); const ents = L.entries(block, Object.fromEntries(ids.map((id) => [id, nameOf(id)])));
  if (!ents[ids[0]] || !ents[ids[1]]) bad("F chat: thiếu ứng viên (eval không đo đủ)");
  else {
    const nG = L.guidance(block).split("\n").filter((l) => /không khẳng định/.test(l) && /ngân sách/.test(l)).length;
    if (nG !== 1) bad(`F1: hướng dẫn chat có ứng viên ước tính phải có đúng 1 dòng chứa "không khẳng định" và "ngân sách", thấy ${nG}`);
    const why = (id) => (ents[id].find((l) => /Phù hợp vì:/.test(l)) || "");
    if (/ngân sách/.test(why(ids[0]))) bad(`F2: "Phù hợp vì" của vendor ước tính nói ngân sách: "${why(ids[0]).trim()}"`);
    if (!/ngân sách/.test(why(ids[1]))) bad(`F2: "Phù hợp vì" của twin giá riêng phải giữ "ngân sách", thấy "${why(ids[1]).trim()}"`);
    if (ents[ids[0]].join("\n") === ents[ids[1]].join("\n")) bad("F3: mục chat của vendor ước tính giống hệt twin giá riêng cùng số (LLM không có tín hiệu khác biệt)");
  }
  const dd = {}; for (const [i, id] of ids.entries()) { const o = await L.openDetail(M, id, { overlay: ov, reply: L.whyEcho }); dd[i] = (o.calls[0]?.system || "") + "\n" + (o.calls[0]?.user || ""); dd[i] = dd[i].split(nameOf(id)).join("X"); }
  if (!dd[0] || !dd[1]) bad("F4: không thấy prompt câu AI (eval không đo đủ)"); else if (dd[0] === dd[1]) bad("F4: prompt câu 'vì sao hợp' của vendor ước tính giống hệt twin giá riêng cùng số");
  // quét 5 hạng mục x 3 ngân sách trên pool đóng dấu đầy đủ
  let nEst = 0; const dirA = stampedBack(); const A = await loadModules(dirA);
  for (const cat of ["photography", "attire", "makeup", "decor", "transport"]) for (const bc of [3, 10, 30]) {
    const rr = await chat(A, { message: `${MSG_BY_CAT[cat]} ${bc}tr`, profile: coupleProfile({ budget: 300 }) }); const blk = L.candBlock(rr.sp); const ms = rr.md?.matches || [];
    const es = L.entries(blk, Object.fromEntries(ms.map((m) => [m.vendor_id, A.POOL.find((v) => v.id === m.vendor_id).name])));
    let any = false;
    for (const m of ms) if (/^estimate_/.test(String(m.price_basis))) { nEst++; any = true; const w = (es[m.vendor_id] || []).find((l) => /Phù hợp vì:/.test(l)) || ""; if (/ngân sách/.test(w)) bad(`F2 quét ${cat} ${bc}tr: ${m.vendor_id} (ước tính) "Phù hợp vì" nói ngân sách`); }
    if (any && L.guidance(blk).split("\n").filter((l) => /không khẳng định/.test(l) && /ngân sách/.test(l)).length !== 1) bad(`F1 quét ${cat} ${bc}tr: thiếu đúng 1 dòng cấm khẳng định ngân sách`);
  }
  if (nEst < 10) bad(`F quét: chỉ ${nEst} ứng viên ước tính (eval không đo đủ)`);
}
restoreNow();
if (fails.length && process.env.T164_ALL) console.log(fails.map((f) => "  - " + f).join("\n"));
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS");
