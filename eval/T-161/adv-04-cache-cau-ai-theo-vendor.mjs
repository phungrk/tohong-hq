// T-161 adv-04 (Code Gate, tầng 3) — biến thể quanh adv-01, spec T-159 H5(d).
// (a) đổi phân bổ ảnh: chỉ vendor ảnh sinh lại (mỗi vendor đúng 1 lượt), vendor tiệc 0 lượt.
// (b) cache tách theo couple: couple c2 mở cùng vendor không dùng câu couple c1, mở c2 không làm c1 sinh lại.
// (c) file cache: số entry <= số vendor đã mở, kể cả sau nhiều lần đổi phân bổ.
// (d) [quan sát, không chấm] hai request song song mở hai vendor: entry nào bị mất do ghi đè.
import { loadBack, tab, newBucket, CID, BUDGET_KEY, eligible, overlayKeep, doc, coupleProfile, done } from "../T-159/_lib.mjs";
const M = await loadBack(); const fails = [];
const P = eligible(M, "photography").slice(0, 2); const [X] = eligible(M, "venue");
const overlay = { ...overlayKeep(M, "photography", P.map((v) => ({ id: v.id, priceMin: 10, priceMax: 20 }))), ...overlayKeep(M, "venue", [{ id: X.id, priceMin: 100, priceMax: 150 }]) };
const bucket = newBucket(M, { profile: coupleProfile({ budget: 300 }), budgetDoc: doc({ photography: 20, venue: 150 }), overlay, members: true });
const C2 = "c2";
bucket.data.set(`data/couples/${C2}/profile.yaml`, JSON.stringify(coupleProfile({ budget: 300 })));
bucket.data.set(`data/couples/${C2}/members.json`, JSON.stringify([{ user_id: "u1", role: "owner" }]));
bucket.data.set(`data/couples/${C2}/budget.json`, JSON.stringify(doc({ photography: 20, venue: 150 })));
const open = async (id, cid = CID) => { const c = { n: 0 }; const r = await tab(M, { url: `/api/vendors/${id}?coupleId=${cid}`, bucket, env: { CLAUDE_API_KEY: "fake-eval" }, countFetch: c }); if (r.err || r.status !== 200) fails.push(`mở ${id}/${cid} lỗi ${r.err?.message || r.status}`); return c.n; };
const n0 = await open(P[0].id);
if (!(n0 > 0)) { console.log("FAIL tín hiệu thử hỏng"); process.exit(1); }
await open(P[1].id); await open(X.id);
const want = async (label, id, w, cid) => { const n = await open(id, cid); if (n !== w) fails.push(`${label}: ${n} fetch LLM, mong ${w}`); };
// (a)
bucket.data.set(BUDGET_KEY, JSON.stringify(doc({ photography: 25, venue: 150 })));
await want("(a) vendor tiệc sau khi đổi phân bổ ảnh", X.id, 0);
await want("(a) vendor ảnh 1 sau khi đổi phân bổ ảnh", P[0].id, n0);
await want("(a) vendor ảnh 2 sau khi đổi phân bổ ảnh", P[1].id, n0);
await want("(a) vendor ảnh 1 mở lại", P[0].id, 0);
// (b)
await want("(b) couple c2 mở vendor ảnh 1 lần đầu (cache riêng)", P[0].id, n0, C2);
await want("(b) couple c1 mở lại vendor ảnh 1 sau khi c2 mở", P[0].id, 0);
// (c)
for (let i = 0; i < 5; i++) { bucket.data.set(BUDGET_KEY, JSON.stringify(doc({ photography: 30 + i, venue: 150 }))); await open(P[0].id); await open(P[1].id); await open(X.id); }
const cache = JSON.parse(bucket.data.get(`data/couples/${CID}/vendor_why_cache.json`));
const nEntries = Object.keys(cache.entries || {}).length;
if (nEntries > 3) fails.push(`(c) cache có ${nEntries} entry, mong <= 3 (số vendor đã mở)`);
// (d) quan sát
{
  const [A, B] = eligible(M, "photography").slice(2, 4);
  const ov2 = { ...overlay, ...Object.fromEntries([A, B].map((v) => [v.id, { priceMin: 10, priceMax: 20, price_verified: true }])) };
  bucket.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 2, vendors: ov2 })); M.resetOverlayCache();
  const origFetch = globalThis.fetch, ol = console.log, oe = console.error; globalThis.fetch = async () => { throw new Error("LLM giả"); }; console.log = () => {}; console.error = () => {};
  const req = (id) => M.handleVendors(new Request(`http://localhost/api/vendors/${id}?coupleId=${CID}`), { CHAT_DATA: bucket, CLAUDE_API_KEY: "fake-eval" }, { userId: "u1" }, [id]);
  try { await Promise.all([req(A.id), req(B.id)]); } finally { globalThis.fetch = origFetch; console.log = ol; console.error = oe; }
  const e = JSON.parse(bucket.data.get(`data/couples/${CID}/vendor_why_cache.json`)).entries;
  console.log(`(d) quan sát song song: A ${e[A.id] ? "có" : "MẤT"}, B ${e[B.id] ? "có" : "MẤT"} trong cache`);
}
done(fails);
