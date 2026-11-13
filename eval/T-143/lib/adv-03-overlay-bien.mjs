// T-143 adv-03 (adversary, tầng 3): overlay admin ở biên trên đường chat (spec T-140 mục 1, 2, 6; FR-034/035).
// Ca: (a) ẩn HẾT vendor một hạng mục → 0 ứng viên, khối "Không có vendor phù hợp", không tên vendor nào của hạng mục lọt prompt, không ném;
// (b) ẩn hết TRỪ một vendor → đúng 1 ứng viên đó; (c) giá admin đẩy mọi vendor vượt ngân sách và vượt ×1,2 → 0 ứng viên (lọc theo giá sau overlay);
// (d) giá admin hạ một vendor đắt xuống trong ngân sách → vendor đó được xét, price_range = giá admin, nhãn "giá đã xác minh";
// (e) overlay rác (hidden "yes"/1, priceMin "abc"/-5/null/NaN-string, vendors là mảng/chuỗi) → không ném, không gọi mạng, hidden !== true không bị ẩn;
// (f) file overlay hỏng (JSON lỗi) → không ném, vẫn có ứng viên. Có MATCHER_URL/KEY trong env; mọi fetch bị cấm.
import { frozenRoot, load, chat, candidates, eligible } from "../../T-140/_lib.mjs";
const M = await load(frozenRoot());
const fails = [];
const cat = "photography"; const E = eligible(M, cat); const ENV = { MATCHER_URL: "https://matcher.test", MATCHER_API_KEY: "k" };
const NONE = /\[VENDOR MATCHER — Không có vendor phù hợp/;
async function run(label, opts) { try { const c = await chat(M, { env: ENV, ...opts }); if (c.net) fails.push(`${label}: gọi mạng`); return c; } catch (e) { fails.push(`${label}: ném ${e.message}`); return null; } }
// (a)
const allHidden = {}; for (const v of M.POOL) if (v.category === cat) allHidden[v.id] = { hidden: true, hidden_reason: "adv" };
let c = await run("ẩn hết", { category: cat, budgetTr: 30, overlay: allHidden });
if (c) { if (c.ids.length) fails.push(`ẩn hết: còn ${c.ids.length} ứng viên`); if (!NONE.test(c.sp)) fails.push("ẩn hết: thiếu khối Không có vendor phù hợp");
  const leak = M.POOL.filter((v) => v.category === cat && v.name && v.name.length > 3 && c.sp.includes(v.name)); if (leak.length) fails.push(`ẩn hết: lộ tên ${leak[0].name}`); }
// (b)
const keepOne = { ...allHidden }; delete keepOne[E[3].id];
c = await run("ẩn trừ một", { category: cat, budgetTr: 1000, overlay: keepOne });
if (c && (c.ids.length !== 1 || c.ids[0] !== E[3].id)) fails.push(`ẩn trừ một: ứng viên ${JSON.stringify(c.ids)} != [${E[3].id}]`);
// (c) mọi vendor hạng mục giá admin 100–200tr, ngân sách 30tr (×1,2 = 36tr) → 0
const pricey = {}; for (const v of M.POOL) if (v.category === cat) pricey[v.id] = { priceMin: 100, priceMax: 200, price_verified: true };
c = await run("giá admin vượt", { category: cat, budgetTr: 30, overlay: pricey });
if (c && c.ids.length) fails.push(`giá admin vượt: còn ${c.ids.length} ứng viên (giá sau overlay 100tr > 36tr)`);
// (d) một vendor đắt nhất được hạ giá xuống 5–6tr, mọi vendor khác giá 100tr
const dear = [...E].filter((v) => v.priceMin > 0).sort((a, b) => b.priceMin - a.priceMin)[0];
const one = { ...pricey, [dear.id]: { priceMin: 5, priceMax: 6, price_verified: true } };
c = await run("hạ giá một", { category: cat, budgetTr: 10, overlay: one });
if (c) { const m = c.md.matches.find((x) => x.vendor_id === dear.id);
  if (!m) fails.push(`hạ giá một: ${dear.id} (pool ${dear.priceMin}tr, admin 5tr) không vào ứng viên`);
  else { if (m.price_range?.min_vnd !== 5e6 || m.price_range?.max_vnd !== 6e6) fails.push(`hạ giá một: price_range ${JSON.stringify(m.price_range)} != giá admin`);
    const cd = candidates(c.sp).find((x) => x.name === dear.name); if (!cd || !/5-6tr \(giá đã xác minh\)/.test(cd.priceLine)) fails.push(`hạ giá một: dòng giá prompt "${cd?.priceLine}"`); } }
// (e) overlay rác
const junk = { [E[0].id]: { hidden: "yes" }, [E[1].id]: { hidden: 1 }, [E[2].id]: { priceMin: "abc", priceMax: -5 }, [E[3].id]: { priceMin: null, priceMax: "NaN" }, [E[4].id]: null, [E[5].id]: "rác" };
c = await run("overlay rác", { category: cat, budgetTr: 1000, overlay: junk });
if (c && !c.ids.length) fails.push("overlay rác: mất hết ứng viên");
for (const ov of [[1, 2], "chuỗi", 42]) { const r = await run(`vendors=${JSON.stringify(ov)}`, { category: cat, budgetTr: 30, overlay: ov }); if (r && !r.ids.length) fails.push(`vendors=${JSON.stringify(ov)}: mất hết ứng viên`); }
// (f) file overlay hỏng
{
  const bucket = new M.MemoryBucket(); bucket.data.set("data/couples/c1/profile.yaml", JSON.stringify({ couple: { city: "HCMC", wedding_date: "2029-03-20" } }));
  bucket.data.set("data/admin/vendor_overrides.json", "{ không phải json"); M.resetOverlayCache();
  const of = globalThis.fetch, ow = console.warn; let net = 0; globalThis.fetch = async () => { net++; throw new Error("x"); }; console.warn = () => {};
  try { const r = await M.buildChatContext({ CHAT_DATA: bucket, ...ENV }, "c1", null, "Tìm photographer chụp ảnh cưới giúp anh chị 30tr", null, "u1");
    if (!(r.matchMetadata?.matches || []).length) fails.push("overlay hỏng: không có ứng viên"); if (net) fails.push("overlay hỏng: gọi mạng"); }
  catch (e) { fails.push("overlay hỏng: ném " + e.message); } finally { globalThis.fetch = of; console.warn = ow; }
}
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS overlay biên: ẩn hết, ẩn trừ một, giá admin vượt/hạ, overlay rác, file hỏng");
