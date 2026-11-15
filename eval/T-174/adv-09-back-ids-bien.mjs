// T-174 adversary 09 (tohong-back, spec T-171 v3.1 H8): biên của `match?ids=` mà check_9 chưa chạm.
// (a) dấu cách và dấu phẩy thừa: "ids= T , ,X ," trả đúng {T, X}; (b) chỉ dấu phẩy/dấu cách ", , ," -> 400 ("chỉ dấu phẩy" = rỗng);
// (c) có ids thì category/limit/offset/minScore KHÔNG áp: ids=T(venue),P(khác danh mục) &category=venue&limit=1&offset=5&minScore=101 vẫn trả cả hai;
// (d) đúng 50 id khác nhau + trùng (51 phần tử, 50 khác nhau) -> 200; (e) id có ký tự lạ/rất dài (2.000 ký tự) -> 200, vắng, không ném lỗi;
// (f) 0 lần LLM cả khi ids gồm vendor ngoài top 50 ở nhiều danh mục.
// Chạy từ gốc tohong-hq: node eval/T-174/adv-09-back-ids-bien.mjs · Biến: TOHONG_BACK_REPO.
import { setup, budgetDoc, coupleProfile, restoreNow, done, CID, tab } from "../T-167/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const profile = coupleProfile({ budget: 200, guest_count: 200 });
const doc = budgetDoc(30, { total_tr: 200, guests: 200 });
const get = (url, extra = {}) => tab(M, { url, profile, budgetDoc: doc, overlay: {}, countFetch: { n: 0 }, ...extra });
const ven = await get(`/api/vendors/match?coupleId=${CID}&category=venue&limit=50&offset=50`);
const T = (await get(`/api/vendors/match?coupleId=${CID}&category=venue&limit=1`)).body.vendors[0];
const X = ven.body.vendors[0];
const P = (await get(`/api/vendors/match?coupleId=${CID}&category=photography&limit=50&offset=50`)).body?.vendors?.[0]
  || (await get(`/api/vendors/match?coupleId=${CID}&category=photography&limit=1`)).body.vendors[0];
const idsOf = (r) => (r.body?.vendors || []).map((v) => v.id).sort().join();
const a = await get(`/api/vendors/match?coupleId=${CID}&ids=${encodeURIComponent(` ${T.id} , ,${X.id} ,`)}`);
if (a.status !== 200 || idsOf(a) !== [T.id, X.id].sort().join()) bad(`(a) dấu cách/phẩy thừa phải trả {${T.id},${X.id}}, thấy ${idsOf(a)} (status ${a.status})`);
const b = await get(`/api/vendors/match?coupleId=${CID}&ids=${encodeURIComponent(', , ,')}`);
if (b.status !== 400) bad(`(b) ids chỉ có dấu phẩy/dấu cách phải 400, thấy ${b.status}`);
const c = await get(`/api/vendors/match?coupleId=${CID}&ids=${T.id},${P.id}&category=venue&limit=1&offset=5&minScore=101`);
if (c.status !== 200 || idsOf(c) !== [T.id, P.id].sort().join()) bad(`(c) có ids thì category/limit/offset/minScore không áp; phải trả {${T.id},${P.id}}, thấy ${idsOf(c)}`);
const fifty = Array.from({ length: 49 }, (_, i) => `khong-co-${i}`).concat([T.id, T.id]).join(',');
const d = await get(`/api/vendors/match?coupleId=${CID}&ids=${fifty}`);
if (d.status !== 200 || idsOf(d) !== T.id) bad(`(d) 50 id khác nhau (+ trùng) phải 200 và trả ${T.id}, thấy ${d.status} ${idsOf(d)}`);
const e = await get(`/api/vendors/match?coupleId=${CID}&ids=${encodeURIComponent('x'.repeat(2000) + ',"<script>,' + T.id)}`);
if (e.status !== 200 || idsOf(e) !== T.id || e.err) bad(`(e) id lạ/dài phải 200, chỉ còn ${T.id}; thấy ${e.status} ${idsOf(e)} ${e.err || ''}`);
const cf = { n: 0 };
await tab(M, { url: `/api/vendors/match?coupleId=${CID}&ids=${X.id},${P.id},${T.id}`, profile, budgetDoc: doc, overlay: {}, countFetch: cf, env: { LLM_RELAY_URL: 'http://llm.invalid' } });
if (cf.n !== 0) bad(`(f) ids không được gọi LLM, thấy ${cf.n}`);
restoreNow(); done(fails);
