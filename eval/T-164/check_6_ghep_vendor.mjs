// T-164 tiêu chí 6 (ảnh hưởng lên ghép vendor; phương án mặc định A của spec mục H5): giá ước tính (estimate_category/estimate_default) được dùng NHƯ HÔM NAY cho lọc cứng, điểm ngân sách và thứ tự
// (priceMin/priceMax của khung đi vào đúng công thức cũ), nhưng KHÔNG được dùng làm bằng chứng cho lời khẳng định "trong ngân sách": chip "Trong ngân sách"/"Rẻ hơn Ntr", câu "nằm trong tầm giá",
// câu "giá dao động" chỉ tính vendor có giá không phải ước tính. Câu AI "vì sao hợp" kèm nhãn giá trong prompt. Pool không có priceSource (như fixture đông cứng của T-140/T-159) chạy y như cũ.
// A. phép thử tương đương: cùng số, chỉ đổi estimate->legacy_marry, thì danh sách chat (id, thứ tự) và điểm/thứ tự tab giống hệt, với nhiều hạng mục và ngân sách.
// B. chip/câu khẳng định: cặp sinh đôi estimate vs legacy cùng giá.
// C. prompt câu AI có nhãn. D. pool không priceSource: chip vẫn xuất hiện như cũ.
import { stampedBack, loadModules, setNow, restoreNow, EXPECTED, LABEL } from "./_lib.mjs";
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
/* C. prompt câu AI có nhãn giá */
{
  const { M, ids, ov } = await mk([EST(6, 8), REAL(6, 8)]);
  for (const [i, label] of [[0, LABEL.estimate], [1, LABEL.legacy("06/2026", false)]]) {
    const bodies = []; const orig = globalThis.fetch; globalThis.fetch = async (u, init) => { bodies.push(String(init?.body || "")); throw new Error("LLM giả (eval T-164)"); };
    const log = console.log, err = console.error; console.log = () => {}; console.error = () => {};
    try { M.resetOverlayCache(); const b = new M.MemoryBucket(); b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(coupleProfile({ budget: 300 }))); b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }])); b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: ov }));
      await M.handleVendors(new Request(`http://localhost/api/vendors/${ids[i]}?coupleId=${CID}`), { CHAT_DATA: b, CLAUDE_API_KEY: "fake-eval" }, AUTH, [ids[i]]); }
    finally { globalThis.fetch = orig; console.log = log; console.error = err; }
    if (!bodies.length) bad("câu AI: không thấy lượt gọi LLM giả (eval không đo được prompt)"); else if (!bodies.some((x) => x.includes(label))) bad(`câu AI: prompt phải chứa nhãn giá "${label}"`);
  }
}
/* D. pool không priceSource: hành vi cũ (chip xuất hiện) */
{
  const ids = {}; const dir = stampedBack({ mut: (arr) => { const tw = arr.filter((v) => v.category === "photography" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 1); tw.forEach((v) => { v.priceMin = 6; v.priceMax = 8; delete v.priceSource; delete v.priceAsOf; ids[0] = v.id; }); } });
  const M = await loadModules(dir); const ov = {}; for (const v of M.POOL) if (v.category === "photography" && v.id !== ids[0]) ov[v.id] = { hidden: true, hidden_reason: "eval T-164" };
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300, budget_by_category: { photography: 20 } }), overlay: ov });
  const v = r.body?.vendors?.[0]; if (!v || !(v.match.reasons || []).some((x) => /ngân sách|^Rẻ hơn/.test(x.label))) bad("pool không priceSource: chip ngân sách phải xuất hiện như cũ");
}
restoreNow();
if (fails.length && process.env.T164_ALL) console.log(fails.map((f) => "  - " + f).join("\n"));
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS");
