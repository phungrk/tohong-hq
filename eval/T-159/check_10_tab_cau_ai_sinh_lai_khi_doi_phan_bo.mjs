// T-159 tiêu chí 10: câu AI "vì sao hợp" ở màn chi tiết (GET /api/vendors/:id?coupleId=) được sinh lại khi ngân sách hạng mục hiệu lực đổi, và chỉ khi đó.
// LLM giả: CLAUDE_API_KEY giả + fetch bị chặn và đếm (mỗi lần gọi callLLM = vài lần fetch do orchestrator thử lại; đo "một lượt" = số fetch của lần mở đầu tiên, nguội).
// Cùng bucket R2 giả xuyên suốt (cache câu nằm trong đó). Hồ sơ tổng 300tr; vendor ảnh priceMax 20.
//  1) mở lần đầu (allocated 20tr): n0 > 0 lượt fetch (tín hiệu thử);  2) mở lại, không đổi: 0;  3) đổi allocated ảnh 20 -> 25tr, mở lại: đúng n0;
//  4) mở lại: 0;  5) đổi phân bổ hạng mục KHÁC (venue): 0;  6) allocated ảnh 25 -> 0 (về tổng x tỷ lệ 30tr): đúng n0;  7) đổi tổng ngân sách hồ sơ: không kiểm (đã có hành vi cũ).
// Chi phí (ghi trong spec H5): mỗi lần đổi phân bổ rồi mở chi tiết vendor tốn thêm tối đa 1 lượt callLLM cho MỖI vendor mở.
import { loadBack, tab, newBucket, CID, BUDGET_KEY, eligible, overlayKeep, doc, coupleProfile, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const [V, W] = eligible(M, "photography");
const overlay = overlayKeep(M, "photography", [{ id: V.id, priceMin: 10, priceMax: 20 }, { id: W.id, priceMin: 10, priceMax: 20 }]);
const bucket = newBucket(M, { profile: coupleProfile({ budget: 300 }), budgetDoc: doc({ photography: 20 }), overlay, members: true });
const open = async (id = V.id) => { const c = { n: 0 }; const r = await tab(M, { url: `/api/vendors/${id}?coupleId=${CID}`, bucket, env: { CLAUDE_API_KEY: "fake-eval" }, countFetch: c }); if (r.err || r.status !== 200) fails.push(`mở chi tiết lỗi ${r.err?.message || r.status}`); return c.n; };
const setDoc = (d) => bucket.data.set(BUDGET_KEY, JSON.stringify(d));
const n0 = await open();
if (!(n0 > 0)) { fails.push("tín hiệu thử hỏng: mở lần đầu không gọi LLM"); done(fails); }
const expectN = async (label, want, id) => { const n = await open(id); if (n !== want) fails.push(`${label}: ${n} lượt fetch tới LLM, mong ${want}`); };
await expectN("mở lại, không đổi phân bổ", 0);
setDoc(doc({ photography: 25 })); M.resetOverlayCache();
await expectN("đổi allocated ảnh 20 -> 25tr, mở lại", n0);
await expectN("mở lại lần nữa sau khi đổi", 0);
setDoc(doc({ photography: 25, venue: 90 })); M.resetOverlayCache();
await expectN("đổi phân bổ hạng mục khác (venue)", 0);
setDoc(doc({ photography: 0, venue: 90 })); M.resetOverlayCache();
await expectN("allocated ảnh 25 -> 0 (về tổng x tỷ lệ 30tr)", n0);
await expectN("vendor thứ hai, cùng ngân sách hiệu lực (lần đầu của vendor này)", n0, W.id);
done(fails);
