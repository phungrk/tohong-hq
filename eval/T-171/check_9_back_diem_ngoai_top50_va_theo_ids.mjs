// T-171 tiêu chí 9 (tohong-back, H7 và H8 của spec v3): (a) GET /api/vendors/:id?coupleId= trả match cho đúng vendor đó KỂ CẢ khi vendor nằm ngoài top 50 của danh mục (pool thật, HCMC, 80+ venue),
// match giống hệt (totalScore, scoreBreakdown, budgetBasis) phần tử cùng vendor ở GET /api/vendors/match; (b) GET /api/vendors/match?coupleId=&ids=a,b,… trả điểm cho đúng các id đó (kể cả ngoài top 50, khác danh mục),
// match giống hệt như ở danh sách, whyThoseVendors = null, KHÔNG gọi LLM (0 lần fetch), id ẩn/không có/không qua lọc cứng thì vắng (200, không lỗi), quá 50 id thì 400; (c) vendor ẩn: chi tiết vẫn { match: null }.
// Chạy từ gốc tohong-hq: node eval/T-171/check_9_back_diem_ngoai_top50_va_theo_ids.mjs  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back). Không mạng, không ghi repo thật.
import { setup, newBucket, budgetDoc, coupleProfile, restoreNow, done, CID } from "../T-167/_lib.mjs";
import { tab } from "../T-167/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const profile = coupleProfile({ budget: 200, guest_count: 200 });
const doc = budgetDoc(30, { total_tr: 200, guests: 200 });
const same = (a, b) => JSON.stringify([a?.totalScore, a?.scoreBreakdown, a?.budgetBasis]) === JSON.stringify([b?.totalScore, b?.scoreBreakdown, b?.budgetBasis]);
const get = (url, extra = {}) => tab(M, { url, profile, budgetDoc: doc, overlay: {}, countFetch: { n: 0 }, ...extra });
const l0 = await get(`/api/vendors/match?coupleId=${CID}&category=venue&limit=50&offset=0`);
const l1 = await get(`/api/vendors/match?coupleId=${CID}&category=venue&limit=50&offset=50`);
if (!(l0.body?.total > 50) || !l1.body?.vendors?.length) { bad(`khung: pool venue phải có hơn 50 vendor để có vendor ngoài top 50 (total ${l0.body?.total})`); done(fails); }
const X = l1.body.vendors[0], T = l0.body.vendors[0];
// (a)
const d = await get(`/api/vendors/${X.id}?coupleId=${CID}`);
if (!d.body?.match) bad(`(a) chi tiết vendor ngoài top 50 (${X.id}, hạng ${50 + 1}) phải có match, thấy ${JSON.stringify(d.body?.match)} (status ${d.status})`);
else if (!same(d.body.match, X.match)) bad("(a) match ở chi tiết phải giống hệt phần tử cùng vendor ở danh sách (totalScore, scoreBreakdown, budgetBasis)");
const dt = await get(`/api/vendors/${T.id}?coupleId=${CID}`);
if (!dt.body?.match || !same(dt.body.match, T.match)) bad("(a) chi tiết vendor top 1 phải vẫn giống danh sách");
// (b)
const ids = [X.id, T.id].join(",");
const r = await get(`/api/vendors/match?coupleId=${CID}&ids=${ids}`);
if (r.status !== 200) bad(`(b) ids phải trả 200, thấy ${r.status}`);
else {
  const got = Object.fromEntries((r.body.vendors || []).map((v) => [v.id, v]));
  if (Object.keys(got).sort().join() !== [X.id, T.id].sort().join()) bad(`(b) ids phải trả đúng ${ids}, thấy ${Object.keys(got)}`);
  if (got[X.id] && !same(got[X.id].match, X.match)) bad("(b) match của vendor ngoài top 50 qua ids phải giống danh sách");
  if (got[T.id] && !same(got[T.id].match, T.match)) bad("(b) match của vendor top 1 qua ids phải giống danh sách");
  if (r.body.whyThoseVendors != null) bad("(b) ids không sinh whyThoseVendors");
  if (typeof r.body.total !== "number" || r.body.total !== (r.body.vendors || []).length) bad(`(b) total phải bằng số vendor trả về, thấy ${r.body.total}`);
}
if (r.err) bad("(b) ids ném lỗi: " + r.err);
// countFetch đếm trong tab(); đọc lại bằng cách gọi trực tiếp
const cf = { n: 0 }; await tab(M, { url: `/api/vendors/match?coupleId=${CID}&ids=${ids}`, profile, budgetDoc: doc, overlay: {}, countFetch: cf, env: { LLM_RELAY_URL: "http://llm.invalid" } });
if (cf.n !== 0) bad(`(b) ids không được gọi LLM, thấy ${cf.n} lần fetch`);
// id ẩn / không có / chéo danh mục
const H = l0.body.vendors[1];
const hid = await get(`/api/vendors/match?coupleId=${CID}&ids=${H.id},khong-co-id,${T.id}`, { overlay: { [H.id]: { hidden: true, hidden_reason: "eval T-171" } } });
const hidIds = (hid.body?.vendors || []).map((v) => v.id);
if (hid.status !== 200 || hidIds.join() !== T.id) bad(`(b) id ẩn và id không có phải vắng, chỉ còn ${T.id}; thấy ${hidIds} (status ${hid.status})`);
// (c)
const hd = await get(`/api/vendors/${H.id}?coupleId=${CID}`, { overlay: { [H.id]: { hidden: true, hidden_reason: "eval T-171" } } });
if (hd.body?.match !== null) bad("(c) vendor ẩn: chi tiết vẫn phải có match null");
// quá 50 id
const many = Array.from({ length: 51 }, (_, i) => `id${i}`).join(",");
const mm = await get(`/api/vendors/match?coupleId=${CID}&ids=${many}`);
if (mm.status !== 400) bad(`(b) quá 50 id phải 400, thấy ${mm.status}`);
restoreNow(); done(fails);
